// Substitui o support.js do canvas: interpreta os templates .dc.html com Preact.
// Roda igual no build (SSR) e no navegador (hydrate).
import { Component, h } from 'preact';

const registry = {};
const ONE = /^\{\{\s*([\w$.]+)\s*\}\}$/;
const ANY = /\{\{\s*([\w$.]+)\s*\}\}/g;

const get = (scope, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);

// "{{x}}" sozinho devolve o valor cru (função, boolean, número); misturado com texto vira string.
function val(str, scope) {
  const m = ONE.exec(str);
  if (m) return get(scope, m[1]);
  return str.replace(ANY, (_, p) => { const v = get(scope, p); return v == null ? '' : v; });
}

function props(attrs, scope) {
  const out = {};
  for (const k in attrs) out[k] = val(attrs[k], scope);
  return out;
}

// Nó compacto: string (texto) ou [tag, attrs, filhos].
function node(n, scope) {
  if (typeof n === 'string') return val(n, scope);
  const [tag, attrs, kids] = n;
  if (tag === 'sc-for') {
    const list = val(attrs.list, scope) || [];
    return list.map((item) => {
      const s = Object.create(scope);
      s[attrs.as] = item;
      return nodes(kids, s);
    });
  }
  if (tag === 'sc-if') return val(attrs.value, scope) ? nodes(kids, scope) : null;
  if (tag === 'dc-import') {
    const { name, ...rest } = props(attrs, scope);
    if (!registry[name]) throw new Error('dc-import desconhecido: ' + name);
    return h(registry[name], rest);
  }
  return h(tag, props(attrs, scope), nodes(kids, scope));
}

const nodes = (list, scope) => list.map((n) => node(n, scope));

export class DCLogic extends Component {
  renderVals() { return {}; }
  // Chamada à API (mesma origem, cookie da sessão anônima). Erro carrega status e mensagem do servidor.
  async api(method, path, body) {
    const post = method !== 'GET';
    const res = await fetch('/api' + path, {
      method,
      headers: post ? { 'Content-Type': 'application/json' } : {},
      body: post ? JSON.stringify(body || {}) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'erro'), { status: res.status });
    return data;
  }
  render() { return nodes(this.constructor.tpl, this.renderVals() || {}); }
}

export function define(name, tpl, Cls) {
  Cls.tpl = tpl;
  registry[name] = Cls;
  return Cls;
}
