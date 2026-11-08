// Imagem de prévia (og:image, 1200×630) de cada carta e do site, gerada como SVG e rasterizada com resvg.
// Fontes do DS em server/fonts (licenças OFL/Apache junto). Sem fontes do sistema: o resultado é igual em qualquer máquina.
import { Resvg } from '@resvg/resvg-js';
import { fileURLToPath } from 'node:url';
import { pen, paper } from './estilo.js';

const FONT_DIR = fileURLToPath(new URL('./fonts/', import.meta.url));
const FONTS = ['HomemadeApple-Regular.ttf', 'LaBelleAurore.ttf', 'Caveat.ttf', 'InstrumentSerif-Regular.ttf',
  'InstrumentSerif-Italic.ttf', 'IBMPlexMono-Medium.ttf'].map((f) => FONT_DIR + f);

const W = 1200, H = 630;
const CORAL = '#c23b32', CREAM = '#fbf3ea', INK = '#3a2620';

const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Quebra em linhas pela largura média do caractere da fonte (em × tamanho). Aproximado, com folga.
function wrap(text, maxWidth, fontSize, em) {
  const perLine = Math.max(8, Math.floor(maxWidth / (fontSize * em)));
  const lines = [];
  for (const para of text.replace(/\r/g, '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? line + ' ' + word : word;
      if (next.length <= perLine) { line = next; continue; }
      if (line) lines.push(line);
      line = word.length > perLine ? word.slice(0, perLine - 1) + '-' : word;
    }
    lines.push(line);
  }
  return lines;
}

// Maior tamanho de letra em que o texto cabe no papel; se nem no menor couber, corta com reticências.
function fit(text, p, box) {
  for (let size = Math.round(p.size * 1.9); size >= Math.round(p.size * 1.05); size -= 2) {
    const lh = Math.round(size * (p.svg === 'Homemade Apple' ? 1.75 : 1.3));
    const lines = wrap(text, box.w, size, p.em);
    if (lines.length * lh <= box.h) return { size, lh, lines };
  }
  const size = Math.round(p.size * 1.05);
  const lh = Math.round(size * (p.svg === 'Homemade Apple' ? 1.75 : 1.3));
  const max = Math.floor(box.h / lh);
  const lines = wrap(text, box.w, size, p.em).slice(0, max);
  lines[max - 1] = lines[max - 1].replace(/\s*\S*$/, '') + '…';
  return { size, lh, lines };
}

function render(svg) {
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Instrument Serif' },
  }).render().asPng();
}

const footer = (fg) => `
  <text x="80" y="${H - 42}" font-family="Homemade Apple" font-size="30" fill="${fg}">letterclub</text>
  <text x="${W - 80}" y="${H - 50}" text-anchor="end" font-family="IBM Plex Mono" font-weight="500" font-size="18" letter-spacing="3" fill="${fg}">LETTERCLUB.IO</text>`;

export function letterImage(l) {
  const p = pen(l.pen), t = paper(l.paper);
  const card = { x: 110, y: 52, w: 980, h: 452 };
  const box = { w: card.w - 120, h: card.h - 150 };
  const { size, lh, lines } = fit(l.text, p, box);
  const top = card.y + 104;
  const rules = Array.from({ length: Math.floor(box.h / lh) }, (_, i) =>
    `<line x1="${card.x + 56}" x2="${card.x + card.w - 56}" y1="${top + i * lh + Math.round(lh * 0.28)}" y2="${top + i * lh + Math.round(lh * 0.28)}" stroke="${t.rule}" stroke-width="1.5"/>`).join('');
  const meta = `${l.city} · ${l.hour}h`.toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${t.bg === CORAL ? INK : CORAL}"/>
  <g transform="rotate(-1.5 ${W / 2} ${H / 2})">
    <rect x="${card.x}" y="${card.y + 10}" width="${card.w}" height="${card.h}" rx="14" fill="#000" opacity="0.18"/>
    <rect x="${card.x}" y="${card.y}" width="${card.w}" height="${card.h}" rx="14" fill="${t.bg}"/>
    <text x="${card.x + 60}" y="${card.y + 58}" font-family="IBM Plex Mono" font-weight="500" font-size="17" letter-spacing="3" fill="${t.muted}">${x(meta)}</text>
    ${rules}
    ${lines.map((ln, i) => `<text x="${card.x + 60}" y="${top + i * lh}" font-family="${p.svg}" font-size="${size}" fill="${t.fg}">${x(ln)}</text>`).join('\n    ')}
    <text x="${card.x + card.w - 60}" y="${card.y + card.h - 34}" text-anchor="end" font-family="Homemade Apple" font-size="22" fill="${t.sig}">— alguém de ${x(l.city)}</text>
  </g>${footer(CREAM)}
</svg>`;
  return render(svg);
}

// Prévia padrão do site e dos temas: título grande à esquerda (quebra em até 3 linhas), cartinha à direita.
export function siteImage(title = 'escreva para alguém', sub = 'que você nunca vai conhecer.') {
  const size = title.length > 30 ? 84 : 104;
  const lines = wrap(title, 720, size, 0.44).slice(0, 3);
  const top = 300 - ((lines.length - 1) * size * 0.95) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${CORAL}"/>
  ${lines.map((ln, i) => `<text x="80" y="${top + i * size * 0.95}" font-family="Instrument Serif" font-size="${size}" letter-spacing="-2" fill="#ffffff">${x(ln)}</text>`).join('\n  ')}
  <text x="80" y="${top + (lines.length - 1) * size * 0.95 + 76}" font-family="Instrument Serif" font-style="italic" font-size="48" fill="#f6d9cf">${x(sub)}</text>
  <g transform="rotate(6 980 300)">
    <rect x="860" y="120" width="230" height="290" rx="12" fill="${CREAM}"/>
    ${[0, 1, 2, 3, 4].map((i) => `<line x1="890" x2="1060" y1="${200 + i * 40}" y2="${200 + i * 40}" stroke="#e8d5c6" stroke-width="2"/>`).join('')}
    <text x="890" y="190" font-family="La Belle Aurore" font-size="34" fill="${INK}">querida</text>
    <text x="890" y="230" font-family="La Belle Aurore" font-size="34" fill="${INK}">pessoa…</text>
  </g>${footer(CREAM)}
</svg>`;
  return render(svg);
}

// Cache em memória: a imagem só muda se a carta mudar (chave inclui o texto e o papel).
const cache = new Map();
export function cached(key, make) {
  if (cache.has(key)) return cache.get(key);
  const png = make();
  cache.set(key, png);
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return png;
}
