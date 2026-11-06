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
