# letterclub

Clube de cartas anônimas, escritas com calma. Pessoas escrevem para desconhecidos — sem nome, sem perfil — e a cidade e a hora viram a assinatura. A identidade nasce de *Her* (2013).

Este repositório guarda o **protótipo de design** do produto: as telas interativas e o design system. Ainda não é o código de produção.

## Estrutura

```
letterclub/
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
    ├── Correio.dc.html  # checkout pra mandar a carta pelo correio de verdade
    ├── Clube.dc.html    # assinatura: newsletter, conteúdo exclusivo, 2 cartas/mês
    ├── CartasSecao.dc.html  # componente: conceito + carrossel (usado na home e em Cartas)
    └── Selo.dc.html         # componente: selo postal (12 desenhos)
```

### Sobre os arquivos `.dc.html`

São componentes no formato do canvas de design do Claude: HTML com marcação de template (`{{valor}}`, `<sc-for>`, `<sc-if>`, `<dc-import>`) e uma classe `Component` com a lógica de cada tela. Eles dependem do runtime do canvas (`support.js`), então **não abrem direto no navegador** — servem como fonte de verdade de layout, copy, estados e interações para a implementação.

## Fluxo do produto

1. **Home** → abertura no estilo "sistema operacional carregando", pôster com a carta saindo do envelope.
2. **Escrever** → escolhe caneta (cursiva, pena fina, letra de forma), papel e cidade; vê a carta se escrevendo do lado; pode ditar por voz; o rascunho se salva sozinho.
3. **Enviar** → a carta vai pra alguém do clube (chega em 2 dias) — ou **pelo correio**, com papelaria, calígrafo, fotos e adicionais.
4. **Caixa** → recebidas (envelopes que abrem), enviadas (com opção de pendurar no mural) e rascunhos.
5. **Mural** → cartas públicas, favoritas e compartilhamento como imagem.
6. **Clube** → plano Leitor (grátis) e Membro (newsletter quinzenal, textos inéditos, 2 cartas por mês em casa).

## Decisões de design

- **Anonimato em tudo**: nenhuma tela mostra nome; endereços nunca são vistos por quem escreve.
- **Devagar é o ponto**: sem badges vermelhos ou contadores; status sempre com palavra ("a caminho", "entregue").
- **Contraste**: texto ≥ 4,5:1; ocre nunca é cor de texto sobre vermelho; vermelho da marca na home usa `coral-deep` (#c23b32).
- **Movimento** lento (240–800 ms) e respeitando `prefers-reduced-motion`.

## Pendências para a implementação

- **Pagamentos**: gateway ainda a decidir (Mercado Pago × Stripe). Proposta: porta `PaymentGateway` com adaptadores; total sempre calculado no servidor; webhooks idempotentes.
- **Preços**: todos os valores no protótipo são de exemplo.
- **Caligrafia traço a traço**: síntese neural exige modelo próprio (os modelos públicos não têm licença comercial e usam dados só para pesquisa). Plano: coletar letra de calígrafos e treinar modelo próprio, servido em `POST /handwriting`.
- **Rascunho**: no protótipo fica no navegador; em produção deve ir para o servidor (`PUT /cartas/rascunho` com debounce).
- **Correio físico e clube**: opt-in para receber cartas em casa; job agendado para os envios dos dias 5 e 20; fluxo de curadoria.
- **Escritores convidados** e o poema de exemplo no clube são placeholders.
