// SMTP de mentira para testes: aceita tudo e grava cada e-mail em MAIL_DIR/<n>.eml.
// Uso: MAIL_DIR=/tmp/lc-mail node tests/smtp-sink.mjs   (porta SMTP_SINK_PORT, padrão 2525)
// Na API: SMTP_HOST=127.0.0.1 SMTP_PORT=2525 (sem TLS, sem senha).
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.MAIL_DIR || path.join(process.cwd(), '.mail');
const PORT = Number(process.env.SMTP_SINK_PORT || 2525);
fs.mkdirSync(DIR, { recursive: true });
let n = fs.readdirSync(DIR).length;

net.createServer((sock) => {
  let buf = ''; let data = false; let rcpt = [];
  const say = (s) => sock.write(s + '\r\n');
  say('220 sink');
  sock.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    while (true) {
      if (data) {
        const end = buf.indexOf('\r\n.\r\n');
        if (end < 0) return;
        const body = buf.slice(0, end); buf = buf.slice(end + 5); data = false;
        fs.writeFileSync(path.join(DIR, `${String(++n).padStart(5, '0')}.eml`), `X-Sink-To: ${rcpt.join(', ')}\r\n${body}`);
        rcpt = [];
        say('250 ok');
        continue;
      }
      const i = buf.indexOf('\r\n');
      if (i < 0) return;
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      const cmd = line.slice(0, 4).toUpperCase();
      if (cmd === 'EHLO' || cmd === 'HELO') say('250 sink');
      else if (cmd === 'RCPT') { rcpt.push(line.replace(/^RCPT TO:\s*/i, '').replace(/[<>]/g, '')); say('250 ok'); }
      else if (cmd === 'DATA') { data = true; say('354 go'); }
      else if (cmd === 'QUIT') { say('221 bye'); sock.end(); return; }
      else say('250 ok'); // MAIL, RSET, NOOP…
    }
  });
}).listen(PORT, '127.0.0.1', () => console.log(`smtp-sink em 127.0.0.1:${PORT} → ${DIR}`));
