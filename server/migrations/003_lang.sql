-- Жолдас ПДД: язык интерфейса ученика (сайт на русском, казахском и английском).
-- Выбирается при регистрации и переключателем языка; по умолчанию русский (все прежние аккаунты).

alter table users add column if not exists lang text not null default 'ru';
alter table users drop constraint if exists users_lang_check;
alter table users add constraint users_lang_check check (lang in ('ru', 'kk', 'en'));
