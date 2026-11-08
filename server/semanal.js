// A Caixa: e-mail semanal com as cartas mais curtidas do mural.
// Roda e termina (serviço cron no Railway, toda sexta). Idempotente: digest_sends garante
// uma Caixa por pessoa por semana, então rodar de novo só completa quem faltou.
//   node server/semanal.js            envia
//   node server/semanal.js --previa   só mostra quais cartas iriam, sem enviar
import { pool, q, migrate } from './db.js';
import * as mailer from './mailer.js';
import * as emails from './emails.js';
import { fmtDate } from './util.js';
import { unsubLink } from './clube.js';
import crypto from 'node:crypto';

const SIZE = Number(process.env.DIGEST_SIZE || 5);
const PREVIEW = process.argv.includes('--previa');
const log = (o) => console.log(JSON.stringify(o));

// segunda-feira da semana atual, no fuso do clube: chave da semana em digest_sends
function weekKey(now = new Date()) {
  const tz = process.env.TZ_DISPLAY || 'America/Sao_Paulo';
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now).split('-').map(Number);
  const local = new Date(Date.UTC(y, m - 1, d));
  local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return local.toISOString().slice(0, 10);
}

async function topLetters() {
  // mais favoritadas nos últimos 7 dias; empate → mais guardadas no total → mais recentes
  const { rows } = await q(
    `SELECT l.id, l.num, l.city, l.hour, l.paper, l.text,
            count(f.letter_id) FILTER (WHERE f.created_at > now() - interval '7 days') AS week_favs
     FROM letters l LEFT JOIN favorites f ON f.letter_id = l.id
     WHERE l.published_at IS NOT NULL AND l.mod_status <> 'oculta'
     GROUP BY l.id
     ORDER BY week_favs DESC, l.saves DESC, l.published_at DESC
     LIMIT $1`, [SIZE]);
  return rows;
}

async function main() {
  await migrate();
  const week = weekKey();
  const letters = await topLetters();
  if (!letters.length) return log({ msg: 'semanal: mural vazio, nada a enviar', week });
  if (PREVIEW) return log({ msg: 'semanal: prévia', week, letters: letters.map((l) => ({ city: l.city, favs: Number(l.week_favs), text: l.text.slice(0, 60) })) });
  if (!mailer.enabled) return log({ level: 'warn', msg: 'semanal: SMTP não configurado; nenhuma Caixa enviada', week });

  const { rows: members } = await q(
    `SELECT id, email, unsub_token FROM members m
     WHERE status = 'ativo' AND NOT EXISTS (SELECT 1 FROM digest_sends d WHERE d.member_id = m.id AND d.week = $1)
     ORDER BY id`, [week]);
  const label = fmtDate(new Date());
  let sent = 0, failed = 0;
  for (const m of members) {
    // reserva antes de enviar: outra execução em paralelo pula esta pessoa
    const claim = await q(`INSERT INTO digest_sends (member_id, week) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [m.id, week]);
    if (!claim.rowCount) continue;
    let t = m.unsub_token;
    if (!t) {
      t = crypto.randomBytes(24).toString('base64url');
      await q(`UPDATE members SET unsub_token = $2 WHERE id = $1`, [m.id, t]);
    }
    const link = unsubLink(t);
    try {
      await mailer.send({
        to: m.email, ...emails.weekly(letters, link, label),
        headers: { 'List-Unsubscribe': `<${link}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
      sent++;
    } catch (e) {
      failed++;
      await q(`DELETE FROM digest_sends WHERE member_id = $1 AND week = $2`, [m.id, week]); // tenta de novo na próxima execução
      log({ level: 'error', msg: 'semanal: falha ao enviar', member: m.id, error: e.message });
    }
    await new Promise((r) => setTimeout(r, 250)); // devagar com o SMTP
  }
  log({ msg: 'semanal: fim', week, letters: letters.length, sent, failed });
  if (failed) process.exitCode = 1;
}

try { await main(); } finally { await pool.end(); }
