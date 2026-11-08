// Contador de visitas sem cookie (Umami). Liga com UMAMI_WEBSITE_ID; sem ela, nada é carregado.
// Usado pelo build (páginas estáticas) e pelo servidor (páginas de carta e de tema).
export function analyticsTag(env = process.env) {
  const id = env.UMAMI_WEBSITE_ID;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return '';
  const src = env.UMAMI_SCRIPT_URL || 'https://cloud.umami.is/script.js';
  return `<script defer src="${src.replace(/"/g, '')}" data-website-id="${id}"></script>`;
}
