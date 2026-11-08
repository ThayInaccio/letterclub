// API do letterclub. Fica atrás do nginx (que serve o site e repassa /api/).
import http from 'node:http';
import crypto from 'node:crypto';
import { pool, q, tx, migrate } from './db.js';
import * as cartas from './cartas.js';
import * as clube from './clube.js';
import * as pedidos from './pedidos.js';
import * as paginas from './paginas.js';
import * as moderacao from './moderacao.js';
import { RAW } from './util.js';

const PORT = Number(process.env.PORT || 3000);
const SECURE = process.env.COOKIE_SECURE !== 'false'; // só desligar em http local
const COOKIE = 'lc_sid';
const MAX_BODY = 16 * 1024;

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---- sessão anônima: sem nome, sem e-mail; o cookie é a caixa de correio ----
async function findSession(req) {
  const m = /(?:^|;\s*)lc_sid=([A-Za-z0-9_-]{43})/.exec(req.headers.cookie || '');
  if (!m) return null;
  const { rows } = await q('SELECT id FROM sessions WHERE token_hash = $1', [sha(m[1])]);
  return rows[0]?.id || null;
}

async function ensureSession(req, res) {
  const found = await findSession(req);
  if (found) return found;
  const token = crypto.randomBytes(32).toString('base64url');
  const sid = await tx(async (c) => {
    const { rows: [s] } = await c.query('INSERT INTO sessions (token_hash) VALUES ($1) RETURNING id', [sha(token)]);
    await cartas.welcome(s.id, c);
    return s.id;
  });
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${400 * 86400}${SECURE ? '; Secure' : ''}`);
  return sid;
}

async function readJson(req) {
  // Só JSON: formulário de outro site não consegue mandar isso sem preflight (proteção CSRF).
  if (!/^application\/json\b/.test(req.headers['content-type'] || '')) throw Object.assign(new Error('use application/json'), { status: 415 });
  let size = 0; const chunks = [];
  for await (const ch of req) {
    size += ch.length;
    if (size > MAX_BODY) throw Object.assign(new Error('corpo grande demais'), { status: 413 });
    chunks.push(ch);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('JSON inválido'), { status: 400 }); }
}

// [método, padrão, handler(ctx), status de sucesso] — ctx: { req, res, params, body(), session(), maybeSession() }
const routes = [
  ['GET', /^\/api\/health$/, async () => { await q('SELECT 1'); return { ok: true }; }],
  ['GET', /^\/api\/caixa$/, async (c) => cartas.caixa(await c.session())],
  ['POST', /^\/api\/cartas$/, async (c) => cartas.send(await c.session(), await c.body()), 201],
  ['POST', /^\/api\/cartas\/([^/]+)\/abrir$/, async (c) => cartas.open(await c.session(), c.params[0])],
  ['POST', /^\/api\/cartas\/([^/]+)\/guardar$/, async (c) => cartas.keep(await c.session(), c.params[0], await c.body())],
  ['POST', /^\/api\/cartas\/([^/]+)\/mural$/, async (c) => cartas.publish(await c.session(), c.params[0], await c.body())],
  ['GET', /^\/api\/mural$/, async (c) => cartas.mural(await c.maybeSession())],
  ['POST', /^\/api\/mural\/([^/]+)\/favorito$/, async (c) => cartas.favorite(await c.session(), c.params[0], await c.body())],
  ['POST', /^\/api\/mural\/([^/]+)\/denunciar$/, async (c) => cartas.report(await c.session(), c.params[0])],
  // moderação (só com ADMIN_TOKEN)
  ['GET', /^\/api\/admin\/fila$/, async (c) => { moderacao.auth(c.req); return moderacao.fila(); }],
  ['POST', /^\/api\/admin\/cartas\/([^/]+)$/, async (c) => { moderacao.auth(c.req); return moderacao.decidir(c.params[0], await c.body()); }],
  ['GET', /^\/moderar$/, async () => moderacao.pagina()],
  // páginas públicas para busca e compartilhamento (o nginx repassa estes caminhos para cá)
  ['GET', /^\/carta\/(\d+)(?:-([a-z0-9-]*))?(\/?)$/, async (c) => paginas.carta(c.params[0], c.params[1] ?? '', c.params[2] === '/')],
  ['GET', /^\/temas(\/?)$/, async (c) => (c.params[0] ? paginas.temas() : { redirect: '/temas/', permanent: true })],
  ['GET', /^\/temas\/([a-z0-9-]+)(\/?)$/, async (c) => (c.params[1] ? paginas.tema(c.params[0]) : { redirect: `/temas/${c.params[0]}/`, permanent: true })],
  ['GET', /^\/og\/carta\/(\d+)\.png$/, async (c) => paginas.ogCarta(c.params[0])],
  ['GET', /^\/og\/tema\/([a-z0-9-]+)\.png$/, async (c) => paginas.ogTema(c.params[0])],
  ['GET', /^\/og\/site\.png$/, async () => paginas.ogSite()],
  ['GET', /^\/sitemap\.xml$/, async () => paginas.sitemapIndex()],
  ['GET', /^\/sitemap-cartas\.xml$/, async () => paginas.sitemapCartas()],
  ['POST', /^\/api\/clube$/, async (c) => clube.join(await c.body())],
  ['GET', /^\/api\/clube\/confirmar$/, async (c) => clube.confirm(c.query.get('t'))],
  // descadastro: link do e-mail (GET) e one-click do List-Unsubscribe (POST sem JSON, RFC 8058)
  ['GET', /^\/api\/clube\/sair$/, async (c) => clube.leave(c.query.get('t'))],
  ['POST', /^\/api\/clube\/sair$/, async (c) => { await clube.leave(c.query.get('t')); return { ok: true }; }],
  // Correio físico fica desligado até existir gateway de pagamento (FEATURE_CORREIO=true liga).
  ...(process.env.FEATURE_CORREIO === 'true'
    ? [['POST', /^\/api\/pedidos$/, async (c) => pedidos.create(await c.session(), await c.body()), 201]]
    : []),
];

const server = http.createServer(async (req, res) => {
  const t0 = Date.now();
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;
  let status = 200; let out;
  const method = req.method === 'HEAD' ? 'GET' : req.method; // crawlers usam HEAD
  try {
    const route = routes.find(([m, re]) => re.test(path) && m === method);
    if (!route) {
      status = routes.some(([, re]) => re.test(path)) ? 405 : 404;
      out = { error: status === 405 ? 'método não permitido' : 'não encontrado' };
    } else {
      const ctx = {
        req, res, params: route[1].exec(path).slice(1), query: url.searchParams,
        body: (() => { let b; return () => (b ??= readJson(req)); })(), // POST lê o corpo antes de criar sessão
        session: async () => { if (method === 'POST') await ctx.body(); return ensureSession(req, res); },
        maybeSession: () => findSession(req),
      };
      out = await route[2](ctx);
      status = route[3] || 200;
    }
  } catch (e) {
    status = e.status || 500;
    out = { error: status === 500 ? 'erro interno' : e.message };
    if (status === 500) console.error(JSON.stringify({ level: 'error', path, msg: e.message, stack: e.stack }));
  }
  const log = (st) => console.log(JSON.stringify({ method: req.method, path, status: st, ms: Date.now() - t0 }));
  // handler devolve { redirect: '/caminho' } para links abertos direto do e-mail (só caminhos locais);
  // permanent: endereço canônico das páginas públicas (301, o Google passa a usar o novo)
  if (status === 200 && typeof out?.redirect === 'string' && out.redirect.startsWith('/') && !out.redirect.startsWith('//')) {
    const st = out.permanent ? 301 : 303;
    res.writeHead(st, { Location: out.redirect, 'Cache-Control': out.permanent ? 'public, max-age=3600' : 'no-store', 'Referrer-Policy': 'no-referrer' });
    res.end();
    return log(st);
  }
  // página, sitemap ou imagem
  if (out?.[RAW]) {
    res.writeHead(out.status, { 'X-Content-Type-Options': 'nosniff', ...out.headers });
    res.end(req.method === 'HEAD' ? undefined : out.body);
    return log(out.status);
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(out));
  log(status);
});

await migrate();
server.listen(PORT, () => console.log(JSON.stringify({ msg: 'api no ar', port: PORT })));

// k8s manda SIGTERM: para de aceitar conexões, termina as abertas e fecha o pool.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => pool.end().then(() => process.exit(0))));
}
