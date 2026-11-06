// Garante que toda tela em telas/ (inclusive as novas) siga o design system.
// Regras vêm de design-system/tokens.json e do brand book (design-system/README.md).
import tokens from '../design-system/tokens.json' with { type: 'json' };

const hex = (h) => { h = h.slice(1).toLowerCase(); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return h.slice(0, 6); };
const rgbHex = (r, g, b) => [r, g, b].map((n) => Number(n).toString(16).padStart(2, '0')).join('');

const PALETTE = new Set(tokens.color.tokens.flatMap((t) => Object.values(t.value)).map(hex));
// cores das sombras do DS (ex.: preto translúcido do tema Night) também valem
for (const m of JSON.stringify(tokens.shadow).matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)) PALETTE.add(rgbHex(m[1], m[2], m[3]));
const FONTS = new Set(Object.values(tokens.type.families).map((f) => f.split(',')[0].replace(/["']/g, '').trim()));
const tokenList = () => tokens.color.tokens.map((t) => `${t.name} ${t.value.day}`).join(', ');

export function lintDS(file, src) {
  const errs = [];
  const line = (i) => src.slice(0, i).split('\n').length;
  for (const m of src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    if (/href="#|id=|&#$/.test(src.slice(Math.max(0, m.index - 6), m.index + 1))) continue; // âncoras e entidades (&#8212;), não cor
    if (!PALETTE.has(hex(m[0]))) errs.push(`${file}:${line(m.index)} cor ${m[0]} fora dos tokens (${tokenList()})`);
  }
  for (const m of src.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?/g)) {
    if (m[4] !== undefined && Number(m[4]) === 0) continue; // transparente
    if (!PALETTE.has(rgbHex(m[1], m[2], m[3]))) errs.push(`${file}:${line(m.index)} cor ${m[0]}) fora dos tokens`);
  }
  // font-family no CSS e "family:" na lógica: a primeira fonte precisa ser uma das famílias do DS
  for (const m of src.matchAll(/(?:font-family:\s*|family:\s*["'])\s*(['"]?)([^'",;]+)\1/g)) {
    const name = m[2].trim();
    if (name === 'inherit' || name.startsWith('{{')) continue;
    if (!FONTS.has(name)) errs.push(`${file}:${line(m.index)} fonte "${name}" fora do DS (${[...FONTS].join(', ')})`);
  }
  for (const m of src.matchAll(/\p{Emoji_Presentation}/gu)) errs.push(`${file}:${line(m.index)} emoji "${m[0]}" (o DS proíbe emoji na interface)`);
  for (const m of src.matchAll(/<button(?![^>]*\btype=)[^>]*>/g)) errs.push(`${file}:${line(m.index)} <button> sem type (vira submit dentro de <form>)`);
  for (const m of src.matchAll(/<img(?![^>]*\balt=)[^>]*>/g)) errs.push(`${file}:${line(m.index)} <img> sem alt`);
  if (/>\s*Letterclub\b|LetterClub/.test(src)) errs.push(`${file}: a marca é sempre "letterclub", em minúsculas`);
  return errs;
}
