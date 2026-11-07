// Teste de integração da API contra o stack rodando (docker compose).
// Uso: DELIVERY_DELAY_SECONDS=0 docker compose up -d --build && BASE_URL=http://localhost:8080 node tests/api.test.mjs
// (com atraso 0 a carta fica pronta na hora, então dá pra testar a entrega)
import assert from 'node:assert/strict';

const BASE = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

// cada "pessoa" é um cookie jar
function person() {
  let cookie = '';
  return async (method, path, body, headers = {}) => {
    const res = await fetch(BASE + path, {
      method, headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(cookie && { Cookie: cookie }), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json(), setCookie: set };
  };
}

const letter = (text) => ({ text, pen: 1, paper: 2, texture: 0, city: 'Recife', hour: 23 });
const anon = person();

// saúde e mural público sem criar sessão (crawler não ganha cookie)
assert.equal((await anon('GET', '/api/health')).status, 200);
const m0 = await anon('GET', '/api/mural');
assert.equal(m0.status, 200);
assert.ok(m0.body.letters.length >= 12, 'acervo inicial do mural');
assert.equal(m0.setCookie, null, 'GET /api/mural não cria sessão');

// envio: validação
const A = person();
assert.equal((await A('POST', '/api/cartas', 'text=oi', { 'Content-Type': 'application/x-www-form-urlencoded' })).status, 415, 'só JSON (CSRF)');
assert.equal((await A('POST', '/api/cartas', letter('   '))).status, 400, 'texto vazio');
assert.equal((await A('POST', '/api/cartas', letter('x'.repeat(701)))).status, 400, 'texto > 700');
assert.equal((await A('POST', '/api/cartas', { ...letter('oi'), city: 'Gotham' })).status, 400, 'cidade fora da lista');
assert.equal((await A('POST', '/api/cartas', { ...letter('oi'), pen: 7 })).status, 400, 'caneta inválida');
assert.equal((await A('POST', '/api/cartas', '{"text": "' + 'x'.repeat(20000) + '"}')).status, 413, 'corpo grande');

// envio ok
const unique = 'teste ' + Date.now() + ' — o mar continua aqui';
const sent = await A('POST', '/api/cartas', letter(unique));
assert.equal(sent.status, 201);
const caixaA = await A('GET', '/api/caixa');
// (pode vir também a carta do dia, se houver alguma pronta na fila)
assert.ok(caixaA.body.inbox.some((l) => l.text.startsWith('Hoje o dia foi cinza')), 'caixa nova começa com a carta de boas-vindas');
assert.equal(caixaA.body.sent[0].text, unique);
assert.equal(caixaA.body.sent[0].status, 'way');

// entrega: alguém que abre a caixa recebe a carta pronta mais antiga (uma por dia por pessoa)
let B, got;
for (let i = 0; i < 40 && !got; i++) {
  B = person();
  got = (await B('GET', '/api/caixa')).body.inbox.find((l) => l.text === unique);
}
assert.ok(got, 'carta de A chegou em alguém');
assert.equal(got.city, 'Recife');
assert.equal(got.hour, '23h');
assert.equal(got.arrived, 'CHEGOU HOJE');
assert.equal((await B('GET', '/api/caixa')).body.inbox.filter((l) => l.text === unique).length, 1, 'não duplica');
assert.equal((await A('GET', '/api/caixa')).body.sent[0].status, 'done', 'A vê "entregue"');
assert.equal((await A('GET', '/api/caixa')).body.inbox.some((l) => l.text === unique), false, 'ninguém recebe a própria carta');

// abrir / guardar: só quem recebeu
assert.equal((await A('POST', `/api/cartas/${got.id}/abrir`, {})).status, 404, 'A não abre carta de B');
assert.equal((await B('POST', `/api/cartas/${got.id}/abrir`, {})).status, 200);
assert.equal((await B('POST', `/api/cartas/${got.id}/guardar`, { kept: true })).status, 200);
assert.equal((await B('POST', `/api/cartas/${got.id}/guardar`, { kept: 'sim' })).status, 400);
const lb = (await B('GET', '/api/caixa')).body.inbox.find((l) => l.id === got.id);
assert.deepEqual([lb.opened, lb.kept], [true, true]);
assert.equal((await B('POST', '/api/cartas/nao-e-uuid/abrir', {})).status, 404);

// mural: só o autor pendura
assert.equal((await B('POST', `/api/cartas/${sent.body.id}/mural`, { published: true })).status, 404, 'B não publica carta de A');
assert.equal((await A('POST', `/api/cartas/${sent.body.id}/mural`, { published: true })).status, 200);
const onMural = (await anon('GET', '/api/mural')).body.letters.find((l) => l.id === sent.body.id);
assert.ok(onMural, 'carta publicada aparece no mural');
assert.equal(onMural.order, 1, 'mais recente primeiro');
assert.equal((await A('GET', '/api/caixa')).body.sent[0].published, true);

// favoritar é idempotente e conta certo
assert.equal((await B('POST', `/api/mural/${sent.body.id}/favorito`, { fav: true })).body.saves, 1);
assert.equal((await B('POST', `/api/mural/${sent.body.id}/favorito`, { fav: true })).body.saves, 1, 'clique duplo não conta 2');
assert.equal((await B('GET', '/api/mural')).body.letters.find((l) => l.id === sent.body.id).fav, true);
assert.equal((await B('POST', `/api/mural/${sent.body.id}/favorito`, { fav: false })).body.saves, 0);
assert.equal((await A('POST', `/api/cartas/${sent.body.id}/mural`, { published: false })).status, 200);
assert.equal((await B('POST', `/api/mural/${sent.body.id}/favorito`, { fav: true })).status, 404, 'fora do mural não favorita');

// clube
assert.equal((await anon('POST', '/api/clube', { email: 'nao-email', plan: 'leitor', billing: 'mensal' })).status, 400);
const mail = `teste+${Date.now()}@exemplo.com`;
const j1 = await anon('POST', '/api/clube', { email: mail, city: 'Recife', plan: 'leitor', billing: 'mensal' });
assert.equal(j1.status, 200);
assert.match(j1.body.memberNo, /^\d{4,}$/);
assert.equal(j1.body.status, 'ativo');
const j2 = await anon('POST', '/api/clube', { email: mail.toUpperCase(), plan: 'membro', billing: 'anual' });
assert.equal(j2.body.memberNo, j1.body.memberNo, 'mesmo e-mail, mesma carteirinha');
assert.equal(j2.body.status, 'aguardando_pagamento');

// correio: total sempre do servidor
const order = { method: 1, paper: 1, envelope: 2, extras: ['cera', 'cera'], photos: 2, dest: 0, shipping: 1, pay: 'pix', email: mail, total: 1 };
const o1 = await A('POST', '/api/pedidos', order);
assert.equal(o1.status, 201);
assert.equal(o1.body.total, 2490 + 1990 + 600 + 590 + 2 * 490 + 1290, 'ignora total do cliente e extra repetido');
assert.equal(o1.body.status, 'aguardando_pagamento');
assert.equal((await A('POST', '/api/pedidos', { ...order, dest: 1 })).status, 400, 'endereço obrigatório');
const addr = { nome: 'Ana', cep: '01310-100', rua: 'Av. Paulista', num: '1000', cidade: 'São Paulo', uf: 'sp' };
assert.equal((await A('POST', '/api/pedidos', { ...order, dest: 1, address: { ...addr, cep: '123' } })).status, 400, 'CEP');
assert.equal((await A('POST', '/api/pedidos', { ...order, dest: 1, address: addr })).status, 201);
assert.equal((await A('POST', '/api/pedidos', { ...order, extras: ['ouro'] })).status, 400);
assert.equal((await A('POST', '/api/pedidos', { ...order, photos: 4 })).status, 400);

assert.equal((await anon('GET', '/api/nada')).status, 404);
assert.equal((await anon('DELETE', '/api/caixa')).status, 405);
console.log('✓ api');
