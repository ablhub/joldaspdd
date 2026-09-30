-- Жолдас ПДД: регистрация по телефону и паролю, согласия, события для админки.
-- Анонимные аккаунты первой версии удаляются: теперь для обучения нужна регистрация.

alter table users alter column code_hash drop not null;
alter table users add column if not exists phone text;
alter table users add column if not exists password_hash text;
alter table users add column if not exists must_change_password boolean not null default false;
alter table users add column if not exists first_name text;
alter table users add column if not exists last_name text;
alter table users add column if not exists birth_date date;
alter table users add column if not exists pd_consent_at timestamptz;
alter table users add column if not exists pd_consent_version text;
alter table users add column if not exists guardian_consent boolean not null default false;
alter table users add column if not exists marketing_consent boolean not null default false;
alter table users add column if not exists marketing_consent_at timestamptz;
alter table users add column if not exists marketing_withdrawn_at timestamptz;
alter table users add column if not exists status text not null default 'active';
alter table users add column if not exists blocked_reason text;
alter table users add column if not exists blocked_at timestamptz;
alter table users add column if not exists last_login_at timestamptz;
alter table users add column if not exists phone_verified_at timestamptz;   -- для будущего подтверждения по SMS
alter table users add column if not exists reg_trial boolean not null default false;

delete from users where phone is null;

create unique index if not exists users_phone_key on users (phone);
create index if not exists users_created_idx on users (created_at);
create index if not exists users_status_idx on users (status);
create index if not exists users_name_idx on users (lower(last_name), lower(first_name));

-- ежедневная активность ученика: сколько вопросов решил за день
create table if not exists user_days (
  user_id uuid not null references users (id) on delete cascade,
  day date not null,
  answers integer not null default 0,
  correct integer not null default 0,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists user_days_day_idx on user_days (day);

-- лента событий площадки (без персональных данных в data)
create table if not exists events (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid references users (id) on delete set null,
  type text not null,
  data jsonb not null default '{}'::jsonb
);
create index if not exists events_at_idx on events (at desc);
create index if not exists events_user_idx on events (user_id, at desc);
create index if not exists events_type_idx on events (type, at desc);

-- пробные тесты гостей без регистрации
create table if not exists trial_results (
  id bigserial primary key,
  at timestamptz not null default now(),
  category text,
  total smallint not null,
  correct smallint not null,
  dur integer not null default 0
);
create index if not exists trial_results_at_idx on trial_results (at);

-- журнал действий администратора
create table if not exists admin_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  action text not null,
  target uuid,
  data jsonb not null default '{}'::jsonb
);
create index if not exists admin_audit_at_idx on admin_audit (at desc);
