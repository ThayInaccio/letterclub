# letterclub

Clube de cartas anônimas, escritas com calma. Pessoas escrevem para desconhecidos — sem nome, sem perfil — e a cidade e a hora viram a assinatura. A identidade nasce de *Her* (2013).

Este repositório guarda as telas e o design system, um build que transforma as telas em site estático pré-renderizado (SEO) e a API em `server/` (Node + Postgres). Tudo sobe em Docker. Veja as pendências antes de abrir ao público.

## Estrutura

```
letterclub/
├── site.config.mjs      # rota, título, descrição e indexação de cada página
├── build/
│   ├── build.mjs        # telas/*.dc.html → dist/ (HTML pré-renderizado + bundle)
│   ├── runtime.js       # substitui o support.js do canvas (Preact)
│   └── ds-lint.mjs      # regras do design system, rodam em todo build
├── server/              # API: index.js (rotas, sessão), cartas.js, clube.js, pedidos.js, schema.sql
├── tests/               # ds-lint, api (integração) e smoke (Chrome headless)
├── Dockerfile           # alvos web (nginx) e api (Node)
├── docker-compose.yml   # Postgres + API + web local
├── nginx.conf
├── design-system/
│   ├── README.md        # brand book: princípios, voz, cor, tipografia, movimento
│   └── tokens.json      # tokens de cor (Day/Night), tipografia, espaço, raio e sombra
└── telas/
    ├── canvas.json      # índice do canvas: posição e ordem das pranchetas
    ├── Main.dc.html     # home: abertura animada + pôster + seção de cartas
    ├── Cartas.dc.html   # conceito + carrossel de cartas
    ├── Escrever.dc.html # editor com prévia em tempo real, ditado por voz e rascunho automático
    ├── Mural.dc.html    # mural público, favoritar e compartilhar (Stories/feed)
    ├── Caixa.dc.html    # caixa de correio: recebidas, enviadas, rascunhos
    ├── Correio.dc.html  # checkout do correio físico — oculto (site.config `hidden`) até haver pagamento
    ├── Clube.dc.html    # assinatura: newsletter, conteúdo exclusivo, 2 cartas/mês
    ├── CartasSecao.dc.html  # componente: conceito + carrossel (usado na home e em Cartas)
    └── Selo.dc.html         # componente: selo postal (12 desenhos)
```

### Sobre os arquivos `.dc.html`

São componentes no formato do canvas de design do Claude: HTML com marcação de template (`{{valor}}`, `<sc-for>`, `<sc-if>`, `<dc-import>`) e uma classe `Component` com a lógica de cada tela. Eles continuam sendo a fonte de verdade: o build lê os arquivos sem alterá-los, renderiza cada página no servidor (o HTML já chega com o conteúdo, bom para buscadores) e hidrata a interatividade no navegador com Preact, que tem a mesma API (`state`, `setState`, `componentDidMount`). Links `X.dc.html` viram rotas limpas (`/escrever/`). As telas falam com a API por `this.api(método, caminho, corpo)`, que vem desse runtime (`build/runtime.js`); no canvas de design essas chamadas falham, e as telas ficam com o estado inicial.

## Rodar

```sh
npm ci
docker compose up --build        # Postgres + API + site em http://localhost:8080
```

Testes (com o stack no ar; o atraso 0 deixa a carta pronta na hora, pra testar a entrega):

```sh
DELIVERY_DELAY_SECONDS=0 docker compose up -d --build
BASE_URL=http://localhost:8080 npm test   # lint do DS + API + clique em tudo no Chrome headless
```

`npm run build` sozinho gera só o site estático em `dist/`.

## Backend

`server/` é uma API Node (`node:http` + `pg`) sobre Postgres. O nginx serve o site e repassa `/api/` para ela.

- **Identidade anônima**: ninguém cria conta. Na primeira ação, o navegador recebe um cookie `lc_sid` (`HttpOnly`, `SameSite=Lax`, `Secure`) com um token aleatório; o banco guarda só o hash. O cookie é a caixa de correio: se a pessoa limpar o navegador, a caixa some.
- **Entrega**: a carta fica pronta 2 dias depois de enviada. Quem abre a Caixa recebe a carta pronta mais antiga de outra pessoa, no máximo uma por dia. O sorteio usa `FOR UPDATE SKIP LOCKED`, então várias réplicas nunca entregam a mesma carta.
- **Mural**: só quem escreveu pendura a própria carta, depois de um aviso de que ela fica pública (inclusive no Google). Favoritar manda o estado desejado (não "inverter"), então clique duplo não conta duas vezes.
- **Páginas para busca (SEO)**: `server/paginas.js` renderiza no servidor uma página por carta do mural (`/carta/<num>-<slug>/`) e uma por tema (`/temas/<slug>/`, com texto editorial de `server/temas.js`), com canonical, JSON-LD (`CreativeWork`, `CollectionPage`, `BreadcrumbList`) e imagem de prévia 1200×630 gerada no servidor (`server/og.js`, resvg com as fontes do DS em `server/fonts/`). Slug errado ou sem barra → 301 pro canônico; carta tirada do mural → 410. `/sitemap.xml` é um índice: `sitemap-paginas.xml` (do build) + `sitemap-cartas.xml` (temas e cartas aprovadas, gerado na hora).
- **Moderação**: carta pendurada entra no mural na hora, mas com `noindex` e fora do sitemap até ser aprovada em `/moderar` (precisa de `ADMIN_TOKEN`; sem ele a página e `/api/admin/*` respondem 404). Na moderação dá pra trocar o tema. Qualquer pessoa pode denunciar uma carta (uma denúncia por sessão); com `REPORTS_TO_HIDE` denúncias ela sai do ar e volta pra fila. Tema com menos de `MIN_CARTAS_TEMA` cartas aprovadas fica `noindex`.
- **Visitas**: com `UMAMI_WEBSITE_ID`, o site e as páginas de carta carregam o Umami (sem cookie, sem banner).
- **Clube (grátis)**: inscrição só com e-mail e confirmação dupla (link de uso único, vale 7 dias, não reenvia antes de 2 min). Toda sexta, `server/semanal.js` manda a Caixa: as 5 cartas do mural mais favoritadas nos últimos 7 dias. É idempotente por semana (`digest_sends`): rodar de novo só completa quem faltou. Todo e-mail tem link de saída e `List-Unsubscribe` one-click (Gmail/Apple Mail).
- **E-mail**: `server/mailer.js` envia por SMTP (Hostinger, Gmail, SES, Resend…). Sem `SMTP_HOST` nada sai: a inscrição funciona, mas confirmação e Caixa só aparecem no log.
- **Correio físico (desligado)**: `/api/pedidos` só existe com `FEATURE_CORREIO=true`; o total é sempre calculado no servidor (`server/pedidos.js`).
- **Banco**: `server/schema.sql` é idempotente e roda a cada boot sob advisory lock; o mural começa com o acervo do protótipo.
- **Proteções**: só aceita `application/json` (bloqueia CSRF por formulário), corpo até 16 KB, validação de todo campo, 20 cartas por dia por sessão, limite por IP no nginx.

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/health` | saúde (consulta o banco) |
| GET | `/api/caixa` | entrega a carta do dia e lista recebidas e enviadas |
| POST | `/api/cartas` | envia uma carta |
| POST | `/api/cartas/:id/abrir` · `/guardar` · `/mural` | abrir, guardar, pendurar no mural |
| GET | `/api/mural` | cartas públicas (não cria sessão) |
| POST | `/api/mural/:id/favorito` | favoritar `{ fav: true\|false }` |
| POST | `/api/mural/:id/denunciar` | denunciar uma carta do mural |
| GET · POST | `/api/admin/fila` · `/api/admin/cartas/:id` | moderação `{ acao: 'aprovar'\|'ocultar', theme? }` (header `Authorization: Bearer $ADMIN_TOKEN`) |
| GET | `/carta/:num-:slug/` · `/temas/` · `/temas/:slug/` | páginas públicas (HTML) |
| GET | `/og/carta/:num.png` · `/og/tema/:slug.png` · `/og/site.png` | imagens de prévia |
| GET | `/sitemap.xml` · `/sitemap-cartas.xml` · `/moderar` | sitemaps e página de moderação |
| POST | `/api/clube` | entrar no clube `{ email, city? }` → manda o e-mail de confirmação |
| GET | `/api/clube/confirmar?t=` | link do e-mail → confirma e volta para `/clube/?confirmado=1` |
| GET · POST | `/api/clube/sair?t=` | sair do clube (link do e-mail e one-click) |
| POST | `/api/pedidos` | pedido do correio (só com `FEATURE_CORREIO=true`) |

Variáveis da API: `DATABASE_URL` (obrigatória; em produção vem do Secrets Manager / External Secrets, com `sslmode=verify-full` no RDS), `PORT` (3000), `COOKIE_SECURE` (`false` só em http local), `DELIVERY_DELAY_SECONDS` (172800), `LETTERS_PER_DAY` (20), `DB_POOL_MAX` (10), `SITE_URL` (links dos e-mails), `SMTP_HOST`, `SMTP_PORT` (465), `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (`letterclub <cartas@letterclub.io>`), `DIGEST_SIZE` (5), `FEATURE_CORREIO` (desligado), `ADMIN_TOKEN` (moderação; 24+ caracteres aleatórios), `REPORTS_TO_HIDE` (3), `MIN_CARTAS_TEMA` (3), `UMAMI_WEBSITE_ID` (contador de visitas; também no serviço web, que usa no build).

Caixa semanal: `node server/semanal.js` (envia) ou `node server/semanal.js --previa` (só mostra quais cartas iriam).

## Docker

```sh
docker build --target api -t letterclub-api:<versão> .
docker build --build-arg SITE_URL=https://seu-dominio -t letterclub-web:<versão> .
```

- **web**: nginx sem root na porta 8080, health check em `/healthz`. `SITE_URL` é obrigatório (canonical, `og:url`, sitemap). `API_UPSTREAM` aponta para a API (padrão `http://api:3000`).
- **api**: Node na porta 3000, usuário sem root, health check em `/api/health`, encerra limpo no SIGTERM.
- Atrás de load balancer, configure `real_ip` no `nginx.conf` para o limite por IP valer por pessoa, não por LB.

## Deploy no Railway

Projeto `talented-emotion`, ambiente `production`, quatro serviços. `web`, `api` e `semanal` saem deste repositório (branch `main`, deploy automático a cada push). Domínio: `letterclub.io` e `www.letterclub.io` (DNS na Hostinger).

| Serviço | Público? | Variáveis | Health check / agenda |
|---|---|---|---|
| **Postgres** | não | (do Railway) | — |
| **api** | não, só rede privada | `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `PORT=3000`, `RAILWAY_DOCKERFILE_PATH=Dockerfile.api`, `SITE_URL=https://letterclub.io`, `ADMIN_TOKEN`, `SMTP_*`, `MAIL_FROM`, `UMAMI_WEBSITE_ID` | `/api/health` |
| **web** | sim, porta 8080 | `SITE_URL=https://letterclub.io`, `API_UPSTREAM=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3000`, `PORT=8080`, `RAILWAY_DOCKERFILE_PATH=Dockerfile`, `UMAMI_WEBSITE_ID` | `/healthz` |
| **semanal** | não | as mesmas da `api`; start command `node server/semanal.js` | cron `47 11 * * 5` (sexta, 8h47 em Brasília) |

- A configuração fica na interface do Railway (o config-as-code em arquivo foi descontinuado por eles).
- `Dockerfile.api` existe porque o Railway não escolhe um `--target`; mantenha igual ao estágio `api` do `Dockerfile`.
- `SITE_URL` entra no build da web como build arg (canonical, `og:url`, sitemap). Com domínio próprio, troque para `https://seu-dominio` e refaça o deploy.
- O nginx pega o IP do cliente do **último** endereço do `X-Forwarded-For` (o que a borda do Railway acrescenta), então o limite por IP vale por pessoa.

## Telas novas

1. Crie `telas/NomeDaTela.dc.html` no mesmo formato.
2. Se for página, registre em `site.config.mjs` (rota, título, descrição; `index: false` para páginas pessoais). Se for componente, importe com `<dc-import>`. O build falha se a tela não estiver em nenhum dos dois.
3. O build roda o lint do design system e **falha** em: cor fora de `design-system/tokens.json`, fonte fora das famílias do DS, emoji, `<button>` sem `type`, `<img>` sem `alt` e marca fora de minúsculas.
4. Rode `npm test`: novas páginas e botões entram no teste sozinhos.

## Fluxo do produto

1. **Home** → abertura no estilo "sistema operacional carregando", pôster com a carta saindo do envelope.
2. **Escrever** → escolhe caneta (cursiva, pena fina, letra de forma), papel e cidade; vê a carta se escrevendo do lado; pode ditar por voz; o rascunho se salva sozinho.
3. **Enviar** → a carta vai pra alguém do clube (chega em 2 dias).
4. **Caixa** → recebidas (envelopes que abrem), enviadas (com opção de pendurar no mural) e rascunhos.
5. **Mural** → cartas públicas, favoritas e compartilhamento como imagem.
6. **Clube** → plano Leitor (grátis) e Membro (newsletter quinzenal, textos inéditos, 2 cartas por mês em casa).

## Decisões de design

- **Anonimato em tudo**: nenhuma tela mostra nome; endereços nunca são vistos por quem escreve.
- **Devagar é o ponto**: sem badges vermelhos ou contadores; status sempre com palavra ("a caminho", "entregue").
- **Contraste**: texto ≥ 4,5:1; ocre nunca é cor de texto sobre vermelho; vermelho da marca na home usa `coral-deep` (#c23b32).
- **Movimento** lento (240–800 ms) e respeitando `prefers-reduced-motion`.

## Pendências para a implementação

- **Pagamentos**: gateway ainda a decidir (Mercado Pago × Stripe). Por isso o correio físico está oculto (tela fora do build, rota atrás de `FEATURE_CORREIO`) e o clube é só o plano grátis. Falta trocar os campos de cartão do Correio pelos campos seguros do gateway (tokenização no navegador), chamar o gateway em `server/pedidos.js` e `server/clube.js` e receber webhooks idempotentes.
- **Moderação automática**: hoje a fila é manual (`/moderar`). Com volume, vale um filtro de palavrões e de dados pessoais (telefone, e-mail) antes de entrar na fila.
- **LGPD**: e-mails e endereços ficam em `members` e `orders`; falta política de retenção e exclusão a pedido.
- **Preços**: todos os valores do correio (ocultos) são de exemplo.
- **Caligrafia traço a traço**: síntese neural exige modelo próprio (os modelos públicos não têm licença comercial e usam dados só para pesquisa). Plano: coletar letra de calígrafos e treinar modelo próprio, servido em `POST /handwriting`.
- **Fotos** do correio: só a contagem; o upload (S3) não existe.
- **Rascunho**: continua no navegador. Como a identidade também é do aparelho (cookie), levar o rascunho ao servidor só faz sentido quando houver login entre aparelhos.
- **Correio físico e plano pago do clube**: opt-in para receber cartas em casa, envios dos dias 5 e 20, curadoria e escritores convidados — tudo depende do pagamento.

## Tráfego orgânico

O que já está pronto: página própria por carta e por tema, sitemap dinâmico, dados estruturados, imagem de prévia por carta, links internos (mural → carta → tema → cartas parecidas), moderação antes de indexar.

Passos manuais:
1. **Google Search Console**: propriedade de domínio `letterclub.io`, verificada por registro TXT no DNS (Hostinger). Depois, enviar `https://letterclub.io/sitemap.xml`.
2. **Bing Webmaster Tools**: dá pra importar direto do Search Console.
3. **Umami**: criar o site em cloud.umami.is e pôr `UMAMI_WEBSITE_ID` na `api` e na `web`.
4. **Moderação**: definir `ADMIN_TOKEN` na `api` (ex.: `openssl rand -base64 32`) e aprovar cartas em `/moderar`.

Calendário editorial (publicar e divulgar a página do tema ~6 semanas antes, que é o tempo do Google indexar e ranquear):

| Data | Tema | Começar a divulgar |
|---|---|---|
| Dia das Mães (2º domingo de maio) | Cartas para a família | fim de março |
| Dia dos Namorados (12 de junho) | Cartas de amor | fim de abril |
| Dia do Amigo (20 de julho) | Cartas para amigos | começo de junho |
| Dia dos Pais (2º domingo de agosto) | Cartas para a família | fim de junho |
| Setembro Amarelo | Cartas para dias difíceis | começo de agosto |
| Finados (2 de novembro) | Cartas de saudade | meados de setembro |
| Natal e Ano-Novo | Cartas para a família / para um desconhecido | começo de novembro |
