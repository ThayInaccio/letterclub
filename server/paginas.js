// Páginas públicas renderizadas no servidor, feitas para o Google e para links compartilhados:
//   /carta/<num>-<slug>/   uma carta do mural
//   /temas/  e  /temas/<slug>/   coleções por tema, com texto editorial
//   /sitemap.xml (índice) e /sitemap-cartas.xml (dinâmico)   ·   /og/...png (imagens de prévia)
// Regra de qualidade: carta pendente de moderação abre normalmente, mas com noindex e fora do sitemap.
import { q } from './db.js';
import { raw, fmtDate } from './util.js';
import { visible } from './cartas.js';
import { TEMAS, byId, bySlug, DEFAULT_TEMA } from './temas.js';
import { pen, paper, SITE, letterPath, letterUrl, slugify, excerpt } from './estilo.js';
import { analyticsTag } from './analytics.js';
import { letterImage, siteImage, cached } from './og.js';

const MIN_TEMA = Number(process.env.MIN_CARTAS_TEMA || 3); // tema com menos cartas aprovadas fica fora do Google
const PUBLIC = `${visible()} AND mod_status = 'aprovada'`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const temaOf = (l) => byId[l.theme] || byId[DEFAULT_TEMA];
const temaPath = (t) => `/temas/${t.slug}/`;

// ---------------- layout ----------------
const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#fbf3ea;color:#3a2620;font-family:'Work Sans','Helvetica Neue',Arial,sans-serif;font-size:17px;line-height:27px}
a{color:inherit}
.wrap{max-width:1200px;margin:0 auto;padding:0 5%}
.top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;padding:28px 0}
.logo{font-family:'Homemade Apple','Segoe Script',cursive;font-size:25px;line-height:1.5;color:#c23b32;text-decoration:none}
.nav{display:flex;flex-wrap:wrap;align-items:center;gap:8px 24px;font-size:14px;line-height:20px;font-weight:500}
.nav a{text-decoration:none;padding:12px 0}
.nav a.pill{padding:0 22px}
.pill{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 22px;border-radius:999px;background:#c23b32;color:#fff!important;text-decoration:none;font-size:14px;line-height:20px;font-weight:500;border:0;cursor:pointer;font-family:inherit}
.pill.ghost{background:transparent;color:#3a2620!important;border:1.5px solid #a88676}
.eyebrow{margin:0;font-family:'IBM Plex Mono',Menlo,monospace;font-size:11px;line-height:16px;letter-spacing:.14em;font-weight:500;color:#c23b32;text-transform:uppercase}
.crumbs{font-family:'IBM Plex Mono',Menlo,monospace;font-size:11px;line-height:16px;letter-spacing:.1em;font-weight:500;color:#7a5a4e;display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 28px;padding:0;list-style:none;text-transform:uppercase}
.crumbs li+li:before{content:'·';margin-right:6px}
.crumbs a{text-decoration:none}
h1,h2{font-family:'Instrument Serif',Georgia,serif;font-weight:400;letter-spacing:-.02em;margin:0}
h1{font-size:clamp(44px,6vw,80px);line-height:1}
h2{font-size:clamp(32px,4vw,48px);line-height:1.05}
.lead{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:24px;line-height:32px;color:#7a5a4e;margin:0}
.paper{position:relative;padding:40px 44px 36px;border-radius:12px;box-shadow:0 2px 4px rgba(58,38,32,.08),0 22px 48px rgba(58,38,32,.18)}
.paper .meta{margin:0 0 18px;font-family:'IBM Plex Mono',Menlo,monospace;font-size:11px;line-height:16px;letter-spacing:.14em;font-weight:500}
.paper .text{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:40px;background-size:100% 40px}
.paper .sig{margin:18px 0 0;text-align:right;font-family:'Homemade Apple','Segoe Script',cursive;font-size:20px;line-height:36px}
.letter{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:clamp(32px,5vw,72px);align-items:start;padding:8px 0 72px}
@media (max-width:860px){.letter{grid-template-columns:1fr}}
.side{display:flex;flex-direction:column;gap:20px}
.actions{display:flex;flex-wrap:wrap;gap:10px}
.note{margin:0;font-size:14px;line-height:21px;color:#7a5a4e}
.linkbtn{background:none;border:0;padding:10px 0;font:inherit;font-size:14px;color:#7a5a4e;text-decoration:underline;text-underline-offset:3px;cursor:pointer;min-height:44px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:24px;margin:28px 0 0;padding:0;list-style:none}
.card{display:flex;flex-direction:column;gap:12px;height:100%;padding:26px 24px;border-radius:10px;text-decoration:none;box-shadow:0 2px 4px rgba(58,38,32,.06),0 12px 28px rgba(58,38,32,.12);transition:transform .3s ease-out}
.card:hover{transform:translateY(-3px)}
.card .t{margin:0;flex:1 1 auto;white-space:pre-wrap;overflow-wrap:anywhere}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0 0;padding:0;list-style:none}
.chips a{display:inline-flex;align-items:center;min-height:40px;padding:0 16px;border-radius:999px;background:#f6d9cf;text-decoration:none;font-size:14px;font-weight:500}
.chips a[aria-current]{background:#3a2620;color:#fbf3ea}
section{padding:56px 0;border-top:1px solid #e8d5c6}
.intro{max-width:720px;display:flex;flex-direction:column;gap:18px}
.intro p{margin:0}
ol.tips{margin:20px 0 0;padding-left:22px;max-width:720px;display:flex;flex-direction:column;gap:12px}
.cta{margin:0;padding:56px 5%;background:#c23b32;color:#fff;text-align:center;display:flex;flex-direction:column;align-items:center;gap:20px}
.cta .pill{background:#fbf3ea;color:#c23b32!important}
footer{padding:48px 0;font-size:14px;line-height:22px;color:#7a5a4e}
footer nav{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:12px}
footer a{text-decoration:none}
.empty{padding:32px;border-radius:12px;background:#f6d9cf}
`;

function page({ title, description, path, robots = 'index, follow', image, jsonld = [], body, status = 200, cache = 60 }) {
  const url = SITE() + path;
  const img = image || SITE() + '/og/site.png';
  return raw('html', `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="#c23b32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:site_name" content="letterclub">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&amp;family=Work+Sans:wght@400;500&amp;family=IBM+Plex+Mono:wght@500&amp;family=Homemade+Apple&amp;family=La+Belle+Aurore&amp;family=Caveat:wght@400;600&amp;display=swap" rel="stylesheet">
<style>${CSS}</style>
${jsonld.map(ld).join('\n')}
${analyticsTag()}
</head>
<body>
<div class="wrap">
<header class="top">
<a class="logo" href="/">letterclub</a>
<nav class="nav" aria-label="Principal">
<a href="/cartas/">cartas</a><a href="/mural/">mural</a><a href="/temas/">temas</a><a href="/clube/">o clube</a><a href="/caixa/">sua caixa</a>
<a class="pill" href="/escrever/">Escrever uma carta</a>
</nav>
</header>
${body}
</div>
<footer><div class="wrap">
<p style="margin:0">letterclub · cartas anônimas, escritas com calma</p>
<nav aria-label="Cartas por tema">${TEMAS.map((t) => `<a href="${temaPath(t)}">${esc(t.name)}</a>`).join('')}</nav>
</div></footer>
</body>
</html>
`, { status, cache });
}

function crumbs(items) {
  const html = `<ol class="crumbs">${items.map(([name, path], i) =>
    `<li>${i < items.length - 1 ? `<a href="${path}">${esc(name)}</a>` : `<span aria-current="page">${esc(name)}</span>`}</li>`).join('')}</ol>`;
  const json = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) =>
    ({ '@type': 'ListItem', position: i + 1, name, item: SITE() + path })) };
  return [html, json];
}

function letterCard(l) {
  const t = paper(l.paper), p = pen(l.pen);
  return `<li><a class="card" href="${letterPath(l)}" style="background:${t.bg};color:${t.fg}">
<span class="eyebrow" style="color:${t.muted}">${esc(l.city)} · ${l.hour}h</span>
<p class="t" style="font-family:${p.family};font-size:${Math.round(p.size * 0.92)}px;line-height:34px">${esc(excerpt(l.text, 160))}</p>
<span class="eyebrow" style="color:${t.sig}">${l.saves} guardaram · ler a carta</span>
</a></li>`;
}

const themeChips = (current) => `<ul class="chips">${TEMAS.map((t) =>
  `<li><a href="${temaPath(t)}"${t.id === current ? ' aria-current="page"' : ''}>${esc(t.name)}</a></li>`).join('')}</ul>`;

function gone(status) {
  const msg = status === 410
    ? ['Essa carta saiu do mural.', 'Quem escreveu tirou ela do mural, ou ela está em revisão. Tem muitas outras esperando por você.']
    : ['Não achamos essa página.', 'Talvez o endereço tenha mudado. As cartas continuam no mural.'];
  return page({ title: msg[0] + ' — letterclub', description: msg[1], path: '/', robots: 'noindex, follow', status, cache: 0,
    body: `<main style="padding:80px 0 120px;max-width:640px"><h1>${msg[0]}</h1><p class="lead" style="margin:20px 0 32px">${msg[1]}</p>
<div class="actions"><a class="pill" href="/mural/">Ir para o mural</a><a class="pill ghost" href="/temas/">Cartas por tema</a></div></main>` });
}

// ---------------- /carta/<num>-<slug>/ ----------------
const COLS = 'id, num, city, hour, pen, paper, stamp, text, theme, saves, created_at, published_at, reviewed_at, mod_status';

export async function carta(numStr, slug, hasSlash) {
  const num = Number(numStr);
  if (!Number.isSafeInteger(num) || num < 1) return gone(404);
  const { rows: [l] } = await q(`SELECT ${COLS}, (${visible()}) AS vis FROM letters WHERE num = $1`, [num]);
  if (!l) return gone(404);
  if (!l.vis) return gone(410); // 410: o Google tira do índice mais rápido que 404
  const canonical = letterPath(l);
  if (slug !== slugify(l.text) || !hasSlash) return { redirect: canonical, permanent: true };

  const tema = temaOf(l), t = paper(l.paper), p = pen(l.pen);
  const { rows: related } = await q(
    `SELECT ${COLS} FROM letters WHERE ${PUBLIC} AND id <> $1
     ORDER BY (theme = $2) DESC, saves DESC, published_at DESC LIMIT 6`, [l.id, l.theme]);
  const short = excerpt(l.text, 60);
  const title = `“${excerpt(l.text, 42)}” — carta de ${l.city} | letterclub`; // ~60 caracteres: o Google corta o resto
  const description = `${excerpt(l.text, 150)} Uma carta anônima escrita em ${l.city}, às ${l.hour}h. Leia e escreva a sua no letterclub.`;
  const image = `${SITE()}/og/carta/${l.num}.png`;
  const [crumbHtml, crumbLd] = crumbs([['Início', '/'], [tema.name, temaPath(tema)], [`Carta de ${l.city}`, canonical]]);
  const work = {
    '@context': 'https://schema.org', '@type': 'CreativeWork', '@id': SITE() + canonical,
    name: short, text: l.text, inLanguage: 'pt-BR', genre: tema.name, url: SITE() + canonical, image,
    dateCreated: l.created_at.toISOString(), datePublished: l.published_at.toISOString(),
    author: { '@type': 'Person', name: `Alguém de ${l.city}` },
    publisher: { '@type': 'Organization', name: 'letterclub', url: SITE() + '/' },
    isPartOf: { '@type': 'CollectionPage', name: tema.name, url: SITE() + temaPath(tema) },
    interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: l.saves },
  };
  const ruled = `background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 39px,${t.rule} 39px,${t.rule} 40px)`;

  return page({
    title, description, path: canonical, image, jsonld: [work, crumbLd],
    robots: l.mod_status === 'aprovada' ? 'index, follow, max-image-preview:large' : 'noindex, follow',
    body: `<main>
${crumbHtml}
<div class="letter">
<article class="paper" style="background:${t.bg};color:${t.fg};transform:rotate(-1deg)" aria-label="Carta">
<p class="meta" style="color:${t.muted}">${esc(l.city.toUpperCase())} · ${l.hour}H · <time datetime="${l.created_at.toISOString().slice(0, 10)}">${fmtDate(l.created_at)}</time></p>
<p class="text" style="font-family:${p.family};font-size:${p.size + 2}px;${ruled}">${esc(l.text)}</p>
<p class="sig" style="color:${t.sig}">— alguém de ${esc(l.city)}</p>
</article>
<aside class="side" aria-label="Sobre esta carta">
<p class="eyebrow"><a href="${temaPath(tema)}" style="text-decoration:none">${esc(tema.name)}</a></p>
<h1 style="font-size:clamp(36px,4vw,52px);line-height:1.05">Uma carta anônima de ${esc(l.city)}, escrita às ${l.hour}h.</h1>
<p class="lead">Para alguém que a pessoa nunca vai conhecer. Pode ser você.</p>
<div class="actions">
<button type="button" class="pill" data-fav aria-pressed="false"><span data-label>Guardar</span><span aria-hidden="true">·</span><span data-saves>${l.saves}</span></button>
<button type="button" class="pill ghost" data-share>Compartilhar</button>
</div>
<p class="note" data-msg role="status"></p>
<a class="pill ghost" href="/escrever/?tema=${tema.id}" style="align-self:flex-start">Escrever uma carta ${esc(tema.label)}</a>
<p class="note">Quem escreveu pendurou esta carta no mural, sem nome. Só a cidade e a hora assinam.</p>
<button type="button" class="linkbtn" data-report style="align-self:flex-start">Denunciar esta carta</button>
</aside>
</div>
${related.length ? `<section aria-labelledby="mais"><h2 id="mais">Mais cartas para ler</h2>
<ul class="grid">${related.map(letterCard).join('')}</ul>
<p style="margin:28px 0 0"><a href="${temaPath(tema)}">Ver todas as ${esc(tema.name.toLowerCase())} →</a></p></section>` : ''}
<section aria-labelledby="temas"><h2 id="temas">Cartas por tema</h2>${themeChips(l.theme)}</section>
</main>
<script>
(() => {
  const id = ${JSON.stringify(l.id)}, msg = document.querySelector('[data-msg]');
  const post = (path, body) => fetch('/api' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then((r) => r.ok ? r.json() : Promise.reject(r));
  const fav = document.querySelector('[data-fav]');
  fav.addEventListener('click', () => {
    const want = fav.getAttribute('aria-pressed') !== 'true';
    post('/mural/' + id + '/favorito', { fav: want }).then((d) => {
      fav.setAttribute('aria-pressed', String(d.fav));
      fav.querySelector('[data-label]').textContent = d.fav ? 'Guardada' : 'Guardar';
      document.querySelector('[data-saves]').textContent = d.saves;
    }, () => { msg.textContent = 'Não deu para guardar agora. Tenta de novo?'; });
  });
  document.querySelector('[data-share]').addEventListener('click', () => {
    const url = location.origin + location.pathname;
    if (navigator.share) { navigator.share({ title: document.title, url }).catch(() => {}); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
      () => { msg.textContent = 'Link copiado.'; }, () => { msg.textContent = url; });
  });
  const rep = document.querySelector('[data-report]');
  rep.addEventListener('click', () => {
    if (rep.dataset.armed !== '1') { rep.dataset.armed = '1'; rep.textContent = 'Confirmar denúncia (ofensiva, spam ou dado pessoal)'; return; }
    rep.disabled = true;
    post('/mural/' + id + '/denunciar').then(() => { rep.textContent = 'Obrigada. A gente vai revisar essa carta.'; },
      () => { rep.disabled = false; rep.textContent = 'Não deu para denunciar agora. Tentar de novo'; });
  });
})();
</script>`,
  });
}

// ---------------- /temas/ e /temas/<slug>/ ----------------
async function counts() {
  const { rows } = await q(`SELECT theme, count(*)::int AS n FROM letters WHERE ${PUBLIC} GROUP BY theme`);
  return Object.fromEntries(rows.map((r) => [r.theme, r.n]));
}

export async function temas() {
  const n = await counts();
  const [crumbHtml, crumbLd] = crumbs([['Início', '/'], ['Temas', '/temas/']]);
  return page({
    title: 'Cartas por tema: amor, amizade, família, saudade — letterclub',
    description: 'Cartas anônimas reais organizadas por tema: cartas de amor, para amigos, para a família, de saudade e para dias difíceis. Leia e escreva a sua.',
    path: '/temas/', jsonld: [crumbLd],
    body: `<main>${crumbHtml}
<div class="intro"><p class="eyebrow">Cartas por tema</p><h1>Para quem você escreveria?</h1>
<p class="lead">Cartas anônimas de verdade, escritas à mão por gente de várias cidades, separadas pelo que elas carregam.</p></div>
<ul class="grid" style="margin-bottom:72px">${TEMAS.map((t) => `<li><a class="card" href="${temaPath(t)}" style="background:#fffaf4">
<span class="eyebrow">${n[t.id] || 0} ${n[t.id] === 1 ? 'carta' : 'cartas'}</span>
<h2 style="font-size:36px">${esc(t.name)}</h2><p class="t note">${esc(t.description)}</p></a></li>`).join('')}</ul>
</main>`,
  });
}

export async function tema(slug) {
  const t = bySlug[slug];
  if (!t) return gone(404);
  const { rows } = await q(`SELECT ${COLS} FROM letters WHERE ${PUBLIC} AND theme = $1 ORDER BY published_at DESC LIMIT 60`, [t.id]);
  const path = temaPath(t);
  const [crumbHtml, crumbLd] = crumbs([['Início', '/'], ['Temas', '/temas/'], [t.name, path]]);
  const collection = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: t.name, description: t.description, inLanguage: 'pt-BR',
    url: SITE() + path, mainEntity: { '@type': 'ItemList', itemListElement: rows.map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: letterUrl(l) })) },
  };
  return page({
    title: t.title, description: t.description, path, jsonld: [collection, crumbLd],
    image: `${SITE()}/og/tema/${t.slug}.png`,
    robots: rows.length >= MIN_TEMA ? 'index, follow' : 'noindex, follow',
    body: `<main>${crumbHtml}
<div class="intro"><p class="eyebrow">${rows.length} ${rows.length === 1 ? 'carta' : 'cartas'} anônimas</p><h1>${esc(t.name)}</h1>
${t.intro.map((p) => `<p>${esc(p)}</p>`).join('\n')}
<div class="actions"><a class="pill" href="/escrever/?tema=${t.id}">Escrever uma carta ${esc(t.label)}</a></div></div>
<section aria-labelledby="lista" style="margin-top:56px"><h2 id="lista">${esc(t.name)} escritas no letterclub</h2>
${rows.length ? `<ul class="grid">${rows.map(letterCard).join('')}</ul>`
    : `<div class="empty" style="margin-top:28px"><p style="margin:0">Ainda não tem cartas aqui. A primeira pode ser a sua.</p></div>`}</section>
<section aria-labelledby="dicas"><h2 id="dicas">Como escrever ${esc(t.name.toLowerCase().replace(/^cartas/, 'uma carta'))}</h2>
<ol class="tips">${t.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></section>
<section aria-labelledby="outros"><h2 id="outros">Outros temas</h2>${themeChips(t.id)}</section>
</main>
<div class="cta"><h2 style="color:#fff">Escreva para alguém.</h2><a class="pill" href="/escrever/?tema=${t.id}">Escrever uma carta</a></div>`,
  });
}

// ---------------- sitemaps ----------------
const xml = (urls) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([loc, mod]) =>
  `  <url><loc>${esc(loc)}</loc>${mod ? `<lastmod>${mod.toISOString()}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;

export function sitemapIndex() {
  return raw('xml', `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    ['/sitemap-paginas.xml', '/sitemap-cartas.xml'].map((p) => `  <sitemap><loc>${SITE()}${p}</loc></sitemap>`).join('\n') +
    `\n</sitemapindex>\n`, { cache: 3600 });
}

export async function sitemapCartas() {
  const n = await counts();
  const { rows } = await q(
    `SELECT num, text, greatest(published_at, reviewed_at) AS mod FROM letters WHERE ${PUBLIC} ORDER BY num DESC LIMIT 45000`);
  return raw('xml', xml([
    [SITE() + '/temas/'],
    ...TEMAS.filter((t) => (n[t.id] || 0) >= MIN_TEMA).map((t) => [SITE() + temaPath(t)]),
    ...rows.map((l) => [letterUrl(l), l.mod]),
  ]), { cache: 3600 });
}

// ---------------- imagens de prévia ----------------
export async function ogCarta(numStr) {
  const { rows: [l] } = await q(`SELECT num, city, hour, pen, paper, text FROM letters WHERE num = $1 AND ${visible()}`, [Number(numStr)]);
  if (!l) return raw('html', 'não encontrada', { status: 404 });
  const png = cached(`c${l.num}:${l.pen}:${l.paper}:${l.text}`, () => letterImage(l));
  return raw('png', png, { cache: 86400 });
}

export function ogTema(slug) {
  const t = bySlug[slug];
  if (!t) return raw('html', 'não encontrado', { status: 404 });
  return raw('png', cached('t' + t.id, () => siteImage(t.name, 'cartas anônimas, escritas à mão')), { cache: 86400 });
}

export const ogSite = () => raw('png', cached('site', () => siteImage()), { cache: 86400 });
