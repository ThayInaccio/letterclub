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

// clube grátis: inscrição pendente até confirmar pelo e-mail
assert.equal((await anon('POST', '/api/clube', { email: 'nao-email' })).status, 400);
const mail = `teste+${Date.now()}@exemplo.com`;
const j1 = await anon('POST', '/api/clube', { email: mail, city: 'Recife' });
assert.equal(j1.status, 200);
assert.match(j1.body.memberNo, /^\d{4,}$/);
assert.equal(j1.body.status, 'pendente', 'só vira membro depois de confirmar');
assert.equal((await anon('POST', '/api/clube', { email: mail.toUpperCase() })).status, 429, 'não reenvia confirmação na hora (anti-flood)');
const redirect = async (method, path, body) => {
  const res = await fetch(BASE + path, { method, redirect: 'manual', ...(body && { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }) });
  return { status: res.status, location: res.headers.get('location') };
};
assert.match((await redirect('GET', '/api/clube/confirmar?t=' + 'x'.repeat(32))).location, /link=invalido/, 'token falso não confirma');
assert.match((await redirect('GET', '/api/clube/sair?t=' + 'x'.repeat(32))).location, /saiu=1/, 'sair não revela se o token existe');

// Com o SMTP de teste (tests/smtp-sink.mjs + MAIL_DIR), segue o fluxo inteiro pelos e-mails.
// Com DATABASE_URL também, roda a Caixa semanal de verdade.
if (process.env.MAIL_DIR) {
  const { readdirSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const inbox = (to) => readdirSync(process.env.MAIL_DIR).sort()
    .map((f) => readFileSync(join(process.env.MAIL_DIR, f), 'utf8').replace(/=\r?\n/g, '').replace(/=3D/g, '='))
    .filter((m) => m.startsWith(`X-Sink-To: ${to}`));
  const waitMail = async (to, re) => {
    for (let i = 0; i < 40; i++) { const m = inbox(to).filter((x) => re.test(x)); if (m.length) return m; await new Promise((r) => setTimeout(r, 150)); }
    return [];
  };
  const [conf] = await waitMail(mail, /confirmar\?t=/);
  assert.ok(conf, 'e-mail de confirmação chegou');
  const t = /\/api\/clube\/confirmar\?t=([\w-]+)/.exec(conf)[1];
  const c1 = await redirect('GET', '/api/clube/confirmar?t=' + t);
  assert.equal(c1.status, 303);
  assert.match(c1.location, /^\/clube\/\?confirmado=1&n=\d{4,}/);
  assert.match((await redirect('GET', '/api/clube/confirmar?t=' + t)).location, /link=invalido/, 'link de confirmação vale uma vez');
  assert.equal((await anon('POST', '/api/clube', { email: mail })).body.status, 'ativo', 'confirmado vira membro');

  if (process.env.DATABASE_URL) {
    const { execFileSync } = await import('node:child_process');
    const run = () => execFileSync('node', ['server/semanal.js'], { env: process.env, encoding: 'utf8' });
    run();
    const weekly = await waitMail(mail, /A Caixa da semana/);
    assert.equal(weekly.length, 1, 'Caixa semanal chegou');
    assert.match(weekly[0], /List-Unsubscribe-Post: List-Unsubscribe=One-Click/);
    assert.match(weekly[0], /\/carta\/\d+-[a-z0-9-]+\//, 'Caixa linka a página de cada carta');
    run();
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(inbox(mail).filter((m) => /A Caixa da semana/.test(m)).length, 1, 'rodar de novo não manda duas vezes');
    const u = /\/api\/clube\/sair\?t=([\w-]+)/.exec(weekly[0])[1];
    assert.equal((await redirect('POST', '/api/clube/sair?t=' + u, 'List-Unsubscribe=One-Click')).status, 200, 'one-click do Gmail');
    assert.match((await redirect('GET', '/api/clube/sair?t=' + u)).location, /saiu=1/);
  }
}

// ---- páginas públicas (SEO), moderação e denúncia ----
const get = async (path) => {
  const res = await fetch(BASE + path, { redirect: 'manual' });
  return { status: res.status, type: res.headers.get('content-type'), location: res.headers.get('location'), text: await res.text() };
};
assert.equal((await A('POST', '/api/cartas', { ...letter('oi'), theme: 'outro' })).status, 400, 'tema fora da lista');
const amor = 'carta de amor ' + Date.now() + ' — a gente se viu uma vez só e eu lembro do casaco verde';
const am = await A('POST', '/api/cartas', { ...letter(amor), theme: 'amor' });
assert.equal(am.status, 201);
const pub = await A('POST', `/api/cartas/${am.body.id}/mural`, { published: true });
assert.match(pub.body.url, /^\/carta\/\d+-carta-de-amor-\d+/, 'publicar devolve a página da carta');
const url = pub.body.url;
assert.equal((await A('GET', '/api/caixa')).body.sent.find((l) => l.id === am.body.id).url, url, 'caixa mostra a página');
const inMural = (await anon('GET', '/api/mural')).body.letters.find((l) => l.id === am.body.id);
assert.deepEqual([inMural.url, inMural.theme], [url, 'amor']);

let pg = await get(url);
assert.equal(pg.status, 200);
assert.match(pg.type, /text\/html/);
assert.ok(pg.text.includes('casaco verde'), 'página tem o texto da carta');
assert.match(pg.text, /<meta name="robots" content="noindex, follow">/, 'pendente de moderação fica fora do Google');
assert.match(pg.text, /"@type":"BreadcrumbList"/);
assert.ok(!(await get('/sitemap-cartas.xml')).text.includes(url), 'pendente fora do sitemap');
assert.equal((await get(url.replace(/-[a-z0-9-]+\/$/, '-errado/'))).location, url, 'slug errado → 301 pro canônico');
assert.equal((await get(url.slice(0, -1))).status, 301, 'sem barra → 301');
const og = await fetch(BASE + '/og/carta/' + /\/carta\/(\d+)/.exec(url)[1] + '.png');
assert.equal(og.headers.get('content-type'), 'image/png', 'imagem de prévia');
assert.equal((await get('/carta/999999999/')).status, 404);
assert.equal((await get('/temas/nao-existe/')).status, 404);
assert.equal((await get('/sitemap.xml')).status, 200);

if (process.env.ADMIN_TOKEN) {
  const admin = (method, path, body, token = process.env.ADMIN_TOKEN) => fetch(BASE + '/api/admin' + path, {
    method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.json() }));
  assert.equal((await admin('GET', '/fila', undefined, 'errado')).status, 401, 'token errado');
  const fila = await admin('GET', '/fila');
  assert.ok(fila.body.cartas.some((c) => c.id === am.body.id), 'carta nova na fila de moderação');
  assert.equal((await admin('POST', `/cartas/${am.body.id}`, { acao: 'aprovar', theme: 'amizade' })).status, 200);
  pg = await get(url);
  assert.match(pg.text, /<meta name="robots" content="index, follow/, 'aprovada entra no Google');
  assert.ok((await get('/sitemap-cartas.xml')).text.includes(url), 'aprovada no sitemap');
  assert.ok((await get('/temas/cartas-para-amigos/')).text.includes(url), 'moderação trocou o tema e a carta aparece na página do tema');
  assert.ok(!(await admin('GET', '/fila')).body.cartas.some((c) => c.id === am.body.id), 'aprovada sai da fila');
} else {
  assert.equal((await get('/moderar')).status, 404, 'sem ADMIN_TOKEN não existe moderação');
}

// tirar do mural: a página some (410, o Google remove mais rápido que 404)
await A('POST', `/api/cartas/${am.body.id}/mural`, { published: false });
assert.equal((await get(url)).status, 410);
await A('POST', `/api/cartas/${am.body.id}/mural`, { published: true });
assert.equal((await get(url)).status, 200);

// denúncia: uma por pessoa; na terceira a carta sai do ar até revisar
const R1 = person();
assert.equal((await R1('POST', `/api/mural/${am.body.id}/denunciar`, {})).status, 200);
await R1('POST', `/api/mural/${am.body.id}/denunciar`, {});
assert.equal((await get(url)).status, 200, 'a mesma pessoa não conta duas vezes');
for (const R of [person(), person()]) await R('POST', `/api/mural/${am.body.id}/denunciar`, {});
assert.equal((await get(url)).status, 410, 'três denúncias tiram do ar');
assert.ok(!(await anon('GET', '/api/mural')).body.letters.some((l) => l.id === am.body.id), 'sai do mural');
assert.equal((await A('GET', '/api/caixa')).body.sent.find((l) => l.id === am.body.id).url, null, 'autor não vê link da página');

// correio físico desligado até existir gateway de pagamento (FEATURE_CORREIO)
assert.equal((await A('POST', '/api/pedidos', { email: mail })).status, 404, 'pedidos do correio fora do ar');

assert.equal((await anon('GET', '/api/nada')).status, 404);
assert.equal((await anon('DELETE', '/api/caixa')).status, 405);
console.log('✓ api');
