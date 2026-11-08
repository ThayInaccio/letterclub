// Smoke test de ponta a ponta no Chrome headless (via DevTools Protocol, sem dependências).
// Uso: BASE_URL=http://localhost:8081 npm test     (CHROME_PATH para outro navegador)
// Clica em cada botão de cada página (e nos botões que aparecem depois dele), cobra erro de JS,
// confere links/âncoras, hidratação, fluxos principais e overflow horizontal no celular.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import site from '../site.config.mjs';

const BASE = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9300 + Math.floor(Math.random() * 500);
const routes = Object.values(site.pages).map((p) => p.route);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-smoke-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
let targets;
for (let i = 0; i < 40 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { await sleep(250); } }
if (!targets) throw new Error('Chrome não abriu: defina CHROME_PATH');
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let seq = 0; const pending = {}; let errors = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value ?? a.description).join(' '));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon/.test(d.params.entry.url || '')) errors.push(d.params.entry.text + ' ' + (d.params.entry.url || ''));
};
const send = (method, params = {}) => new Promise((r) => { pending[++seq] = r; ws.send(JSON.stringify({ id: seq, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval');
  return r.result.result.value;
};
await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
// clipboard e foco como num navegador real (headless começa sem os dois)
await send('Browser.grantPermissions', { origin: BASE, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
// pop-ups (WhatsApp) só são registrados: uma aba nova roubaria o foco e a área de transferência
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.open = (u) => { (window.__opened = window.__opened || []).push(String(u)); return null; };` });
const go = async (route) => {
  await send('Page.navigate', { url: 'about:blank' }); // garante load mesmo em navegação só de #hash
  await sleep(50);
  errors = [];
  const loaded = new Promise((r) => { const old = ws.onmessage; ws.onmessage = (m) => { old(m); if (JSON.parse(m.data).method === 'Page.loadEventFired') { ws.onmessage = old; r(); } }; });
  await send('Page.navigate', { url: BASE + route });
  await Promise.race([loaded, sleep(8000)]); await sleep(250);
};

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

// rótulo estável de cada botão visível
const BUTTONS = `[...document.querySelectorAll('#app button')].filter(b=>b.offsetParent!==null||getComputedStyle(b).position==='fixed').map(b=>(b.getAttribute('aria-label')||b.textContent).trim().replace(/\\s+/g,' '))`;
const click = (label, nth) => `(()=>{const bs=[...document.querySelectorAll('#app button')].filter(b=>(b.getAttribute('aria-label')||b.textContent).trim().replace(/\\s+/g,' ')===${JSON.stringify(label)});const b=bs[${nth}];if(!b)return false;b.click();return true})()`;
const snap = `document.getElementById('app').innerHTML`;
const occurrences = (list) => { const c = {}; return list.map((l) => [l, (c[l] = (c[l] ?? -1) + 1)]); };

let clicks = 0; const inert = [];
for (const route of process.env.SMOKE_CRAWL === '0' ? [] : routes) { // SMOKE_CRAWL=0 pula o rastreamento (só fluxos)
  await go(route);
  await ev('localStorage.clear()');
  await go(route);
  check(errors.length === 0, `${route}: erros ao carregar: ${errors.join(' | ')}`);
  check(await ev(`document.querySelectorAll('h1').length`) <= 1, `${route}: conteúdo duplicado após hidratar`);
  check(await ev(`!!document.querySelector('meta[name=description]') && !!document.querySelector('link[rel=canonical]')`), `${route}: sem meta de SEO`);

  const base = occurrences(await ev(BUTTONS));
  for (const [label, nth] of base) {
    await go(route);
    const before = await ev(snap);
    if (!(await ev(click(label, nth)))) { failures.push(`${route}: botão sumiu "${label}"`); continue; }
    clicks++; await sleep(350);
    check(errors.length === 0, `${route}: erro ao clicar "${label}": ${errors.join(' | ')}`);
    if (before === (await ev(snap))) inert.push(`${route} → "${label}"`);
    // botões novos que apareceram (modais, etapas, abas): um nível a mais
    const baseSet = new Set(base.map(([l]) => l));
    const extra = occurrences((await ev(BUTTONS)).filter((l) => !baseSet.has(l)));
    for (const [l2, n2] of extra) {
      await go(route); await ev(click(label, nth)); await sleep(350);
      const b2 = await ev(snap);
      if (!(await ev(click(l2, n2)))) continue;
      clicks++; await sleep(350);
      check(errors.length === 0, `${route}: erro em "${label}" → "${l2}": ${errors.join(' | ')}`);
      if (b2 === (await ev(snap))) inert.push(`${route} → "${label}" → "${l2}"`);
    }
  }
}

// links internos e âncoras
const hrefs = new Set();
for (const route of routes) { await go(route); for (const h of await ev(`[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'))`)) hrefs.add(h.startsWith('#') ? route + h : h); }
for (const h of hrefs) {
  if (/^https?:/.test(h)) continue;
  const [p, hash] = h.split('#');
  const res = await fetch(BASE + p, { redirect: 'manual' });
  check(res.status === 200, `link ${h} → HTTP ${res.status}`);
  if (hash) { await go(p); check(await ev(`!!document.getElementById(${JSON.stringify(hash)})`), `âncora ${h} não existe`); }
}

// fluxos
await go('/'); await ev('localStorage.clear()');
await go('/'); await sleep(5200);
check(await ev(`!document.querySelector('[aria-label="Abrindo o letterclub"]')`), 'home: abertura não some');

await go('/escrever/');
await ev(`(()=>{const t=document.getElementById('lc-texto');t.focus();t.value='oi pessoa';t.dispatchEvent(new Event('input',{bubbles:true}))})()`);
await sleep(1100);
check(await ev(`document.activeElement.id==='lc-texto'`), 'escrever: textarea perde o foco ao digitar');
check(await ev(`document.body.innerText.includes('oi pessoa')`), 'escrever: prévia não atualiza');
check((await ev(`localStorage.getItem('letterclub:rascunho')`) || '').includes('oi pessoa'), 'escrever: rascunho não salva');
await ev(`(()=>{const s=document.getElementById('lc-cidade');s.value='Recife';s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(200);
check(await ev(`document.body.innerText.includes('RECIFE')`), 'escrever: cidade não muda o carimbo');
await go('/escrever/');
check(await ev(`document.getElementById('lc-texto').value==='oi pessoa'`), 'escrever: rascunho não é recuperado');
await go('/caixa/'); await ev(click('Rascunhos', 0)); await sleep(300);
check(await ev(`document.body.innerText.includes('oi pessoa')`), 'caixa: rascunho do escrever não aparece');
await send('Network.clearBrowserCookies'); // sessão nova: o rastreamento acima já abriu tudo da anterior
const unique = 'smoke ' + Date.now();
await go('/escrever/');
await ev(`(()=>{const t=document.getElementById('lc-texto');t.value=${JSON.stringify(unique)};t.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(200);
await ev(click('Enviar carta', 0)); await sleep(1500);
check(await ev(`document.body.innerText.includes('ENVIADA')`), 'escrever: envio não conclui');
check(!(await ev(`localStorage.getItem('letterclub:rascunho')`)), 'escrever: rascunho não limpa após enviar');

// caixa: carta de boas-vindas, a enviada, abrir e pendurar no mural (persistem no servidor)
await go('/caixa/'); await sleep(500);
check(await ev(`/cartas? fechadas? te esperando|Tudo lido/.test(document.body.innerText)`), 'caixa: não carregou do servidor');
const firstEnvelope = await ev(`[...document.querySelectorAll('#app button')].map(b=>b.getAttribute('aria-label')||'').find(l=>/^Abrir carta de /.test(l))`);
check(!!firstEnvelope, 'caixa: sem carta fechada para abrir');
if (firstEnvelope) { await ev(click(firstEnvelope, 0)); await sleep(400); }
await ev(click('Enviadas', 0)); await sleep(300);
check(await ev(`document.body.innerText.includes(${JSON.stringify(unique)})`), 'caixa: carta enviada não aparece');
await ev(`[...document.querySelectorAll('#app button')].find(b=>b.textContent.includes('Pendurar no mural')).click()`); await sleep(400);
// antes de pendurar, avisa que a carta fica pública (inclusive no Google)
check(await ev(`/vai ficar pública/.test(document.body.innerText) && /Google/.test(document.body.innerText)`), 'caixa: pendurar sem o aviso de carta pública');
await ev(click('Pendurar e deixar pública', 0)); await sleep(600);
check(await ev(`!![...document.querySelectorAll('#app a')].find(a=>/^\\/carta\\/\\d+-/.test(a.getAttribute('href')||''))`), 'caixa: sem link para a página da carta');
await go('/caixa/'); await sleep(500);
if (firstEnvelope) check(await ev(`!![...document.querySelectorAll('#app button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(firstEnvelope.replace('Abrir', 'Reler'))})`), 'caixa: carta aberta volta fechada');
await ev(click('Enviadas', 0)); await sleep(300);
check(await ev(`[...document.querySelectorAll('#app button')].find(b=>b.textContent.includes('Pendurar no mural'))?.getAttribute('aria-pressed')==='true'`), 'caixa: pendurar no mural não persiste');
await go('/mural/'); await sleep(500);
check(await ev(`document.body.innerText.includes(${JSON.stringify(unique)})`), 'mural: carta pendurada não aparece');

// mural: favorito persiste depois de recarregar
const favLabel = await ev(`[...document.querySelectorAll('#app button')].map(b=>b.getAttribute('aria-label')||'').find(l=>/^Favoritar carta de /.test(l))`);
await ev(click(favLabel, 0)); await sleep(500);
const favCount = await ev(`document.querySelectorAll('[aria-label="Tirar dos favoritos"]').length`);
await go('/mural/'); await sleep(500);
check(favCount > 0 && await ev(`document.querySelectorAll('[aria-label="Tirar dos favoritos"]').length`) === favCount, 'mural: favorito não persiste');

// clube: e-mail vazio é barrado; inscrição mostra a carteirinha "falta confirmar" com número do servidor
await go('/clube/');
await ev(click('Quero receber a Caixa', 0)); await sleep(300);
check(await ev(`!!document.getElementById('cl-email') && !document.getElementById('cl-email').validity.valid`), 'clube: entrou sem e-mail');
await ev(`(()=>{const e=document.getElementById('cl-email');e.value='smoke+${Date.now()}@exemplo.com';e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
await ev(click('Quero receber a Caixa', 0)); await sleep(700);
check(await ev(`!document.getElementById('cl-email') && /Nº \\d{4,}/.test(document.body.innerText) && document.body.innerText.includes('Quase lá.')`), 'clube: inscrição sem carteirinha pendente');
// voltar dos links do e-mail
await go('/clube/?saiu=1');
check(await ev(`document.body.innerText.includes('Você saiu do clube')`), 'clube: aviso de saída não aparece');
await go('/clube/?confirmado=1&n=0042');
check(await ev(`document.body.innerText.includes('Agora você é do clube') && document.body.innerText.includes('Nº 0042')`), 'clube: confirmação não aparece');

// preço e correio físico escondidos
for (const route of routes) {
  await go(route);
  check(!(await ev(`/R\\$\\s?\\d|pelo correio|calígrafo|Correio/.test(document.body.innerText)`)), `${route}: ainda fala de preço ou correio físico`);
}
check((await fetch(BASE + '/correio/')).status === 404, '/correio/ ainda publicado');

await go('/mural/'); await ev(click('Compartilhar', 0)); await sleep(300); await ev(click('Copiar link', 0)); await sleep(400);
check(await ev(`document.body.innerText.includes('Link copiado.')`), 'mural: copiar link não confirma');
const copied = await ev('navigator.clipboard.readText()').catch(() => '');
check(/\/carta\/\d+-[a-z0-9-]+\/$/.test(copied), `mural: link copiado inválido (${copied || 'área de transferência vazia'})`);
if (copied) { // sem o link, o resto do teste ainda roda
  check((await fetch(copied)).status === 200, 'mural: página do link copiado não abre');
}

// compartilhar no WhatsApp (sem Web Share, como no computador): abre o wa.me com o link da carta
await go('/mural/'); await ev(click('Compartilhar', 0)); await sleep(300); await ev(click('WhatsApp', 0)); await sleep(300);
check(await ev(`(window.__opened||[]).some(u=>/^https:\\/\\/wa\\.me\\/\\?text=.*\\/carta\\/\\d+-/.test(decodeURIComponent(u)))`), 'mural: WhatsApp não abre com o link da carta');

// compartilhar: a imagem é gerada de verdade e baixada como PNG
const dl = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-dl-'));
await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
await go('/mural/'); await ev(click('Compartilhar', 0)); await sleep(1200); await ev(click('Baixar imagem', 0));
let png;
for (let i = 0; i < 40 && !png; i++) { await sleep(150); png = fs.readdirSync(dl).find((f) => f.endsWith('.png')); }
check(png && fs.statSync(path.join(dl, png)).size > 30000 && fs.readFileSync(path.join(dl, png)).subarray(1, 4).toString() === 'PNG', 'mural: imagem de compartilhar não foi gerada');
if (png) fs.copyFileSync(path.join(dl, png), path.join(os.tmpdir(), 'lc-share-' + png)); // fica pra olhar
fs.rmSync(dl, { recursive: true, force: true });


// celular: sem rolagem horizontal
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
const overflow = [];
for (const route of routes) { await go(route); const w = await ev(`document.documentElement.scrollWidth`); if (w > 392) overflow.push(`${route} (${w}px)`); }
check(overflow.length === 0, `overflow horizontal em 390px: ${overflow.join(', ')}`);

ws.close(); chrome.kill();
await new Promise((r) => chrome.once('exit', r)); // Chrome ainda escreve no perfil enquanto fecha
fs.rmSync(prof, { recursive: true, force: true, maxRetries: 5 });
console.log(`${clicks} cliques em ${routes.length} páginas, ${hrefs.size} links.`);
if (inert.length) console.log(`Botões que não mudaram nada na tela (conferir se é esperado):\n  ${[...new Set(inert)].join('\n  ')}`);
if (failures.length) { console.error(`\n✗ ${failures.length} falha(s):\n  ${failures.join('\n  ')}`); process.exit(1); }
console.log('✓ tudo certo');
