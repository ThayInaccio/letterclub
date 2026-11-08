-- Idempotente: roda a cada boot, sob advisory lock (várias réplicas sobem juntas).

-- Identidade anônima: o cookie guarda um token aleatório; aqui só o hash.
CREATE TABLE IF NOT EXISTS sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  text UNIQUE NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS letters (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     uuid REFERENCES sessions(id) ON DELETE SET NULL,   -- null = carta do clube (seed)
  recipient_id  uuid REFERENCES sessions(id) ON DELETE SET NULL,
  text          text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 700),
  pen           smallint NOT NULL CHECK (pen BETWEEN 0 AND 2),
  paper         smallint NOT NULL CHECK (paper BETWEEN 0 AND 5),
  texture       smallint NOT NULL DEFAULT 0 CHECK (texture BETWEEN 0 AND 2),
  city          text NOT NULL,
  hour          smallint NOT NULL CHECK (hour BETWEEN 0 AND 23),
  stamp         text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deliver_at    timestamptz NOT NULL DEFAULT now(),
  delivered_at  timestamptz,
  opened_at     timestamptz,
  kept          boolean NOT NULL DEFAULT false,
  published_at  timestamptz,
  saves         integer NOT NULL DEFAULT 0 CHECK (saves >= 0),
  seed_key      text UNIQUE
);
-- fila de entrega: cartas de pessoas ainda sem destinatário
CREATE INDEX IF NOT EXISTS letters_pool      ON letters (deliver_at) WHERE recipient_id IS NULL AND author_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS letters_recipient ON letters (recipient_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS letters_author    ON letters (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS letters_mural     ON letters (published_at DESC) WHERE published_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS favorites (
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  letter_id   uuid NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, letter_id)
);

CREATE TABLE IF NOT EXISTS members (
  id          serial PRIMARY KEY,
  email       text UNIQUE NOT NULL,
  city        text,
  plan        text NOT NULL CHECK (plan IN ('leitor', 'membro')),
  billing     text NOT NULL CHECK (billing IN ('mensal', 'anual')),
  status      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Clube grátis (a Caixa semanal): confirmação dupla e descadastro em um clique.
-- status: pendente (falta confirmar) | ativo | saiu
ALTER TABLE members ADD COLUMN IF NOT EXISTS confirm_token_hash text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS confirm_sent_at    timestamptz;
ALTER TABLE members ADD COLUMN IF NOT EXISTS confirmed_at       timestamptz;
ALTER TABLE members ADD COLUMN IF NOT EXISTS unsub_token        text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS unsubscribed_at    timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS members_confirm ON members (confirm_token_hash) WHERE confirm_token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS members_unsub   ON members (unsub_token) WHERE unsub_token IS NOT NULL;
-- planos pagos ficaram para depois: quem estava esperando pagamento vira inscrito pendente
UPDATE members SET status = 'pendente' WHERE status = 'aguardando_pagamento';

-- "mais curtidas da semana" precisa saber quando cada favorito aconteceu
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS favorites_recent ON favorites (created_at);

-- Uma Caixa por pessoa por semana, mesmo se o job rodar duas vezes.
CREATE TABLE IF NOT EXISTS digest_sends (
  member_id  integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  week       date NOT NULL,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, week)
);

CREATE TABLE IF NOT EXISTS orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid REFERENCES sessions(id) ON DELETE SET NULL,
  letter_id       uuid REFERENCES letters(id) ON DELETE SET NULL,
  email           text NOT NULL,
  choices         jsonb NOT NULL,
  address         jsonb,
  total_cents     integer NOT NULL CHECK (total_cents > 0),
  payment_method  text NOT NULL CHECK (payment_method IN ('pix', 'cartao')),
  status          text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- SEO: cada carta do mural vira uma página (/carta/<num>-<slug>/) e tem um tema.
ALTER TABLE letters ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'desconhecido';
ALTER TABLE letters ADD COLUMN IF NOT EXISTS num bigserial;
CREATE UNIQUE INDEX IF NOT EXISTS letters_num ON letters (num);
-- Moderação: pendente (no mural, fora do Google) | aprovada (entra no Google) | oculta (sai de tudo)
ALTER TABLE letters ADD COLUMN IF NOT EXISTS mod_status  text NOT NULL DEFAULT 'pendente';
ALTER TABLE letters ADD COLUMN IF NOT EXISTS reports     integer NOT NULL DEFAULT 0;
ALTER TABLE letters ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
CREATE INDEX IF NOT EXISTS letters_theme_public ON letters (theme, published_at DESC) WHERE published_at IS NOT NULL AND mod_status = 'aprovada';
CREATE INDEX IF NOT EXISTS letters_mod_queue    ON letters (published_at) WHERE published_at IS NOT NULL AND (mod_status = 'pendente' OR reports > 0);

-- Uma denúncia por pessoa por carta.
CREATE TABLE IF NOT EXISTS letter_reports (
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  letter_id   uuid NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, letter_id)
);
