// A lista de temas do Escrever (tela) precisa bater com server/temas.js (validação e páginas).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TEMAS } from '../server/temas.js';

const tela = fs.readFileSync(new URL('../telas/Escrever.dc.html', import.meta.url), 'utf8');
const naTela = [...tela.matchAll(/\{ id: '([a-z-]+)', label: '([^']+)' \}/g)].map((m) => ({ id: m[1], label: m[2] }));
assert.deepEqual(naTela, TEMAS.map(({ id, label }) => ({ id, label })), 'temas do Escrever iguais aos do servidor');
for (const f of ['Mural', 'Main']) {
  const html = fs.readFileSync(new URL(`../telas/${f}.dc.html`, import.meta.url), 'utf8');
  for (const t of TEMAS) assert.ok(html.includes(`/temas/${t.slug}/`), `${f} linka /temas/${t.slug}/`);
}
assert.equal(new Set(TEMAS.map((t) => t.slug)).size, TEMAS.length, 'slugs únicos');
console.log('✓ temas');
