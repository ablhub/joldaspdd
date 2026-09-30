# Задача E3: сервер и админка для трех языков

Проект: /home/claude/pdd. Сайт теперь собирается на трех языках: `/` (ru), `/kk/`, `/en/` (build.py, `python3 build.py --verified --api --lang all`). Клиент (`src/app.js`) уже отправляет заголовок `X-Lang: ru|kk|en` во всех запросах API, поле `lang` при регистрации и `PATCH /api/v1/me {lang}` при смене языка переключателем. Сервер это пока игнорирует. Нужно доделать сервер и админку.

Твоя зона: `server/` (src, migrations, test, deploy), `tools/api_test.sh`, `tools/e2e_admin.py`, `tools/seed_dev.js`, новый `tools/e2e_i18n.py`. Не трогай `src/*` (клиент), `build.py`, `content/*` - это делают другие.

Окружение: PostgreSQL 16 на сокете /tmp порт 55432 (если не запущен: `rm -f /tmp/.s.PGSQL.55432* /tmp/pgdata/postmaster.pid; runuser -u postgres -- /usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata -o "-k /tmp -p 55432" -l /tmp/pgdata.log start`). Dev-сервер: `bash tools/dev_server.sh --fresh` (порт 3200, статика из site/public). API-тесты: `bash tools/api_test.sh` (посмотри, как запускается server/test/run.js).

## 1. Язык пользователя

- Миграция `server/migrations/003_lang.sql`: `users.lang text not null default 'ru'` с check (ru, kk, en); индекс не обязателен.
- Регистрация: принимает `lang` (ru|kk|en; иначе берется из X-Lang; иначе ru), сохраняет в users.lang и в data события register (`lang`).
- `PATCH /api/v1/me`: принимает `lang` (валидировать), пишет событие `profile` с fields `['lang']` (как для других полей).
- `userJson` возвращает `lang`.

## 2. Ответы API на языке клиента

- Новый `server/src/i18n.js`: `reqLang(req)` (X-Lang -> ru|kk|en, по умолчанию ru) и `tr(message, lang)` - перевод русского сообщения по точному совпадению из словаря ниже; нет в словаре - вернуть как есть.
- В `main.js` в обработчике ошибок и в ответах 404/500 отдавай `tr(..., reqLang(req))`. Админские ответы остаются русскими (админка русская, X-Lang не шлет).
- `GET /api/v1/config`: если в настройках есть `supportTextKk` / `supportTextEn` и язык запроса kk/en, отдавай в поле `supportText` локализованный текст (иначе русский).

Словарь (ru -> kk | en), используй точно:

| ru | kk | en |
|---|---|---|
| Войдите в аккаунт | Аккаунтқа кіріңіз | Please log in |
| Сессия завершена, войдите снова | Сеанс аяқталды, қайта кіріңіз | Your session has ended, please log in again |
| Сессия истекла, войдите снова | Сеанс мерзімі бітті, қайта кіріңіз | Your session has expired, please log in again |
| Аккаунт заблокирован. Обратитесь в поддержку | Аккаунт бұғатталған. Қолдау қызметіне хабарласыңыз | Your account is blocked. Please contact support |
| Задайте новый пароль, чтобы продолжить | Жалғастыру үшін жаңа құпиясөз орнатыңыз | Set a new password to continue |
| Не удалось зарегистрироваться | Тіркелу мүмкін болмады | Registration failed |
| Нужно согласие на обработку персональных данных | Дербес деректерді өңдеуге келісім қажет | Consent to the processing of personal data is required |
| До 18 лет нужно согласие родителя или законного представителя | 18 жасқа дейін ата-ананың немесе заңды өкілдің келісімі қажет | Under 18, consent of a parent or legal guardian is required |
| Этот номер уже зарегистрирован. Войдите по номеру и паролю | Бұл нөмір тіркелген. Нөмір мен құпиясөз арқылы кіріңіз | This number is already registered. Log in with your number and password |
| Этот телефон уже у другого пользователя | Бұл телефон нөмірі басқа пайдаланушыда тіркелген | This phone number belongs to another user |
| Проверьте номер телефона | Телефон нөмірін тексеріңіз | Check the phone number |
| Слишком много неудачных попыток. Попробуйте через 15 минут или обратитесь в поддержку | Сәтсіз әрекеттер тым көп. 15 минуттан кейін қайталаңыз немесе қолдау қызметіне хабарласыңыз | Too many failed attempts. Try again in 15 minutes or contact support |
| Неверный телефон или пароль | Телефон немесе құпиясөз қате | Wrong phone number or password |
| Некорректный результат | Нәтиже қате | Invalid result |
| Для возраста до 18 лет нужно согласие родителя или законного представителя. Напишите в поддержку | 18 жасқа дейін ата-ананың немесе заңды өкілдің келісімі қажет. Қолдау қызметіне жазыңыз | Under 18, consent of a parent or legal guardian is required. Please write to support |
| Согласие на рекламные сообщения можно дать с 18 лет | Жарнамалық хабарламаларға келісімді 18 жастан бастап беруге болады | Consent to marketing messages can be given from the age of 18 |
| Текущий пароль неверный | Қазіргі құпиясөз қате | The current password is wrong |
| Неверный пароль | Құпиясөз қате | Wrong password |
| Аккаунт удален | Аккаунт жойылды | The account has been deleted |
| Слишком большой запрос | Сұраныс тым үлкен | Request too large |
| Некорректный JSON | JSON қате | Invalid JSON |
| Некорректный запрос | Сұраныс қате | Invalid request |
| Слишком много попыток, попробуйте через несколько минут | Әрекеттер тым көп, бірнеше минуттан кейін қайталаңыз | Too many attempts, try again in a few minutes |
| Укажите имя | Атыңызды жазыңыз | Enter your first name |
| Укажите фамилию | Тегіңізді жазыңыз | Enter your last name |
| Имя: не длиннее 40 символов | Аты: 40 таңбадан аспауы керек | First name: 40 characters maximum |
| Фамилию: не длиннее 40 символов | Тегі: 40 таңбадан аспауы керек | Last name: 40 characters maximum |
| Имя: только буквы, пробел, дефис и апостроф | Аты: тек әріптер, бос орын, дефис және апостроф | First name: letters, spaces, hyphens and apostrophes only |
| Фамилию: только буквы, пробел, дефис и апостроф | Тегі: тек әріптер, бос орын, дефис және апостроф | Last name: letters, spaces, hyphens and apostrophes only |
| Телефон в формате +7 7XX XXX XX XX | Телефон +7 7XX XXX XX XX форматында болуы керек | Phone number in the format +7 7XX XXX XX XX |
| Укажите дату рождения | Туған күніңізді көрсетіңіз | Enter your date of birth |
| Проверьте дату рождения | Туған күнді тексеріңіз | Check the date of birth |
| Регистрация доступна с 14 лет | Тіркелу 14 жастан бастап қолжетімді | Registration is available from the age of 14 |
| Выберите категорию | Санатты таңдаңыз | Choose a category |
| Пароль не короче 8 символов | Құпиясөз кемінде 8 таңбадан тұруы керек | The password must be at least 8 characters |
| Пароль не длиннее 128 символов | Құпиясөз 128 таңбадан аспауы керек | The password must be 128 characters or fewer |
| Пароль слишком простой | Құпиясөз тым қарапайым | The password is too simple |
| Запрос отклонен | Сұраныс қабылданбады | Request rejected |
| Не найдено | Табылмады | Not found |
| Ошибка сервера | Сервер қатесі | Server error |

Проверь, что тексты сообщений в коде (validate.js, users.js, util.js, main.js) совпадают с таблицей символ в символ; если нашлось пользовательское сообщение, которого нет в таблице, переведи его в том же стиле (kk - на «Сіз», en - британская орфография) и добавь.

## 3. Админка (server/src/admin.js, adminApi.js) - остается на русском

- Пользователи: колонка «Язык» (РУС / ҚАЗ / ENG), фильтр по языку (select: все, русский, казахский, английский) - параметр `lang` в `/admin/api/users` и в `users.csv`; в CSV колонка «Язык интерфейса» со значениями «русский», «казахский», «английский».
- Карточка пользователя: строка «Язык интерфейса».
- Обзор: блок «Языки» (горизонтальные полосы, как «Категории»): число пользователей по языкам; в API overview поле `langs`.
- Активность: в подписях полей профиля (`FIELDS`) добавь `lang: 'язык'`; в событии регистрации можно показывать язык.
- Настройки: два необязательных поля «Текст поддержки на казахском» и «Текст поддержки на английском» (`supportTextKk`, `supportTextEn` в server/src/settings.js, та же валидация длины, что у supportText).

## 4. Раздача страниц

- `server/src/main.js` `serveStatic` (только dev): путь без расширения, указывающий на каталог (`/kk`, `/en`), отдает `<каталог>/index.html`.
- `server/deploy/caddy-config.sh`: в matcher `@page` добавь `/kk /kk/ /kk/index.html /en /en/ /en/index.html` (CSP и Cache-Control no-cache для всех трех страниц).
- `loadKnownIds()` читает `public/index.html` (ru) - id одинаковые во всех языках, оставь как есть.

## 5. Тесты

- `server/test/run.js`: регистрация с `lang: 'kk'` сохраняет язык; без `lang`, но с `X-Lang: en` - сохраняется en; `PATCH /me {lang:'en'}` работает и пишет событие; неверный `lang` - 400 (с русским сообщением «Некорректный запрос» или своим - на твое усмотрение, добавь его в словарь); ошибка входа с `X-Lang: kk` возвращает «Телефон немесе құпиясөз қате»; с `X-Lang: en` - «Wrong phone number or password»; без заголовка - русский текст; `/api/v1/config` с X-Lang kk отдает supportTextKk, если задан; admin users filter `lang` и CSV-колонка.
- Обнови `tools/e2e_admin.py`, если он проверяет набор колонок/блоков.
- Новый `tools/e2e_i18n.py` (Playwright, как tools/e2e_accounts.py): собирает страницы не нужно (их соберет запускающий), проверяет на dev-сервере: `/kk/` и `/en/` отдаются (200), у `<html>` правильный lang, есть переключатель языка (`.langsw` или посмотри в src/app.js, как он размечен), клик по «Eng» на `/` ведет на `/en/` с сохранением hash, регистрация на `/kk/` создает пользователя с lang='kk' (проверка в БД), ошибка входа на `/en/` показывает английский текст. Тексты интерфейса kk/en могут быть еще не переведены (словари делают параллельно) - не завязывай проверки на конкретные переводы интерфейса, кроме сообщений сервера из таблицы выше.
- Прогони: `bash tools/api_test.sh`, `python3 tools/e2e_admin.py` (после seed_dev, как описано в файлах), `python3 tools/e2e_accounts.py` (ru), `python3 tools/e2e_i18n.py`. Перед e2e пересобери страницы: `cd /home/claude/pdd && python3 build.py --verified --api --lang all` (если сборка падает из-за незавершенных переводов - она не strict, должна проходить).

Правило текста проекта: длинное тире запрещено, только дефис. Работай самостоятельно, без вопросов. В конце ответь коротко: что изменено по пунктам, результаты тестов, открытые вопросы.
