-- Жолдас ПДД: схема базы. Персональных данных нет: только случайный id, хэши токенов и прогресс.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,              -- sha256 кода для другого устройства
  category text,                               -- категория из профиля (для статистики)
  state jsonb not null default '{}'::jsonb,    -- прогресс (без имени и без незавершенного экзамена)
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists users_last_seen_idx on users (last_seen_at);

create table if not exists devices (
  token_hash text primary key,                 -- sha256 токена устройства
  user_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists devices_user_idx on devices (user_id);

create table if not exists question_stats (
  question_id text primary key,
  attempts bigint not null default 0,
  correct bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists exam_results (
  id bigserial primary key,
  user_id uuid references users (id) on delete set null,
  taken_at timestamptz not null,
  total smallint not null,
  correct smallint not null,
  category text,
  unique (user_id, taken_at)
);
create index if not exists exam_results_taken_idx on exam_results (taken_at);

create table if not exists admin_kv (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists admin_sessions (
  token_hash text primary key,
  expires_at timestamptz not null
);
