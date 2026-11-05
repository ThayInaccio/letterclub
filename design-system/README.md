letterclub é um clube de cartas anônimas. Pessoas escrevem para desconhecidos, sem nome nem perfil — só palavras, com a calma de quem escreve à mão. A identidade nasce de *Her* (2013): a Los Angeles de um futuro próximo, quente e macia, onde Theodore escreve cartas bonitas para os outros. Aqui o ofício é de todo mundo.

## Princípios

- **Calor, não tecnologia.** A interface some; o papel fica. Nada de neon, glassmorphism, gradientes azul-roxo ou brilho de "app de IA".
- **Devagar é o ponto.** Cartas levam tempo para chegar (e isso aparece no design: carimbos, "a caminho", datas). Não use contadores, badges vermelhos de notificação ou urgência.
- **Anonimato com carinho.** Ninguém tem rosto. Use a cidade e o horário como identidade: "alguém de São Paulo, às 23h".
- **Minúsculas.** A marca é sempre `letterclub`, em minúsculas, como o título do filme.

## Voz e conteúdo

- Português, segunda pessoa, íntimo e simples: "Escreva para alguém", "Uma carta chegou pra você".
- Frases curtas, sem jargão de produto. Diga "carta", "envelope", "selo", "caixa de correio" — nunca "mensagem", "post", "feed" ou "DM".
- Sem emoji na interface. O único ornamento é tipográfico (itálico da serifa, a letra manuscrita).
- Exemplos reais: botão primário "Enviar carta"; estado vazio "Sua caixa está vazia. Por enquanto."; confirmação "Sua carta está a caminho."

## Cor

- Fundo sempre `paper` (creme no Day, marrom quase preto no Night — LA à noite, janelas acesas).
- Texto em `ink`; secundário em `ink-muted`. Destaques e links em `coral-deep`.
- `coral`, `peach` e `ochre` são as cores da identidade (as camisas do Theodore, os figurinos mostarda, o pôr do sol). Use-as em blocos grandes, lacres e ilustrações — nunca em texto pequeno.
- `blush` é a tinta de relevo: fundos de selos, hover, faixas.
- Botão primário: fundo `coral-deep`, texto `on-coral`.
- Estados levam sempre a palavra junto: "a caminho" (`ink-muted`), "entregue" (`sage`). Nunca diferencie só por cor.
- Proporção recomendada numa tela: ~70% `paper`, ~20% `paper-raised`/`blush`, ~10% coral/pêssego/ocre.

## Tipografia

- `display` e `title` em Instrument Serif: marca, heróis, títulos. `title-italic` para frases poéticas e saudações.
- Interface em Work Sans: `body`, `label`, `caption`.
- O conteúdo das cartas é **sempre** escrito à mão. Quem escreve escolhe uma de três canetas, e a carta chega nela:
  - **cursiva** — `letter`, Homemade Apple. A padrão: cursiva ligada, de tinta, como uma carta de verdade.
  - **pena fina** — `letter-fine`, La Belle Aurore. Cursiva delicada e inclinada.
  - **letra de forma** — `letter-print`, Caveat. Manuscrita solta e a mais legível; é a opção de acessibilidade.
- A assinatura é sempre cursiva (`signature`), em `coral-deep`, seja qual for a caneta.
- As três canetas usam entrelinha de 36px, casada com a pauta do papel. Não mude.
- Fontes manuscritas nunca entram na UI (botões, menus, rótulos) — exceto no próprio seletor de caneta, onde cada opção aparece escrita nela.
- `postmark` (IBM Plex Mono, caixa alta, espaçado) só para datas, cidades e códigos — a camada "correio".
- Fontes vêm do Google Fonts: Instrument Serif (400, 400 itálico), Work Sans (400, 500), Homemade Apple, La Belle Aurore, Caveat (400, 600), IBM Plex Mono (500).

## Espaço, forma e profundidade

- Escala de 4px: `space-1` … `space-18`. Gutter mobile `space-4`; padding de envelope `space-6`; margem do papel `space-8`.
- Botões são pílulas (`radius-pill`); papel e envelopes `radius-md`; selos `radius-sm` (com borda serrilhada simulada por tracejado).
- Profundidade é papel sobre a mesa: `shadow-paper` em repouso, `shadow-lift` em hover. Nada de sombras duras.
- O papel de carta tem pauta: linhas `line` a cada 36px, alinhadas à entrelinha de `letter`.

## Movimento

- Lento e orgânico: 240–400ms, `ease-out`. Envelope sobe 2px no hover; carta abre deslizando do envelope.
- Respeite `prefers-reduced-motion`: troque deslizes por fade.

## Foco e acessibilidade

- Anel de foco: 2px sólido `ink` com 2px de afastamento, em todos os elementos interativos (≥3:1 sobre qualquer superfície nos dois temas).
- Contraste de texto ≥4,5:1 garantido nos pares descritos nos tokens; `coral` puro não é cor de texto.

## Iconografia

- Ainda não há conjunto de ícones próprio. Use traço fino (1.5px), cantos arredondados, desenho de linha — Phosphor (peso Light) é a referência mais próxima. Ícones na cor do texto ao redor.
- Logo: ainda não existe marca desenhada; a marca é a palavra `letterclub` em `display`.
