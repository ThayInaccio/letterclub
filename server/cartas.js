import { q, tx, WELCOME } from './db.js';
import { fail, int, str, oneOf, UUID, fmtDate, fmtShort, arrived } from './util.js';

// Cidades do Escrever e o selo de cada uma.
const STAMPS = {
  'São Paulo': 'cidade', 'Rio de Janeiro': 'riso', 'Belo Horizonte': 'pao', 'Salvador': 'mar',
  'Recife': 'sol', 'Belém': 'chuva', 'Curitiba': 'frio', 'Porto Alegre': 'cha',
};
const DELAY = Number(process.env.DELIVERY_DELAY_SECONDS ?? 2 * 86400); // "chega em 2 dias"
const PER_DAY = Number(process.env.LETTERS_PER_DAY || 20);

const id = (v) => { if (typeof v !== 'string' || !UUID.test(v)) fail(404, 'carta não encontrada'); return v; };
const bool = (v, name) => { if (typeof v !== 'boolean') fail(400, `${name} inválido`); return v; };

export async function welcome(sessionId, c) {
  const w = WELCOME;
  await c.query(
    `INSERT INTO letters (recipient_id, delivered_at, city, hour, pen, paper, stamp, text) VALUES ($1, now(), $2,$3,$4,$5,$6,$7)`,
    [sessionId, w.city, w.hour, w.pen, w.paper, w.stamp, w.text]);
}

export async function send(sid, b) {
  const city = oneOf(b.city, Object.keys(STAMPS), 'cidade');
  const letter = [
    str(b.text, 1, 700, 'texto'), int(b.pen, 0, 2, 'caneta'), int(b.paper, 0, 5, 'papel'),
    int(b.texture, 0, 2, 'textura'), city, int(b.hour, 0, 23, 'hora'), STAMPS[city],
  ];
  const { rows: [{ n }] } = await q(
    `SELECT count(*)::int AS n FROM letters WHERE author_id = $1 AND created_at > now() - interval '1 day'`, [sid]);
  if (n >= PER_DAY) fail(429, 'Muitas cartas por hoje. Amanhã tem mais papel.');
  const { rows: [row] } = await q(
    `INSERT INTO letters (author_id, text, pen, paper, texture, city, hour, stamp, deliver_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now() + make_interval(secs => $9)) RETURNING id`,
    [sid, ...letter, DELAY]);
  return { id: row.id };
}

export async function caixa(sid) {
  // Entrega: quem abre a caixa recebe a carta pronta mais antiga de outra pessoa,
  // no máximo uma por dia. SKIP LOCKED: duas réplicas nunca entregam a mesma carta.
  await q(
    `UPDATE letters SET recipient_id = $1, delivered_at = now()
     WHERE id = (SELECT id FROM letters
                 WHERE recipient_id IS NULL AND author_id IS NOT NULL AND author_id <> $1 AND deliver_at <= now()
                 ORDER BY deliver_at LIMIT 1 FOR UPDATE SKIP LOCKED)
       AND NOT EXISTS (SELECT 1 FROM letters WHERE recipient_id = $1 AND author_id IS NOT NULL
                       AND delivered_at > now() - interval '1 day')`, [sid]);
  const [inbox, sent] = await Promise.all([
    q(`SELECT id, city, hour, pen, paper, stamp, text, created_at, delivered_at, opened_at, kept
       FROM letters WHERE recipient_id = $1 ORDER BY delivered_at DESC LIMIT 50`, [sid]),
    q(`SELECT id, pen, paper, text, created_at, delivered_at, published_at
       FROM letters WHERE author_id = $1 ORDER BY created_at DESC LIMIT 50`, [sid]),
  ]);
  return {
    inbox: inbox.rows.map((l) => ({
      id: l.id, city: l.city, hour: l.hour + 'h', date: fmtDate(l.created_at), arrived: arrived(l.delivered_at),
      pen: l.pen, paper: l.paper, stamp: l.stamp, text: l.text, opened: !!l.opened_at, kept: l.kept,
    })),
    sent: sent.rows.map((l) => ({
      id: l.id, date: fmtShort(l.created_at), pen: l.pen, paper: l.paper, text: l.text,
      status: l.delivered_at ? 'done' : 'way', published: !!l.published_at,
    })),
  };
}

export async function open(sid, letterId) {
  const r = await q(`UPDATE letters SET opened_at = coalesce(opened_at, now()) WHERE id = $2 AND recipient_id = $1`, [sid, id(letterId)]);
  if (!r.rowCount) fail(404, 'carta não encontrada');
  return { ok: true };
}

export async function keep(sid, letterId, b) {
  const r = await q(`UPDATE letters SET kept = $3 WHERE id = $2 AND recipient_id = $1`, [sid, id(letterId), bool(b.kept, 'kept')]);
  if (!r.rowCount) fail(404, 'carta não encontrada');
  return { kept: b.kept };
}

// Só quem escreveu pendura (ou tira) a própria carta do mural.
export async function publish(sid, letterId, b) {
  const r = await q(
    `UPDATE letters SET published_at = CASE WHEN $3 THEN coalesce(published_at, now()) ELSE NULL END
     WHERE id = $2 AND author_id = $1`, [sid, id(letterId), bool(b.published, 'published')]);
  if (!r.rowCount) fail(404, 'carta não encontrada');
  return { published: b.published };
}

export async function mural(sid) {
  // shortcut: só as 100 mais recentes; paginar quando o mural passar disso
  const { rows } = await q(
    `SELECT l.id, l.city, l.hour, l.pen, l.paper, l.stamp, l.text, l.saves, l.created_at, (f.letter_id IS NOT NULL) AS fav
     FROM letters l LEFT JOIN favorites f ON f.letter_id = l.id AND f.session_id = $1
     WHERE l.published_at IS NOT NULL ORDER BY l.published_at DESC LIMIT 100`, [sid]);
  return {
    letters: rows.map((l, i) => ({
      id: l.id, order: i + 1, saves: l.saves, city: l.city, hour: l.hour + 'h', date: fmtDate(l.created_at),
      pen: l.pen, paper: l.paper, stamp: l.stamp, text: l.text, fav: l.fav,
    })),
  };
}

// Favoritar é idempotente (manda o estado desejado, não "inverter"): clique duplo não desconta.
export async function favorite(sid, letterId, b) {
  const want = bool(b.fav, 'fav');
  return tx(async (c) => {
    const { rows: [l] } = await c.query(`SELECT id FROM letters WHERE id = $1 AND published_at IS NOT NULL FOR UPDATE`, [id(letterId)]);
    if (!l) fail(404, 'carta não encontrada');
    const r = want
      ? await c.query(`INSERT INTO favorites (session_id, letter_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [sid, l.id])
      : await c.query(`DELETE FROM favorites WHERE session_id = $1 AND letter_id = $2`, [sid, l.id]);
    const delta = r.rowCount ? (want ? 1 : -1) : 0;
    const { rows: [u] } = await c.query(`UPDATE letters SET saves = greatest(0, saves + $2) WHERE id = $1 RETURNING saves`, [l.id, delta]);
    return { fav: want, saves: u.saves };
  });
}
