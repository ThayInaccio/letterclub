export function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

// ---- validação de entrada (tudo que vem do navegador) ----
export function int(v, min, max, name) {
  if (!Number.isInteger(v) || v < min || v > max) fail(400, `${name} inválido`);
  return v;
}
export function str(v, min, max, name) {
  if (typeof v !== 'string') fail(400, `${name} inválido`);
  const s = v.trim();
  if (s.length < min || s.length > max) fail(400, `${name} inválido`);
  return s;
}
export function oneOf(v, list, name) {
  if (!list.includes(v)) fail(400, `${name} inválido`);
  return v;
}
export function email(v) {
  const s = str(v, 3, 254, 'e-mail').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) fail(400, 'e-mail inválido');
  return s;
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---- datas no formato das telas ("05 NOV 2026"), no fuso do clube ----
const TZ = process.env.TZ_DISPLAY || 'America/Sao_Paulo';
const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const parts = (d) => ymd.format(d).split('-').map(Number); // [ano, mês, dia]

export function fmtDate(d) {
  const [y, m, day] = parts(d);
  return `${String(day).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}
export function fmtShort(d) {
  return fmtDate(d).slice(0, 6);
}
export function arrived(d, now = new Date()) {
  const key = (x) => ymd.format(x);
  if (key(d) === key(now)) return 'CHEGOU HOJE';
  if (key(d) === key(new Date(now.getTime() - 864e5))) return 'CHEGOU ONTEM';
  return 'CHEGOU ' + fmtShort(d);
}
