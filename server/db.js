import fs from 'node:fs';
import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
});

// conexão ociosa que cai (failover do RDS) não pode derrubar o processo; o pool reconecta
pool.on('error', (e) => console.error(JSON.stringify({ level: 'error', msg: 'pg pool: ' + e.message })));

export const q = (text, params) => pool.query(text, params);

export async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

// As cartas do mural do protótipo viram o acervo inicial (pen/paper nos índices do Escrever).
const SEED = [
  ['a1', 41, 'São Paulo', 23, 0, 0, 'cidade', 'Querida pessoa que eu não conheço, hoje a cidade estava barulhenta demais e eu pensei em você, que talvez também precise de um pouco de silêncio.'],
  ['a2', 88, 'Recife', 6, 1, 5, 'sol', 'Acordei antes do sol só pra te contar: o mar continua aqui. Ele espera sem pressa nenhuma.'],
  ['a3', 63, 'Porto Alegre', 19, 2, 3, 'cha', 'Não sei seu nome, mas sei que você chegou até o fim de mais um dia. Isso já é muita coisa. Toma um chá por mim.'],
  ['a4', 22, 'Belém', 14, 0, 4, 'chuva', 'Choveu às duas, como sempre. Aprendi que dá pra marcar encontro com a chuva. Talvez dê com você também.'],
  ['a5', 97, 'Lisboa', 2, 1, 2, 'lua', 'Escrevo de longe, com a janela aberta. Se você estiver triste, saiba que alguém acordado pensou em você.'],
  ['a6', 54, 'Belo Horizonte', 17, 2, 1, 'pao', 'Hoje aprendi a fazer pão. Ficou feio e muito gostoso. Acho que a maioria das coisas boas é assim.'],
  ['a7', 30, 'Salvador', 10, 2, 0, 'mar', 'Passei na frente do mar e lembrei que nem tudo precisa ser resolvido hoje. Nem por você.'],
  ['a8', 71, 'Curitiba', 7, 1, 4, 'frio', 'Faz frio aqui. Se fizer frio aí também, imagina que eu te emprestei um casaco.'],
  ['a9', 45, 'Rio de Janeiro', 21, 0, 3, 'riso', 'Ri sozinha no ônibus lembrando de uma bobagem. Espero que você ria de alguma coisa hoje.'],
  ['a10', 19, 'Manaus', 16, 1, 1, 'rio', 'O rio aqui é tão grande que parece mar. Às vezes a gente também é maior do que pensa.'],
  ['a11', 66, 'Fortaleza', 5, 2, 5, 'estrela', 'Não consegui dormir, então decidi escrever pra alguém. Oi. Obrigada por ler até aqui.'],
  ['a12', 38, 'Florianópolis', 12, 0, 2, 'ponte', 'Almocei olhando a ponte e pensei: tem gente do outro lado de tudo. Inclusive você.'],
];

// Carta de boas-vindas: toda caixa nova já começa com uma.
export const WELCOME = { city: 'Curitiba', hour: 22, pen: 1, paper: 1, stamp: 'frio',
  text: 'Hoje o dia foi cinza do começo ao fim. Mas encontrei um café bom e pensei que alguém merecia saber. Esse alguém é você.' };

export async function migrate() {
  await tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(4242)');
    await c.query(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
    for (const [i, [key, saves, city, hour, pen, paper, stamp, text]] of SEED.entries()) {
      await c.query(
        `INSERT INTO letters (seed_key, saves, city, hour, pen, paper, stamp, text, created_at, published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now() - make_interval(hours => $9), now() - make_interval(hours => $9))
         ON CONFLICT (seed_key) DO NOTHING`,
        [key, saves, city, hour, pen, paper, stamp, text, i * 10]);
    }
  });
}
