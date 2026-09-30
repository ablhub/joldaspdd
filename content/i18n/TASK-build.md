# Задача E1: сборка сайта на трех языках (build.py)

Проект: /home/claude/pdd. Сайт - одностраничное приложение, собирается `build.py` из `content/*.json` (контент) и `src/*` (код, стили, шаблон). Сейчас все по-русски. Нужно, чтобы `build.py` собирал также казахскую и английскую версии. Переводы контента делают другие исполнители параллельно с тобой и кладут их в `content/i18n/<lang>/<pack>.json`; часть пакетов уже готова (m01-1, m25-1 для kk и en), остальные появятся позже. Переводы интерфейса (строк в `src/app.js`) готовит исполнитель E2: модуль `tools/i18n_ui.py` с функцией `translate_js(code, lang, strict)`; его может еще не быть.

Твоя зона: `build.py` и новые вспомогательные модули в `tools/` (например `tools/i18n_content.py`). Не меняй `src/*.js`, `src/styles.css`, `content/*.json`, `content/i18n/packs/*`, `content/i18n/<lang>/*`, серверный код и тесты других частей.

## Что уже есть

- `tools/i18n_refs.py`: `conv(ref, lang)` переводит строку ссылки (поле `ref` вопроса) на kk/en или возвращает None; `INLINE` - regex скобочных ссылок в тексте; `conv_inline('(п. 44)', lang)`.
- `tools/i18n_packs.py`: как строились пакеты из контента. Смотри его, чтобы понимать соответствие полей. Пакеты: `content/i18n/packs/<pack>.json`, у каждого `refs` - карта меток: `{"1": "(п. 44)", ...}`. В тексте пакета стоят метки `⟦1⟧` вместо этих ссылок.
- Готовый перевод пакета: `content/i18n/<lang>/<pack>.json` - та же структура, что у пакета (meta, lesson, keyFacts, mistakes, questions, signs, strings), строки переведены, метки `⟦n⟧` на месте. Карту `refs` бери из исходного пакета `content/i18n/packs/<pack>.json`.
- Пакеты модулей: `m01-1`, `m06-1`, `m06-2` и т.д. (поле `module` в пакете). Вопросы в пакете имеют `id`, `q`, `options`, `answer`, `explain`, опционально `scene` (карта путь -> подпись, например `"labels.0.text": "ящик"`, `"side.1.text": "двор"`, `"items.0.label": "..."`) и опционально `ref` (если `conv` не справился). Теория: `meta` {title, pdd, summary}, `lesson` [{h, p[], list[], tip}], `keyFacts[]`, `mistakes[]`.
- `signs`: пакет `signs` с `signs: [{code, meaning, note?}]`. Названия знаков - в `content/i18n/signs-names.json`: `{"2.4": ["Жол беріңіз", "Give way"], ...}` (индекс 0 - kk, 1 - en).
- `practice-1`, `categories-1`: плоские `strings: {"exam.theory.notes.0": "...", ...}` - путь в исходном JSON (`content/practice.json`, `content/categories.json`) через точку, индексы списков числами.

## Что сделать

1. `python3 build.py [--verified] [--api] [--lang ru|kk|en|all] [--strict]`.
   - По умолчанию `--lang ru` (поведение как сейчас, байт в байт тот же результат для ru без --api и с --api, кроме добавлений ниже про D.lang/D.langs/gname/cls и мета-тегов).
   - `--lang all` собирает ru, kk, en.
   - Без `--api` (офлайн-артефакт `site/joldas-pdd.html`) собирается только ru; для kk/en без --api выведи ошибку.
   - С `--api`: ru -> `site/public/index.html`, kk -> `site/public/kk/index.html`, en -> `site/public/en/index.html`. robots.txt как сейчас.
   - `--strict`: любой непереведенный элемент контента или интерфейса - ошибка сборки со списком. Без `--strict`: непереведенное остается по-русски, в конце печатается сводка (сколько вопросов/строк без перевода по пакетам).

2. Наложение перевода контента для kk/en (данные в JSON `pdd-data`):
   - Модули: title, pdd, summary, lesson (по индексу раздела и индексам p/list), keyFacts, mistakes; вопросы по `id`: q, options, explain, подписи схем по путям `scene` (путь `labels.0.text` -> `q.scene.labels[0].text`).
   - Метки `⟦n⟧` заменяй на `conv_inline(refs[n], lang)` из карты пакета, где стоит метка. Если метка без перевода - ошибка (в strict) или исходная русская ссылка.
   - Поле `ref` вопроса: если в переводе пакета есть `ref`, бери его; иначе `conv(q['ref'], lang)`; если None - русский (и в сводку).
   - Детерминированные замены в схемах (делай сам, в пакетах их нет):
     - en: подписи траекторий `cars[].paths[].label` А->A, Б->B, В->C, Г->D, Д->E; `cars[].label` 'У' оставить.
     - en: `dims[].label` вида '10 м' -> '10 m'.
     - Значения на знаках в `signs[].codes[]` и в `items[]` (если это список строк вида 'код:значение'): для en 'м'->'m', 'т'->'t', десятичная запятая -> точка ('3,5 м' -> '3.5 m'); названия городов на знаках 5.22-5.25: kk {АКСУ: АҚСУ, АКЖАР: АҚЖАР, АКСАЙ: АҚСАЙ, ТАЛГАР: ТАЛҒАР, КОСТАНАЙ: ҚОСТАНАЙ, КОРДАЙ: ҚОРДАЙ, ЕСИК: ЕСІК, ТАРАЗ: ТАРАЗ}, en {АКСУ: AKSU, АКЖАР: AKZHAR, АКСАЙ: AKSAY, ТАЛГАР: TALGAR, КОСТАНАЙ: KOSTANAY, КОРДАЙ: KORDAY, ЕСИК: ESIK, ТАРАЗ: TARAZ}. Проверь по данным, нет ли других кириллических значений в схемах, и обработай их.
   - Знаки: `name` из signs-names.json; `meaning`, `note` из пакета signs; поле `group` оставь русским (это ключ для кода приложения), добавь `gname` - название группы на языке сборки: kk {Предупреждающие знаки: Ескерту белгілері, Знаки приоритета: Басымдық белгілері, Запрещающие знаки: Тыйым салатын белгілер, Предписывающие знаки: Нұсқайтын белгілер, Информационно-указательные знаки: Ақпараттық-нұсқағыш белгілер, Знаки сервиса: Сервис белгілері, Знаки дополнительной информации (таблички): Қосымша ақпарат белгілері (тақтайшалар)}, en {Warning signs, Priority signs, Prohibitory signs, Mandatory signs, Information signs, Service signs, Additional information plates}. Для ru `gname` = `group`.
   - practice / categories: по путям из пакетов. Перед переводом вычисли для `practice.exam.changes2026[i]` поле `cls` по русскому `status`: начинается с 'в силе' -> 'green', с 'объявлено' -> 'yellow', иначе 'blue' (для всех языков, включая ru).
   - `D.lang` = код языка сборки (для всех сборок, включая ru и офлайн).
   - `D.langs` (только --api): `[{"code":"kk","label":"Қаз","href":"/kk/"},{"code":"ru","label":"Рус","href":"/"},{"code":"en","label":"Eng","href":"/en/"}]`.

3. Интерфейс: если есть `tools/i18n_ui.py` с `translate_js(code, lang, strict)`, для kk/en прогоняй через него склеенный JS (`scene.js`, `anim.js`, `app.js`) перед вставкой в шаблон. Если модуля нет - предупреждение, JS по-русски (в strict - ошибка).

4. Шаблон `src/shell.html` и шапка страницы для kk/en (замены строк при сборке; для ru все как сейчас):
   - `<title>`: kk «Жолдас - ЖЖҚ емтиханына дайындық», en «Joldas - Kazakhstan driving theory test prep».
   - meta description: kk «ЖЖҚ 2026 емтиханына барлық санаттар бойынша жеке дайындық: жеке жоспар, оқулық, талдауы мен сызбалары бар сұрақтар, қателермен жұмыс және арнаулы ХҚКО емтиханының симуляторы. Тегін.»; en «Personal preparation for the Kazakhstan driving theory test 2026 in all categories: a personal plan, a textbook, questions with explanations and diagrams, mistake review and a PSC exam simulator. Free.»
   - aria-label «Жолдас, мой план»: kk «Жолдас, менің жоспарым», en «Joldas, my plan». aria-label «Разделы»: kk «Бөлімдер», en «Sections».
   - brand-name «Жолдас»: kk «Жолдас», en «Joldas». brand-sub «ПДД РК · личная подготовка»: kk «ЖЖҚ · жеке дайындық», en «Road rules · personal prep».
   - первая строка футера: kk «Жолдас - ЖЖҚ емтиханына барлық санаттар бойынша жеке дайындық. ЖЖҚ бойынша оқу материалы (ҚР ІІМ-нің № 534 бұйрығы, 2026 жылғы редакция), ресми басылым емес.»; en «Joldas - personal preparation for the Kazakhstan driving theory test in all categories. Study material based on the Road Traffic Rules (MIA Order No. 534, 2026 edition), not an official publication.»
   - вторая строка футера (API-сборка, сейчас «О проекте · Конфиденциальность · Обучение бесплатное»): kk «Жоба туралы · Құпиялылық · Оқу тегін», en «About · Privacy · Free to learn» (кнопки data-go те же).
   - Для --api: `<html lang="ru|kk|en">`, `og:locale` ru_KZ / kk_KZ / en_US, og:title (kk «Жолдас ЖЖҚ», en «Joldas»), og:description = meta description языка, и во всех трех страницах `<link rel="alternate" hreflang="ru" href="/">`, `hreflang="kk" href="/kk/"`, `hreflang="en" href="/en/"`, `hreflang="x-default" href="/"`.
   - Длинных тире в итоговых страницах быть не должно (проверка уже есть в конце build.py - распространи на все языки).

5. Проверка:
   - `python3 build.py --verified --api --lang all` работает сейчас (без strict), ru-страница совпадает с прежней по контенту; kk/en содержат переведенные m01 и m25 (проверь несколько строк), остальное по-русски, сводка печатается.
   - Для ru офлайн: `python3 build.py --verified` дает рабочий `site/joldas-pdd.html`; прогон `python3 tools/smoke.py` (если он ожидает конкретные файлы - посмотри, как запускать) проходит.
   - Проверь, что в kk/en данных нет пропавших вопросов (1803), `answer` не изменились, число вариантов совпадает с ru, у схем те же ключи.
   - Напиши короткий самотест `tools/i18n_build_test.py`: собирает kk/en в память и проверяет инварианты выше (id, answer, число вариантов, отсутствие меток ⟦n⟧ в итоговых строках, отсутствие кириллицы в en-строках контента для уже переведенных пакетов).

6. Сам `tools/build_release.js` вызывает `build.py --verified --api`; обнови его, чтобы вызывался `--lang all`, и чтобы в архив релиза попадали `public/kk/index.html` и `public/en/index.html` (посмотри, как он собирает список файлов).

В конце ответь коротко: что сделано, как запускать, результат проверок, открытые вопросы.
