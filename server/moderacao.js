// Moderação do mural. Só existe com ADMIN_TOKEN definido (sem ele, as rotas respondem 404).
// Fila: cartas no mural ainda pendentes ou com denúncia. Aprovar = entra no Google; ocultar = sai de tudo.
import crypto from 'node:crypto';
import { q } from './db.js';
import { fail, raw, oneOf, UUID } from './util.js';
import { TEMAS, TEMA_IDS } from './temas.js';
import { letterPath } from './estilo.js';

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
export const enabled = () => (process.env.ADMIN_TOKEN || '').length >= 24;

export function auth(req) {
  if (!enabled()) fail(404, 'não encontrado');
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  // compara hashes de tamanho fixo: tempo constante e sem vazar o tamanho do token
  if (!m || !crypto.timingSafeEqual(sha(m[1]), sha(process.env.ADMIN_TOKEN))) fail(401, 'token inválido');
}

export async function fila() {
  const { rows } = await q(
    `SELECT id, num, city, hour, text, theme, saves, reports, mod_status, published_at FROM letters
     WHERE published_at IS NOT NULL AND (mod_status = 'pendente' OR reports > 0)
     ORDER BY reports DESC, published_at LIMIT 100`);
  return { temas: TEMAS.map((t) => ({ id: t.id, name: t.name })),
    cartas: rows.map((l) => ({ ...l, url: letterPath(l) })) };
}

export async function decidir(letterId, b) {
  if (typeof letterId !== 'string' || !UUID.test(letterId)) fail(404, 'carta não encontrada');
  const acao = oneOf(b.acao, ['aprovar', 'ocultar'], 'ação');
  const theme = b.theme === undefined ? null : oneOf(b.theme, TEMA_IDS, 'tema');
  const r = await q(
    `UPDATE letters SET mod_status = $2, reports = 0, reviewed_at = now(), theme = coalesce($3, theme)
     WHERE id = $1 AND published_at IS NOT NULL`, [letterId, acao === 'aprovar' ? 'aprovada' : 'oculta', theme]);
  if (!r.rowCount) fail(404, 'carta não encontrada');
  return { ok: true };
}

// Página simples; o token fica só na aba (sessionStorage) e vai no header, nunca na URL.
export function pagina() {
  if (!enabled()) return raw('html', 'não encontrado', { status: 404 });
  return raw('html', `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Moderação — letterclub</title>
<style>
body{margin:0;background:#fbf3ea;color:#3a2620;font:16px/1.6 'Work Sans',system-ui,sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 5%}
h1{font:400 40px/1.1 Georgia,serif;margin:0 0 8px}
form,li{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:16px}
li{background:#fffaf4;border-radius:10px;padding:18px;box-shadow:0 2px 8px rgba(58,38,32,.1)}
li p{flex:1 1 100%;margin:0;white-space:pre-wrap}
.meta{font:500 12px/1.4 monospace;letter-spacing:.08em;color:#7a5a4e;flex:1 1 100%}
.alerta{color:#c23b32}
button,input,select{font:inherit;min-height:40px;padding:0 14px;border-radius:999px;border:1.5px solid #a88676;background:#fff}
button.ok{background:#3f6b57;color:#fff;border:0}button.no{background:#c23b32;color:#fff;border:0}
</style></head><body><main>
<h1>Moderação</h1><p>Aprovar coloca a carta no Google. Ocultar tira do mural e da página pública.</p>
<form id="f"><label for="t">Token</label><input id="t" type="password" autocomplete="off" required><button type="submit">Entrar</button></form>
<p id="s" role="status"></p><ul id="l"></ul>
</main>
<script>
const $ = (s) => document.querySelector(s);
const tok = () => sessionStorage.getItem('lc-admin') || '';
const api = (m, p, b) => fetch('/api/admin' + p, { method: m, headers: { Authorization: 'Bearer ' + tok(), 'Content-Type': 'application/json' }, body: b && JSON.stringify(b) })
  .then((r) => r.ok ? r.json() : Promise.reject(r.status));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function load() {
  api('GET', '/fila').then((d) => {
    $('#f').hidden = true;
    $('#s').textContent = d.cartas.length ? d.cartas.length + ' na fila' : 'Fila vazia. Bom trabalho.';
    $('#l').innerHTML = d.cartas.map((c) => '<li data-id="' + c.id + '"><span class="meta">#' + c.num + ' · ' + esc(c.city) + ' · ' + c.hour + 'H · ' +
      c.saves + ' GUARDARAM' + (c.reports ? ' · <b class="alerta">' + c.reports + ' DENÚNCIA(S)</b>' : '') + (c.mod_status === 'oculta' ? ' · <b class="alerta">FORA DO AR</b>' : '') +
      ' · <a href="' + c.url + '" target="_blank" rel="noopener">abrir</a></span><p>' + esc(c.text) + '</p>' +
      '<select aria-label="Tema">' + d.temas.map((t) => '<option value="' + t.id + '"' + (t.id === c.theme ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') + '</select>' +
      '<button class="ok" data-a="aprovar">Aprovar</button><button class="no" data-a="ocultar">Ocultar</button></li>').join('');
  }, (st) => { $('#f').hidden = false; $('#s').textContent = st === 401 ? 'Token inválido.' : 'Erro ao carregar (' + st + ').'; });
}
$('#f').addEventListener('submit', (e) => { e.preventDefault(); sessionStorage.setItem('lc-admin', $('#t').value); $('#t').value = ''; load(); });
$('#l').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-a]'); if (!b) return;
  const li = b.closest('li'); b.disabled = true;
  api('POST', '/cartas/' + li.dataset.id, { acao: b.dataset.a, theme: li.querySelector('select').value })
    .then(() => { li.remove(); }, () => { b.disabled = false; $('#s').textContent = 'Não salvou, tenta de novo.'; });
});
if (tok()) load();
</script></body></html>`, { headers: { 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' } });
}
