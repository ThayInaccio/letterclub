// Temas das cartas: o que a pessoa escolhe ao escrever e as páginas /temas/<slug>/.
// O id vai pro banco; o slug é a URL (com a palavra que as pessoas buscam).
// A lista curta (id + label) é repetida em telas/Escrever.dc.html; tests/temas.test.mjs garante que batem.

export const TEMAS = [
  {
    id: 'desconhecido',
    slug: 'cartas-para-um-desconhecido',
    label: 'para um desconhecido',
    name: 'Cartas para um desconhecido',
    title: 'Cartas para um desconhecido — cartas anônimas reais | letterclub',
    description: 'Cartas anônimas escritas para alguém que a pessoa nunca vai conhecer. Leia cartas reais de várias cidades e escreva a sua para um desconhecido.',
    intro: [
      'Escrever para quem você não conhece é um jeito estranho e bonito de ser sincero. Não tem histórico, não tem expectativa, não tem resposta pra esperar. Sobra só o que você queria dizer pro mundo naquele dia.',
      'As cartas abaixo foram escritas por pessoas reais do letterclub, sem nome e sem perfil. A cidade e a hora são a única assinatura. Algumas são sobre o tempo, outras sobre café, outras sobre aguentar mais um dia. Todas foram escritas pensando em alguém do outro lado, que pode muito bem ser você.',
    ],
    tips: [
      'Comece pelo concreto: o que você viu, ouviu ou comeu hoje. Detalhe pequeno aproxima mais do que frase de efeito.',
      'Escreva como se a pessoa estivesse cansada. Uma carta curta e gentil vale mais do que uma longa e perfeita.',
      'Não precisa de conselho. Às vezes "eu também" é tudo o que alguém precisava ler.',
    ],
  },
  {
    id: 'amor',
    slug: 'cartas-de-amor',
    label: 'de amor',
    name: 'Cartas de amor',
    title: 'Cartas de amor anônimas — textos reais escritos à mão | letterclub',
    description: 'Cartas de amor reais e anônimas: para o namorado, a namorada, um amor antigo ou um amor que ainda não chegou. Leia, inspire-se e escreva a sua.',
    intro: [
      'Toda carta de amor é meio desajeitada, e é por isso que funciona. Ninguém se apaixona por um texto perfeito: a gente se apaixona pelo jeito que alguém tenta explicar o que sente e quase consegue.',
      'Aqui estão cartas de amor anônimas escritas no letterclub. Tem amor de muitos anos, amor que acabou, amor que nunca foi dito em voz alta e amor por alguém que ainda nem apareceu. Leia sem pressa, e se der vontade, escreva a sua. Ninguém vai saber que foi você.',
    ],
    tips: [
      'Troque "eu te amo" por uma lembrança específica: o dia, o lugar, a frase boba que só vocês entendem.',
      'Fale do presente, não só do passado. O que essa pessoa muda no seu dia comum?',
      'Termine com algo simples e verdadeiro. Carta de amor não precisa de final de filme.',
    ],
  },
  {
    id: 'amizade',
    slug: 'cartas-para-amigos',
    label: 'para amigos',
    name: 'Cartas para amigos',
    title: 'Cartas para amigos e melhor amiga — textos reais | letterclub',
    description: 'Cartas reais para a melhor amiga, o melhor amigo ou aquela amizade que ficou longe. Leia cartas anônimas sobre amizade e escreva a sua.',
    intro: [
      'Amizade quase nunca ganha carta. A gente escreve pra namorado, pra mãe, pra quem foi embora, mas o amigo que segurou a barra numa terça qualquer costuma ficar só com um "valeu".',
      'Estas são cartas anônimas sobre amizade escritas no letterclub: pra melhor amiga de infância, pro amigo que mudou de cidade, pra amizade que esfriou sem ninguém ter culpa. Se alguma te lembrar de alguém, talvez seja a hora de mandar uma mensagem. Ou escrever a sua aqui.',
    ],
    tips: [
      'Conte uma história que só vocês dois sabem. É o que faz a carta ser dela e de mais ninguém.',
      'Agradeça uma coisa pequena e específica, não "por tudo".',
      'Se a amizade está longe, diga isso sem cobrança. Saudade dita com leveza aproxima.',
    ],
  },
  {
    id: 'familia',
    slug: 'cartas-para-a-familia',
    label: 'para a família',
    name: 'Cartas para a família',
    title: 'Cartas para mãe, pai e família — textos reais e anônimos | letterclub',
    description: 'Cartas reais para mãe, pai, avós e irmãos. Leia cartas anônimas sobre família escritas à mão no letterclub e escreva a sua.',
    intro: [
      'Família é onde as palavras mais importantes costumam ficar presas. A gente convive todo dia e mesmo assim não fala. Ou fala tudo, menos o que importa.',
      'As cartas abaixo são para mães, pais, avós, irmãos e famílias de todos os formatos. Algumas agradecem, algumas pedem desculpa, algumas só contam como foi o dia. São anônimas, então dá pra escrever exatamente o que você não consegue dizer no almoço de domingo.',
    ],
    tips: [
      'Lembre de um gesto repetido: o café que ela fazia, o jeito que ele assobiava. Rotina é memória de família.',
      'Se tem algo pendente, escreva mesmo assim. A carta não precisa ser entregue para fazer efeito em você.',
      'Fale de quem eles são, não só do papel que têm. Mãe também é uma pessoa com um nome.',
    ],
  },
  {
    id: 'saudade',
    slug: 'cartas-de-saudade',
    label: 'de saudade',
    name: 'Cartas de saudade',
    title: 'Cartas de saudade e para quem partiu — textos reais | letterclub',
    description: 'Cartas anônimas de saudade: para quem morreu, para quem foi embora e para quem a gente era. Textos reais escritos à mão no letterclub.',
    intro: [
      'Saudade é a carta que a gente continua escrevendo na cabeça. Pra quem morreu, pra quem foi embora, pra uma cidade, pra uma versão nossa que ficou lá atrás.',
      'Aqui estão cartas de saudade escritas por pessoas reais, de forma anônima. Muitas são para alguém que não vai ler, e tudo bem. Escrever para quem partiu é um jeito antigo e muito humano de continuar a conversa. Se você está atravessando um luto, leia com calma e cuide de você.',
    ],
    tips: [
      'Escreva no presente, como se a pessoa fosse ler hoje. Conte uma novidade.',
      'Não tem jeito certo de sentir falta. Raiva, riso e silêncio também cabem numa carta.',
      'Se pesar demais, pare. A carta espera, e conversar com alguém de confiança também ajuda.',
    ],
  },
  {
    id: 'dias-dificeis',
    slug: 'cartas-para-dias-dificeis',
    label: 'para dias difíceis',
    name: 'Cartas para dias difíceis',
    title: 'Cartas para dias difíceis — mensagens de apoio reais | letterclub',
    description: 'Cartas anônimas de apoio para quem está passando por um momento difícil. Mensagens reais, escritas à mão, de alguém que também já passou por isso.',
    intro: [
      'Tem dia que pesa. Nem sempre por um motivo grande, às vezes é só o acúmulo. Nesses dias, um texto motivacional genérico não ajuda muito. O que ajuda é perceber que alguém de verdade, em algum lugar, também já sentiu isso.',
      'Estas cartas foram escritas por pessoas anônimas pensando exatamente em quem está num dia ruim. Não prometem que vai passar amanhã. Só fazem companhia. Se você está num momento muito difícil, procure também alguém de confiança ou o CVV, que atende 24 horas pelo telefone 188.',
    ],
    tips: [
      'Não tente consertar. Diga que o cansaço é legítimo e que a pessoa não está sozinha.',
      'Ofereça algo pequeno e possível: um copo d\'água, uma janela aberta, cinco minutos de pausa.',
      'Escreva o que você gostaria de ter lido no seu pior dia.',
    ],
  },
];

export const TEMA_IDS = TEMAS.map((t) => t.id);
export const byId = Object.fromEntries(TEMAS.map((t) => [t.id, t]));
export const bySlug = Object.fromEntries(TEMAS.map((t) => [t.slug, t]));
export const DEFAULT_TEMA = 'desconhecido';
