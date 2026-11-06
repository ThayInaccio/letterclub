// Compila telas/*.dc.html (fonte de verdade, não editada aqui) em um site estático:
// HTML pré-renderizado (SEO) + bundle Preact que hidrata a interatividade.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { pathToFileURL } from 'node:url';
import { parseDocument } from 'htmlparser2';
import * as esbuild from 'esbuild';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import site from '../site.config.mjs';
import { lintDS } from './ds-lint.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'telas');
const GEN = path.join(ROOT, '.gen');
const DIST = path.join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || 'http://localhost:8080').replace(/\/$/, '');
if (!process.env.SITE_URL) console.warn('! SITE_URL não definido; canonical e sitemap vão usar ' + SITE_URL);

const routeOf = (name) => site.pages[name]?.route;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// ---------- 1. ler e compilar cada .dc.html ----------
function pick(re, src, file) {
  const m = re.exec(src);
  assert(m, `${file}: não achei ${re}`);
  return m[1];
}

function compact(n, file) {
  if (n.type === 'text') return n.data;
  if (n.type !== 'tag') return null; // comentários etc.
  const attrs = {};
  for (let [k, v] of Object.entries(n.attribs)) {
    if (k.startsWith('hint-')) continue; // dicas só do canvas
    // onChange do canvas é por tecla (semântica React); no DOM isso é "input".
    if (k === 'onChange' && (n.name === 'textarea' || n.name === 'input')) k = 'onInput';
    if (k === 'href') {
      v = v.replace(/^(\w+)\.dc\.html/, (_, name) => {
        assert(routeOf(name), `${file}: link para ${name}.dc.html sem rota em site.config.mjs`);
        return routeOf(name);
      });
    }
    attrs[k] = v;
  }
  return [n.name, attrs, n.children.map((c) => compact(c, file)).filter((c) => c !== null)];
}

function compile(file) {
  const src = fs.readFileSync(path.join(SRC, file), 'utf8');
  const name = file.replace('.dc.html', '');
  const xdc = pick(/<x-dc>([\s\S]*)<\/x-dc>/, src, file);
  const helmet = (/<helmet>([\s\S]*?)<\/helmet>/.exec(xdc) || [, ''])[1];
  const body = xdc.replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  const code = pick(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/, src, file);
  const doc = parseDocument(body, { lowerCaseAttributeNames: false, recognizeSelfClosing: true });
  const tpl = doc.children.map((c) => compact(c, file)).filter((c) => c !== null);
  const imports = [...new Set([...body.matchAll(/<dc-import name="(\w+)"/g)].map((m) => m[1]))];
  fs.writeFileSync(path.join(GEN, name + '.js'),
    `import { DCLogic, define } from '../build/runtime.js';\n` +
    imports.map((i) => `import './${i}.js';\n`).join('') +
    code + `\nexport default define(${JSON.stringify(name)}, ${JSON.stringify(tpl)}, Component);\n`);
  return { name, title: pick(/<title>([\s\S]*?)<\/title>/, src, file), helmet, imports };
}

fs.rmSync(GEN, { recursive: true, force: true });
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(GEN, { recursive: true });

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.dc.html'));
const dsErrors = files.flatMap((f) => lintDS('telas/' + f, fs.readFileSync(path.join(SRC, f), 'utf8')));
if (dsErrors.length) {
  console.error(`✗ ${dsErrors.length} problema(s) de design system:\n  ` + dsErrors.join('\n  '));
  process.exit(1);
}
const comps = Object.fromEntries(files.map((f) => { const c = compile(f); return [c.name, c]; }));
const pages = Object.keys(site.pages);
for (const p of pages) assert(comps[p], `site.config.mjs: página ${p} não existe em telas/`);
// tela nova precisa ser registrada (rota + SEO) ou importada por outra; nada fica de fora calado
const imported = new Set(Object.values(comps).flatMap((c) => c.imports));
for (const n of Object.keys(comps)) {
  assert(site.pages[n] || imported.has(n), `telas/${n}.dc.html não é página em site.config.mjs nem é importada por outra tela`);
}

// ---------- 2. bundle do navegador ----------
for (const p of pages) {
  fs.writeFileSync(path.join(GEN, p + '.entry.js'),
    `import { h, hydrate } from 'preact';\nimport C from './${p}.js';\nhydrate(h(C, {}), document.getElementById('app'));\n`);
}
const result = await esbuild.build({
  entryPoints: Object.fromEntries(pages.map((p) => [p.toLowerCase(), path.join(GEN, p + '.entry.js')])),
  bundle: true, splitting: true, format: 'esm', minify: true, target: 'es2020',
  outdir: path.join(DIST, 'assets'), entryNames: '[name]-[hash]', chunkNames: 'chunk-[hash]',
  metafile: true, logLevel: 'warning', absWorkingDir: ROOT,
});
const scriptOf = {};
for (const [out, meta] of Object.entries(result.metafile.outputs)) {
  if (meta.entryPoint) scriptOf[path.basename(meta.entryPoint, '.entry.js')] = '/' + path.relative(DIST, path.join(ROOT, out));
}

// ---------- 3. pré-render + head de SEO ----------
// Ordem: componentes importados primeiro, a página por último (o estilo da página prevalece).
function helmetsOf(name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  return [...comps[name].imports.flatMap((i) => helmetsOf(i, seen)), comps[name].helmet];
}

function headExtras(name) {
  const tags = [];
  const seenLinks = new Set();
  for (const hm of helmetsOf(name)) {
    for (const m of hm.matchAll(/<link[^>]*>|<style[\s\S]*?<\/style>/g)) {
      const tag = m[0];
      if (tag.includes('rel="preconnect"')) continue; // adicionado uma vez abaixo
      if (tag.startsWith('<link')) { if (seenLinks.has(tag)) continue; seenLinks.add(tag); }
      tags.push(tag);
    }
  }
  return tags.join('\n');
}

const sitemap = [];
for (const name of pages) {
  const cfg = site.pages[name];
  const url = SITE_URL + cfg.route;
  const title = cfg.title || comps[name].title;
  const { default: C } = await import(pathToFileURL(path.join(GEN, name + '.js')));
  const html = renderToString(h(C, {}));
  const jsonLd = cfg.route === '/' ? `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: SITE_URL + '/', inLanguage: 'pt-BR', description: cfg.description,
  }).replace(/</g, '\\u003c')}</script>` : '';
  const page = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(cfg.description)}">
<link rel="canonical" href="${esc(url)}">
${cfg.index === false ? '<meta name="robots" content="noindex, follow">' : ''}
<meta name="theme-color" content="${site.themeColor}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${site.name}">
<meta property="og:locale" content="${site.locale}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(cfg.description)}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${headExtras(name)}
${jsonLd}
<script type="module" src="${scriptOf[name]}"></script>
</head>
<body>
<div id="app">${html}</div>
</body>
</html>
`;
  // auto-checagem: nada de template cru nem link do canvas no HTML final
  assert(html.length > 200, `${name}: render vazio`);
  assert(!page.includes('{{'), `${name}: sobrou {{ }} no HTML`);
  assert(!page.includes('.dc.html'), `${name}: sobrou link .dc.html`);
  assert(!/<(sc-for|sc-if|dc-import)/.test(page), `${name}: sobrou tag do canvas`);
  assert(scriptOf[name], `${name}: sem bundle`);
  const out = path.join(DIST, cfg.route, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, page);
  if (cfg.index !== false) sitemap.push(url);
  console.log(`✓ ${cfg.route.padEnd(12)} ${(page.length / 1024).toFixed(1)} KB`);
}

fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  sitemap.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n') + `\n</urlset>\n`);
fs.writeFileSync(path.join(DIST, 'robots.txt'),
  // sem Disallow: o crawler precisa abrir /caixa/ e /correio/ para ver o noindex
  `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
console.log(`✓ sitemap.xml (${sitemap.length} urls), robots.txt → dist/`);
