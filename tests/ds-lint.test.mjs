// O lint de DS precisa pegar violações e não acusar telas válidas.
import assert from 'node:assert';
import fs from 'node:fs';
import { lintDS } from '../build/ds-lint.mjs';

const bad = lintDS('bad', `<div style="color:#123456; font-family: 'Comic Sans MS'; box-shadow: 0 0 2px rgba(10,20,30,0.3)"><button>oi 🎉</button><img src="x.png"><p>LetterClub</p></div>`);
for (const rule of ['#123456', 'Comic Sans MS', 'rgba(10,20,30', 'emoji', '<button>', '<img>', 'minúsculas']) {
  assert(bad.some((e) => e.includes(rule)), `lint não pegou: ${rule}`);
}

const good = lintDS('good', `<a href="#planos">x &#8212; y</a><div style="color: #3A2620; background: rgba(0,0,0,0); box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-family: 'Work Sans', Arial"><button type="button">Enviar carta</button></div>`);
assert.deepStrictEqual(good, []);

for (const f of fs.readdirSync('telas').filter((f) => f.endsWith('.dc.html'))) {
  assert.deepStrictEqual(lintDS(f, fs.readFileSync('telas/' + f, 'utf8')), [], f);
}
console.log('✓ ds-lint');
