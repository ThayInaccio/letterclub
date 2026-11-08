// Canetas, papéis e endereços das cartas, no servidor (páginas públicas, imagem de prévia, e-mails).
// Mesmos índices de telas/Escrever.dc.html.

export const PENS = [
  { name: 'cursiva', family: "'Homemade Apple', 'Segoe Script', cursive", svg: 'Homemade Apple', size: 20, em: 0.56 },
  { name: 'pena fina', family: "'La Belle Aurore', 'Segoe Script', cursive", svg: 'La Belle Aurore', size: 28, em: 0.42 },
  { name: 'letra de forma', family: "'Caveat', 'Segoe Print', cursive", svg: 'Caveat', size: 27, em: 0.4 },
];

export const PAPERS = [
  { bg: '#fffaf4', fg: '#3a2620', muted: '#7a5a4e', rule: '#e8d5c6', sig: '#c23b32' },
  { bg: '#f6d9cf', fg: '#3a2620', muted: '#7a5a4e', rule: 'rgba(58,38,32,0.16)', sig: '#3a2620' },
  { bg: '#f2b8a2', fg: '#3a2620', muted: '#3a2620', rule: 'rgba(58,38,32,0.18)', sig: '#3a2620' },
  { bg: '#d9a441', fg: '#3a2620', muted: '#3a2620', rule: 'rgba(58,38,32,0.2)', sig: '#3a2620' },
  { bg: '#3f6b57', fg: '#fbf3ea', muted: '#fbf3ea', rule: 'rgba(251,243,234,0.24)', sig: '#fbf3ea' },
  { bg: '#c23b32', fg: '#ffffff', muted: '#ffffff', rule: 'rgba(255,255,255,0.28)', sig: '#ffffff' },
];

export const pen = (i) => PENS[i] || PENS[0];
export const paper = (i) => PAPERS[i] || PAPERS[0];

export const SITE = () => (process.env.SITE_URL || 'http://localhost:8080').replace(/\/$/, '');

// "Acordei antes do sol só pra te contar" → "acordei-antes-do-sol-so-pra"
export function slugify(text, words = 6) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).slice(0, words).join('-').slice(0, 60).replace(/-+$/, '');
}

export const letterPath = (l) => { const s = slugify(l.text); return `/carta/${l.num}${s ? '-' + s : ''}/`; };
export const letterUrl = (l) => SITE() + letterPath(l);

// Trecho para título e descrição: corta em palavra inteira.
export function excerpt(text, max) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6))
    .replace(/\s+\S{1,2}$/, '') // não termina em "o…", "de…"
    .replace(/[\s,.;:!?—-]+$/, '') + '…';
}
