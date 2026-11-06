import { q } from './db.js';
import { str, oneOf, email } from './util.js';

export async function join(b) {
  const row = [
    email(b.email),
    b.city == null || b.city === '' ? null : str(b.city, 1, 80, 'cidade'),
    oneOf(b.plan, ['leitor', 'membro'], 'plano'),
    oneOf(b.billing, ['mensal', 'anual'], 'cobrança'),
  ];
  // shortcut: sem gateway de pagamento; membro fica aguardando_pagamento até integrar (README).
  const status = row[2] === 'membro' ? 'aguardando_pagamento' : 'ativo';
  // Quem só sabe o e-mail de alguém não rebaixa um membro que já pagou.
  const { rows } = await q(
    `INSERT INTO members (email, city, plan, billing, status) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (email) DO UPDATE SET city = EXCLUDED.city, plan = EXCLUDED.plan, billing = EXCLUDED.billing,
       status = EXCLUDED.status, updated_at = now()
     WHERE NOT (members.plan = 'membro' AND members.status = 'ativo')
     RETURNING id, status`, [...row, status]);
  const m = rows[0] || (await q(`SELECT id, status FROM members WHERE email = $1`, [row[0]])).rows[0];
  return { memberNo: String(m.id).padStart(4, '0'), status: m.status };
}
