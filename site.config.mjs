// SEO e rotas de cada tela. As telas em telas/ não mudam; isto só alimenta o <head> e o sitemap.
// index: false → noindex e fora do sitemap (páginas pessoais ou de checkout).
export default {
  name: 'letterclub',
  locale: 'pt_BR',
  themeColor: '#c23b32',
  // Telas guardadas no repositório mas fora do site até a feature estar pronta (o build ignora).
  // Correio: mandar a carta pelo correio físico depende de gateway de pagamento.
  hidden: ['Correio'],
  pages: {
    Main: {
      route: '/',
      title: 'letterclub — cartas anônimas, escritas com calma',
      description: 'Um clube de cartas anônimas. Escreva para alguém que você não conhece — sem nome, sem perfil. A cidade e a hora viram a sua assinatura.',
    },
    Cartas: {
      route: '/cartas/',
      title: 'Cartas — letterclub',
      description: 'Cartas escritas à mão por pessoas de São Paulo, Recife, Lisboa e outras cidades, para desconhecidos. Leia algumas e escreva a sua.',
    },
    Escrever: {
      route: '/escrever/',
      title: 'Escrever uma carta — letterclub',
      description: 'Escolha a caneta, o papel e a cidade e escreva uma carta para alguém do clube. Ela chega em dois dias. Dá pra ditar por voz, e o rascunho se salva sozinho.',
    },
    Mural: {
      route: '/mural/',
      title: 'Mural de cartas — letterclub',
      description: 'O mural público do letterclub: cartas anônimas penduradas por quem escreveu. Guarde as favoritas e compartilhe como imagem.',
    },
    Clube: {
      route: '/clube/',
      title: 'O clube — letterclub',
      description: 'Entre no clube do letterclub e receba, toda semana, as cartas mais curtidas do mural no seu e-mail. De graça.',
    },
    Caixa: {
      route: '/caixa/',
      title: 'Sua caixa de correio — letterclub',
      description: 'Cartas recebidas, enviadas e rascunhos.',
      index: false,
    },
  },
};
