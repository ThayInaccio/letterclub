// Templates dos e-mails do clube. HTML com estilo inline (clientes de e-mail ignoram <style>)
// e fontes de sistema: Georgia faz o papel da Instrument Serif, já que ninguém carrega webfont em e-mail.
const SITE = () => (process.env.SITE_URL || 'http://localhost:8080').replace(/\/$/, '');
const C = { paper: '#fbf3ea', raised: '#fffaf4', ink: '#3a2620', muted: '#7a5a4e', coral: '#c23b32', line: '#e8d5c6' };
const PAPERS = [
  { bg: '#fffaf4', fg: '#3a2620' }, { bg: '#f6d9cf', fg: '#3a2620' }, { bg: '#f2b8a2', fg: '#3a2620' },
  { bg: '#d9a441', fg: '#3a2620' }, { bg: '#3f6b57', fg: '#fbf3ea' }, { bg: '#c23b32', fg: '#ffffff' },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function shell(title, inner, footer) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Georgia,'Times New Roman',serif;color:${C.ink};">
<tr><td style="padding:0 0 24px;font-size:30px;color:${C.coral};">letterclub</td></tr>
${inner}
<tr><td style="padding:32px 0 0;border-top:1px solid ${C.line};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${C.muted};">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

export function confirmation(link) {
  const html = shell('Confirme sua entrada no clube', `
<tr><td style="font-size:32px;line-height:38px;padding:0 0 16px;">Falta só um clique.</td></tr>
<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:${C.ink};padding:0 0 28px;">
Alguém (tomara que você) pediu pra receber a Caixa do letterclub: as cartas mais curtidas do mural, toda sexta de manhã.</td></tr>
<tr><td style="padding:0 0 28px;"><a href="${esc(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${C.coral};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;text-decoration:none;">Confirmar e entrar no clube</a></td></tr>`,
    'Se não foi você, é só ignorar este e-mail: sem o clique, ninguém entra no clube.');
  const text = `Falta só um clique.\n\nConfirme sua entrada no clube do letterclub:\n${link}\n\nSe não foi você, ignore este e-mail.`;
  return { subject: 'Confirme sua entrada no clube', html, text };
}

export function weekly(letters, unsubLink, weekLabel) {
  const cards = letters.map((l) => {
    const p = PAPERS[l.paper] || PAPERS[0];
    const url = `${SITE()}/mural/#carta-${l.id}`;
    return `<tr><td style="padding:0 0 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.bg};color:${p.fg};border-radius:10px;">
<tr><td style="padding:24px 26px 6px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;">${esc((l.city + ' · ' + l.hour + 'h').toUpperCase())}</td></tr>
<tr><td style="padding:6px 26px 10px;font-size:20px;line-height:30px;font-style:italic;">${esc(l.text)}</td></tr>
<tr><td style="padding:0 26px 22px;font-size:15px;font-style:italic;">— alguém de ${esc(l.city)} · <a href="${esc(url)}" style="color:${p.fg};">ler no mural</a></td></tr>
</table></td></tr>`;
  }).join('');
  const html = shell('A Caixa da semana', `
<tr><td style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;color:${C.muted};padding:0 0 8px;">A CAIXA · ${esc(weekLabel)}</td></tr>
<tr><td style="font-size:32px;line-height:38px;padding:0 0 24px;">As cartas mais curtidas da semana.</td></tr>
${cards}
<tr><td style="padding:8px 0 28px;"><a href="${SITE()}/escrever/" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${C.coral};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;text-decoration:none;">Escrever uma carta</a></td></tr>`,
    `Você recebe isto porque entrou no clube do letterclub. <a href="${esc(unsubLink)}" style="color:${C.muted};">Sair do clube</a> — um clique e pronto.`);
  const text = 'As cartas mais curtidas da semana\n\n' +
    letters.map((l) => `${l.text}\n— alguém de ${l.city}, às ${l.hour}h\n${SITE()}/mural/#carta-${l.id}`).join('\n\n') +
    `\n\nSair do clube: ${unsubLink}`;
  return { subject: 'A Caixa da semana: as cartas mais curtidas', html, text };
}
