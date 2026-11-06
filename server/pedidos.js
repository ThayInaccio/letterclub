import { q } from './db.js';
import { fail, int, str, oneOf, email } from './util.js';

// Preços em centavos. Mesmos valores padrão do Correio.dc.html; o total cobrado é sempre este.
export const PRICES = {
  base: 2490,
  method: [0, 1990],          // impressa | calígrafo
  paper: [0, 600, 300],       // pólen | algodão | rosado
  extras: { cera: 590, flor: 790, postal: 390 },
  photo: 490,                 // até 3
  shipping: [0, 1290],        // simples | registrada
};

export function total(o) {
  return PRICES.base + PRICES.method[o.method] + PRICES.paper[o.paper]
    + o.extras.reduce((s, x) => s + PRICES.extras[x], 0) + o.photos * PRICES.photo + PRICES.shipping[o.shipping];
}

function address(a) {
  if (!a || typeof a !== 'object') fail(400, 'endereço obrigatório');
  const cep = str(a.cep, 8, 9, 'CEP');
  if (!/^\d{5}-?\d{3}$/.test(cep)) fail(400, 'CEP inválido');
  const uf = str(a.uf, 2, 2, 'UF').toUpperCase();
  if (!/^[A-Z]{2}$/.test(uf)) fail(400, 'UF inválida');
  return {
    nome: str(a.nome, 1, 120, 'nome'), cep, rua: str(a.rua, 1, 200, 'rua'), num: str(a.num, 1, 20, 'número'),
    comp: a.comp ? str(a.comp, 0, 100, 'complemento') : '', cidade: str(a.cidade, 1, 80, 'cidade'), uf,
  };
}

export async function create(sid, b) {
  const extras = Array.isArray(b.extras) ? [...new Set(b.extras)] : fail(400, 'adicionais inválidos');
  extras.forEach((x) => oneOf(x, Object.keys(PRICES.extras), 'adicional'));
  const choices = {
    method: int(b.method, 0, 1, 'método'), paper: int(b.paper, 0, 2, 'papel'), envelope: int(b.envelope, 0, 3, 'envelope'),
    extras, photos: int(b.photos, 0, 3, 'fotos'), dest: int(b.dest, 0, 1, 'destino'), shipping: int(b.shipping, 0, 1, 'envio'),
  };
  const addr = choices.dest === 1 ? address(b.address) : null;
  const pay = oneOf(b.pay, ['pix', 'cartao'], 'pagamento');
  const cents = total(choices);
  // shortcut: sem gateway (Mercado Pago × Stripe ainda em aberto). O pedido fica aguardando_pagamento;
  // o gateway entra aqui. Dados de cartão nunca passam por este servidor (tokenização no navegador).
  const { rows: [o] } = await q(
    `INSERT INTO orders (session_id, letter_id, email, choices, address, total_cents, payment_method, status)
     VALUES ($1, (SELECT id FROM letters WHERE author_id = $1 ORDER BY created_at DESC LIMIT 1), $2, $3, $4, $5, $6, 'aguardando_pagamento')
     RETURNING id, status`, [sid, email(b.email), choices, addr, cents, pay]);
  return { id: o.id, total: cents, status: o.status };
}
