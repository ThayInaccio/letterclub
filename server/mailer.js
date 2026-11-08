// Envio de e-mail por SMTP (Hostinger, Gmail, SES, Resend… qualquer um).
// Sem SMTP_HOST o envio fica desligado: nada sai, e o log diz o que teria saído.
import nodemailer from 'nodemailer';

const HOST = process.env.SMTP_HOST;
const PORT = Number(process.env.SMTP_PORT || 465);
export const FROM = process.env.MAIL_FROM || 'letterclub <cartas@letterclub.io>';
export const enabled = !!HOST;

const transport = enabled
  ? nodemailer.createTransport({
      host: HOST, port: PORT, secure: PORT === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

// { to, subject, html, text, headers } → true se saiu, false se o envio está desligado
export async function send(msg) {
  if (!transport) {
    console.log(JSON.stringify({ level: 'warn', msg: 'SMTP não configurado; e-mail não enviado', to: msg.to.replace(/^(.).*@/, '$1***@'), subject: msg.subject }));
    return false;
  }
  await transport.sendMail({ from: FROM, ...msg });
  return true;
}
