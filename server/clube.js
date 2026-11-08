// Clube grátis: a Caixa semanal com as cartas mais curtidas do mural.
// Confirmação dupla (ninguém inscreve o e-mail dos outros) e descadastro em um clique.
import crypto from 'node:crypto';
import { q } from './db.js';
import { fail, str, email } from './util.js';
import * as mailer from './mailer.js';
import * as emails from './emails.js';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const token = () => crypto.randomBytes(24).toString('base64url');
const SITE = () => (process.env.SITE_URL || 'http://localhost:8080').replace(/\/$/, '');
const RESEND_AFTER_S = 120; // não reenvia a confirmação antes de 2 min (evita usar o form pra floodar alguém)
const no = (id) => String(id).padStart(4, '0');

export async function join(b) {
  const addr = email(b.email);
  const city = b.city == null || String(b.city).trim() === '' ? null : str(b.city, 1, 80, 'cidade');
  const { rows: [m] } = await q(
    `INSERT INTO members (email, city, plan, billing, status) VALUES ($1, $2, 'leitor', 'mensal', 'pendente')
     ON CONFLICT (email) DO UPDATE SET city = coalesce(EXCLUDED.city, members.city), updated_at = now()
     RETURNING id, status, confirm_sent_at`, [addr, city]);
  if (m.status === 'ativo') return { memberNo: no(m.id), status: 'ativo' };

  // pendente ou quem tinha saído: (re)manda a confirmação
  if (m.confirm_sent_at && Date.now() - m.confirm_sent_at.getTime() < RESEND_AFTER_S * 1000) fail(429, 'confirmação enviada há pouco');
  const t = token();
  await q(`UPDATE members SET status = 'pendente', confirm_token_hash = $2, confirm_sent_at = now() WHERE id = $1`, [m.id, sha(t)]);
  const link = `${SITE()}/api/clube/confirmar?t=${t}`;
  const sent = await mailer.send({ to: addr, ...emails.confirmation(link) });
  if (!sent && process.env.NODE_ENV !== 'production') console.log(JSON.stringify({ msg: 'link de confirmação (dev)', link }));
  return { memberNo: no(m.id), status: 'pendente' };
}

// GET do link do e-mail → redireciona de volta para a tela do clube
export async function confirm(t) {
  if (typeof t !== 'string' || t.length < 20) return { redirect: '/clube/?link=invalido#entrar' };
  const { rows: [m] } = await q(
    `UPDATE members SET status = 'ativo', confirmed_at = now(), unsubscribed_at = NULL, confirm_token_hash = NULL,
       unsub_token = coalesce(unsub_token, $2), updated_at = now()
     WHERE confirm_token_hash = $1 AND confirm_sent_at > now() - interval '7 days'
     RETURNING id`, [sha(t), token()]);
  return { redirect: m ? `/clube/?confirmado=1&n=${no(m.id)}#entrar` : '/clube/?link=invalido#entrar' };
}

// Link "sair do clube" de todo e-mail (GET) e o one-click do List-Unsubscribe (POST, RFC 8058).
export async function leave(t) {
  if (typeof t === 'string' && t.length >= 20) {
    await q(`UPDATE members SET status = 'saiu', unsubscribed_at = now(), updated_at = now() WHERE unsub_token = $1`, [t]);
  }
  // mesma resposta exista ou não o token: o link não revela quem está no clube
  return { redirect: '/clube/?saiu=1#entrar' };
}

export const unsubLink = (t) => `${SITE()}/api/clube/sair?t=${t}`;
