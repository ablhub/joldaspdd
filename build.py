"""Build the site from content/*.json + src/* in Russian, Kazakh and English.

Usage: python3 build.py [--verified] [--api] [--lang ru|kk|en|all] [--strict]
  --verified  about-page text states that the whole bank passed independent verification.
  --api       page for our own server (accounts, sync): site/public/index.html (ru),
              site/public/kk/index.html, site/public/en/index.html, robots.txt.
              Without --api: offline artifact site/joldas-pdd.html, Russian only.
  --lang      ru (default), kk, en, all, or a comma list (kk,en).
  --strict    any untranslated content or interface string is a build error (the list is printed,
              nothing is written). Without it untranslated text stays Russian and a summary is printed.

Content translations: content/i18n/<lang>/<pack>.json (tools/i18n_content.py).
Interface translations: tools/i18n_ui.py translate_js(code, lang, strict) (if present).
"""
import hashlib, html, json, os, re, shutil, subprocess, sys, tempfile

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE, 'tools'))
import i18n_content as C  # noqa: E402
import build_seo as SEO  # noqa: E402

LANGS = C.LANGS
DASHES = ['—', '–']   # длинное и среднее тире запрещены в страницах
LANG_MENU = [{'code': 'kk', 'label': 'Қаз', 'href': '/kk/'},
             {'code': 'ru', 'label': 'Рус', 'href': '/'},
             {'code': 'en', 'label': 'Eng', 'href': '/en/'}]
HREFLANG = [('ru', '/'), ('kk', '/kk/'), ('en', '/en/'), ('x-default', '/')]
ICON = "data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M50 3 L97 50 L50 97 L3 50 Z' fill='%23fff' stroke='%231A1A1A' stroke-width='3'/%3E%3Cpath d='M50 16 L84 50 L50 84 L16 50 Z' fill='%23F2B200'/%3E%3C/svg%3E"
SPLIT = '\n/*@@SPLIT@@*/\n'          # граница между кодом схем (scene.js, anim.js) и кодом приложения (app.js)
# готовый первый экран лежит в HTML (tools/prerender.py). Вернувшемуся пользователю (есть прогресс, вход, выбранный язык или адрес вида #exam) его показывать нельзя:
# страница сразу получает класс ret, скрывающий заготовку, пока приложение не нарисует свой экран (app.js снимает класс).
# Нажатие на кнопку заготовки до запуска приложения запоминается (window.__pg) и выполняется сразу после запуска.
PRE_SCRIPT = ("<script>try{var h=location.hash,l=localStorage;if((h.length>1&&h!=='#plan')||l.getItem('joldas-pdd-v1')||l.getItem('joldas-auth-v1')||l.getItem('joldas-lang'))"
              "document.documentElement.className+=' ret'}catch(e){}"
              "document.addEventListener('click',function(e){if(window.__pgOff)return;var t=e.target&&e.target.closest&&e.target.closest('[data-go]');if(t)window.__pg=t.getAttribute('data-go')},true)</script>")
# код и данные стартуют после первой отрисовки (событие paint, запасной срок 3 с): первый экран не ждет их скачивания и разбора (файлы загружаются заранее через preload; сначала данные, затем код)
LOADER = ('<script>(function(){var u=%s,d=0,n=0;function add(src){var s=document.createElement("script");s.src=src;s.async=true;document.head.appendChild(s)}'
          'function parse(t){var L=t.split("\\n"),D=JSON.parse(L[0]),o=[],i=1;(function nx(){var s=Date.now();while(i<L.length&&Date.now()-s<12){if(L[i])o.push(JSON.parse(L[i]));i++}'
          'if(i<L.length){setTimeout(nx,0);return}D.modules=o;window.__PDD=D;add(u[1])})()}'
          'function run(){if(d)return;d=1;fetch(u[0]).then(function(r){if(!r.ok)throw 0;return r.text()}).then(parse).catch(function(){d=0;if(++n<6)setTimeout(run,3000)})}'
          'try{new PerformanceObserver(function(l,o){if(l.getEntriesByName("first-contentful-paint").length){o.disconnect();setTimeout(run,0)}}).observe({type:"paint",buffered:true})}catch(e){}'
          'setTimeout(run,3000)})()</script>')
PUBLIC = os.path.join(BASE, 'site', 'public')
OLD_FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
             '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&family=Unbounded:wght@500;600;700&display=swap">')
# какие файлы шрифтов заранее подгружать на странице языка (остальные подгружаются по надобности)
FONT_PRELOAD = {'ru': ['golos-text-cyrillic', 'golos-text-latin'], 'kk': ['golos-text-cyrillic', 'golos-text-latin'], 'en': ['golos-text-latin']}
OFFLINE_FOOT = '<button data-go="about">О проекте</button> · Прогресс хранится в этом браузере'

# строки шаблона src/shell.html и шапки страницы; для ru шаблон не меняется (кроме футера API-сборки)
PAGE = {
    'ru': {
        'desc': 'Индивидуальная подготовка к экзамену ПДД РК 2026 по всем категориям: личный план, учебник, вопросы с разбором и схемами, работа над ошибками и симулятор экзамена спецЦОН. Бесплатно.',
        'og_title': 'Жолдас ПДД', 'locale': 'ru_KZ',
        'foot2': '<button data-go="about">О проекте</button> · <button data-go="privacy">Конфиденциальность</button> · Обучение бесплатное',
    },
    'kk': {
        'title': 'Жолдас - ЖЖҚ емтиханына дайындық',
        'desc': 'ЖЖҚ 2026 емтиханына барлық санаттар бойынша жеке дайындық: жеке жоспар, оқулық, талдауы мен сызбалары бар сұрақтар, қателермен жұмыс және арнаулы ХҚКО емтиханының симуляторы. Тегін.',
        'plan': 'Жолдас, менің жоспарым', 'sections': 'Бөлімдер',
        'brand': 'Жолдас', 'sub': 'ЖЖҚ · жеке дайындық',
        'foot1': 'Жолдас - ЖЖҚ емтиханына барлық санаттар бойынша жеке дайындық. ЖЖҚ бойынша оқу материалы (ҚР ІІМ-нің № 534 бұйрығы, 2026 жылғы редакция), ресми басылым емес.',
        'foot2': '<button data-go="about">Жоба туралы</button> · <button data-go="privacy">Құпиялылық</button> · Оқу тегін',
        'og_title': 'Жолдас ЖЖҚ', 'locale': 'kk_KZ',
    },
    'en': {
        'title': 'Joldas - Kazakhstan driving theory test prep',
        'desc': 'Personal preparation for the Kazakhstan driving theory test 2026 in all categories: a personal plan, a textbook, questions with explanations and diagrams, mistake review and a PSC exam simulator. Free.',
        'plan': 'Joldas, my plan', 'sections': 'Sections',
        'brand': 'Joldas', 'sub': 'Road rules · personal prep',
        'foot1': 'Joldas - personal preparation for the Kazakhstan driving theory test in all categories. Study material based on the Road Traffic Rules (MIA Order No. 534, 2026 edition), not an official publication.',
        'foot2': '<button data-go="about">About</button> · <button data-go="privacy">Privacy</button> · Free to learn',
        'og_title': 'Joldas', 'locale': 'en_US',
    },
}
# текст «О проекте» без --verified
VERIFIED = {
    'ru': 'Вопросы проходят сверку с текущим текстом Правил: правильный ответ единственный, пункт указан верно, схема совпадает с условием.',
    'kk': 'Сұрақтар Қағидалардың қолданыстағы мәтінімен салыстырылып тексеріледі: дұрыс жауап біреу ғана, тармақ дұрыс көрсетілген, сызба шартқа сәйкес келеді.',
    'en': 'Questions are being checked against the current text of the Rules: one correct answer, the right clause cited, a diagram that matches the question.',
}


def read(name):
    with open(os.path.join(BASE, name), encoding='utf-8') as f:
        return f.read()


def out_path(lang, api):
    if not api:
        return os.path.join(BASE, 'site', 'joldas-pdd.html')
    return os.path.join(BASE, 'site', 'public', *([] if lang == 'ru' else [lang]), 'index.html')


# ---------- шаблон и шапка ----------

def shell_for(lang, api, problems, S=None):
    """src/shell.html на языке сборки. Незамененные места шаблона -> problems."""
    s = read('src/shell.html')
    P = PAGE[lang]
    e = lambda t: html.escape(t, quote=True)  # noqa: E731

    def sub(pattern, repl, what, literal=False):
        nonlocal s
        if literal:
            n = s.count(pattern)
            s = s.replace(pattern, repl)
        else:
            s, n = re.subn(pattern, lambda m: repl(m), s)
        if not n:
            problems.append('шаблон: не найдено место для замены (%s)' % what)

    if lang != 'ru':
        sub(r'<title>[^<]*</title>', lambda m: '<title>' + e(P['title']) + '</title>', '<title>')
        sub(r'(<meta name="description" content=")[^"]*(")', lambda m: m.group(1) + e(P['desc']) + m.group(2), 'meta description')
        sub('aria-label="Жолдас, мой план"', 'aria-label="' + e(P['plan']) + '"', 'aria-label «Жолдас, мой план»', True)
        sub('aria-label="Разделы"', 'aria-label="' + e(P['sections']) + '"', 'aria-label «Разделы»', True)
        sub(r'(<span class="brand-name">)[^<]*(</span>)', lambda m: m.group(1) + e(P['brand']) + m.group(2), 'brand-name')
        sub(r'(<span class="brand-sub">)[^<]*(</span>)', lambda m: m.group(1) + e(P['sub']) + m.group(2), 'brand-sub')
        sub(r'(<footer>\s*<div class="wrap">\s*<span>)[^<]*(</span>)', lambda m: m.group(1) + e(P['foot1']) + m.group(2), 'первая строка футера')
    if api:
        sub(OFFLINE_FOOT, P['foot2'], 'вторая строка футера', True)
        if S is not None:
            m = SEO.home_meta(lang, S)
            sub(r'<title>[^<]*</title>', lambda mm: '<title>' + e(m['title']) + '</title>', '<title> (SEO)')
            # описание уже есть в начале страницы (build_seo.home_head): дубль из шаблона убираем
            sub(r'<meta name="description" content="[^"]*">\n?', lambda mm: '', 'meta description шаблона (дубль)')
            sub('<main class="wrap" id="app"><!--pre:app--><!--/pre:app--></main>', '<main class="wrap" id="app"><!--pre:app--><!--/pre:app-->' + SEO.home_prerender(lang, S) + '</main>', 'main#app (предварительная разметка)', True)
            sub('</div>\n</footer>', SEO.footer_links(lang) + '</div>\n</footer>', 'ссылки в подвале', True)
    return s


def head(lang, data):
    """Начало страницы для своего хостинга: doctype, язык, метатеги, canonical, hreflang, Open Graph, JSON-LD (tools/build_seo.py)."""
    return SEO.home_head(lang, SEO.stats(data, lang))


# ---------- интерфейс (JS) ----------

def js_syntax_error(code):
    """Проверка синтаксиса JS через node --check (если node есть)."""
    node = shutil.which('node')
    if not node:
        return None
    fd, fn = tempfile.mkstemp(suffix='.js')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(code)
        r = subprocess.run([node, '--check', fn], capture_output=True, text=True, timeout=120)
        return None if r.returncode == 0 else ' / '.join((r.stderr or r.stdout).strip().splitlines()[:6])
    finally:
        os.unlink(fn)


def ui_code(lang, strict, notes):
    """Склеенный JS; для kk/en - через tools/i18n_ui.translate_js. notes: [(kind, text)], kind err|warn|ui-miss.
    Нет модуля или словаря, исключение, битый JS после перевода: в strict - ошибка, иначе русский JS и предупреждение."""
    code = '\n'.join(read('src/' + n) for n in ['scene.js', 'anim.js']) + SPLIT + read('src/app.js')
    if lang == 'ru':
        return code
    kind = 'err' if strict else 'warn'
    try:
        import i18n_ui
    except ImportError:
        notes.append((kind, 'интерфейс: нет tools/i18n_ui.py, строки интерфейса остаются по-русски'))
        return code
    try:
        res = i18n_ui.translate_js(code, lang, strict)
    except Exception as ex:  # в strict - список непереведенных строк
        notes.append((kind, 'интерфейс: %s: %s' % (type(ex).__name__, ex)))
        return code
    out = res[0] if isinstance(res, tuple) else res
    if not isinstance(out, str) or not out.strip():
        notes.append((kind, 'интерфейс: translate_js вернул не строку, строки интерфейса остаются по-русски'))
        return code
    if out != code:
        err = js_syntax_error(out)
        if err:
            notes.append((kind, 'интерфейс: переведенный JS не проходит node --check (%s), оставлен русский' % err))
            return code
    # пропуски последнего вызова: i18n_ui.LAST_MISSING / LAST_BAD (или второй элемент кортежа)
    miss = res[1] if isinstance(res, tuple) and len(res) > 1 else getattr(i18n_ui, 'LAST_MISSING', None)
    bad = getattr(i18n_ui, 'LAST_BAD', None) or []
    if miss or bad:
        notes.append(('ui-miss', 'интерфейс: без перевода %d строк, с ошибками перевода %d (остаются по-русски)%s'
                      % (len(miss or []), len(bad), ', например: ' + '; '.join(repr(x)[:60] for x in list(miss)[:5]) if miss else '')))
    return out


# ---------- сборка одного языка ----------

def build_lang(lang, ru, api, verified, strict=False):
    """Страница языка lang в памяти.
    -> dict(lang, path, html, data, report, notes, stats); notes: [(kind, text)], kind err|warn|ui-miss."""
    notes = []
    data, rep = C.localize(ru, lang, BASE)
    if api:
        data['api'] = '/api/v1'
    if not verified:
        data['verified'] = VERIFIED[lang]
    data['lang'] = lang
    if api:
        data['langs'] = LANG_MENU
    js_data = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    code = ui_code(lang, strict, notes)
    if SPLIT not in code:
        notes.append(('err' if strict else 'warn', 'интерфейс: потерян маркер границы кода схем'))
        code = SPLIT + code
    scene_code, app_code = code.split(SPLIT, 1)
    assert '</script' not in code.lower(), 'script terminator inside JS'
    problems = []
    shell = shell_for(lang, api, problems, SEO.stats(data, lang) if api else None)
    notes += [('err' if strict else 'warn', p) for p in problems]
    css = read('src/styles.css')
    assets = {}
    if api:
        # свой хостинг: стили и шрифты внутри страницы, код, схемы и данные отдельными кешируемыми файлами (имя с отпечатком содержимого)
        css = css + '\n' + read('src/fonts.css')
        def asset(kind, text, ext='js'):
            name = '%s.%s.%s.%s' % (kind, lang, hashlib.sha256(text.encode()).hexdigest()[:8], ext)
            assets['assets/' + name] = text
            return '/assets/' + name
        # данные текстом: первая строка - общие сведения, затем по теме в строке (в JSON нет переводов строк). Браузер получает их как текст (без разбора кода на сотни КБ)
        # и разбирает по одной теме с паузами: главный поток на слабом телефоне не замирает (разбор запускает загрузчик в HTML, см. LOADER)
        meta = {k: v for k, v in data.items() if k != 'modules'}
        dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))   # noqa: E731
        lines = [dump(meta)] + [dump(m) for m in data['modules']]
        assert not any('\n' in x or '\r' in x or '\u2028' in x or '\u2029' in x for x in lines)
        u_data = asset('data', '\n'.join(lines), 'json')
        u_app = asset('app', app_code)
        u_scene = asset('scene', scene_code)
        pre = ''.join('<link rel="preload" href="/assets/fonts/%s-wght-normal.woff2" as="font" type="font/woff2" crossorigin>' % f for f in FONT_PRELOAD[lang])
        head_assets = pre + PRE_SCRIPT + '<script>window.__PDD_ASSETS={scene:"%s"}</script>' % (u_scene,)
        scripts = LOADER % json.dumps([u_data, u_app])
    else:
        head_assets = OLD_FONTS
        scripts = ('<script type="application/json" id="pdd-data">' + js_data + '</script>\n<script>\n' + scene_code + '\n' + app_code + '\n</script>')
    out = shell.replace('/*__CSS__*/', css).replace('<!--__HEAD_ASSETS__-->', head_assets, 1).replace('<!--__SCRIPTS__-->', scripts, 1)
    if api:
        out = head(lang, data) + out + '\n</html>\n'
    kind = 'err' if strict else 'warn'
    whole = out + ''.join(assets.values())      # страница и вынесенные файлы: проверки длинного тире и меток
    bad = [c for c in DASHES if c in whole]
    if bad:
        where = []
        for m in re.finditer('|'.join(DASHES), whole):
            where.append(repr(whole[max(0, m.start() - 40):m.end() + 20]))
            if len(where) >= 3:
                break
        notes.append((kind, 'длинное тире в странице (%d): %s' % (sum(whole.count(c) for c in DASHES), '; '.join(where))))
    if '⟦' in whole:
        notes.append((kind, 'в странице остались метки ⟦n⟧'))
    nq = sum(len(m['questions']) for m in data['modules'])
    nsc = sum(1 for m in data['modules'] for q in m['questions'] if q.get('scene'))
    stats = {'bytes': len(out.encode()), 'asset_bytes': sum(len(t.encode()) for t in assets.values()), 'modules': len(data['modules']), 'questions': nq, 'scenes': nsc,
             'signs': len(data['signs']), 'verified': verified, 'api': api, 'dashes': bad}
    return {'lang': lang, 'path': out_path(lang, api), 'html': out, 'assets': assets, 'data': data, 'report': rep, 'notes': notes, 'stats': stats}


def write_assets(res):
    """Файлы кода, схем и данных страниц (имя с отпечатком), шрифты, индекс вопросов для сервера и админки. Старые файлы убираются."""
    adir = os.path.join(PUBLIC, 'assets')
    os.makedirs(adir, exist_ok=True)
    langs = [r['lang'] for r in res]
    for n in os.listdir(adir):
        m = re.match(r'^(app|scene|data)\.(\w+)\.[0-9a-f]{8}\.(js|json)$', n)
        if m and m.group(2) in langs:
            os.remove(os.path.join(adir, n))
    for r in res:
        for rel, text in r['assets'].items():
            with open(os.path.join(PUBLIC, rel), 'w', encoding='utf-8') as f:
                f.write(text)
    fdir = os.path.join(adir, 'fonts')
    os.makedirs(fdir, exist_ok=True)
    for n in os.listdir(os.path.join(BASE, 'src', 'fonts')):
        shutil.copy(os.path.join(BASE, 'src', 'fonts', n), os.path.join(fdir, n))
    ru = next((r for r in res if r['lang'] == 'ru'), None)
    if ru:
        d = ru['data']
        qi = {'m': {m['id']: m['title'] for m in d['modules']},
              'q': {q['id']: {'q': q['q'], 'm': m['id']} for m in d['modules'] for q in m['questions']},
              'z': [sg['code'] for sg in d.get('signs', [])]}
        with open(os.path.join(adir, 'qindex.json'), 'w', encoding='utf-8') as f:
            json.dump(qi, f, ensure_ascii=False, separators=(',', ':'))


def parse_args(argv):
    opts = {'langs': ['ru'], 'api': False, 'verified': False, 'strict': False}
    it = iter(argv)
    for a in it:
        if a in ('--api', '--verified', '--strict'):
            opts[a[2:]] = True
        elif a == '--lang' or a.startswith('--lang='):
            v = a.split('=', 1)[1] if '=' in a else next(it, '')
            opts['langs'] = list(LANGS) if v == 'all' else [x.strip() for x in v.split(',') if x.strip()]
        else:
            raise SystemExit('build.py: неизвестный параметр %s\n%s' % (a, __doc__))
    bad = [x for x in opts['langs'] if x not in LANGS]
    if bad or not opts['langs']:
        raise SystemExit('build.py: неизвестный язык %s (ru, kk, en, all)' % (bad or ''))
    return opts


def main(argv):
    a = parse_args(argv)
    if not a['api'] and any(x != 'ru' for x in a['langs']):
        print('build.py: kk и en собираются только с --api (офлайн-артефакт site/joldas-pdd.html только на русском)', file=sys.stderr)
        return 2
    ru = C.load_ru(BASE)
    res = [build_lang(lang, ru, a['api'], a['verified'], a['strict']) for lang in a['langs']]
    errors = []
    for r in res:
        if a['strict']:
            errors += r['report'].errors()
        errors += ['[%s] %s' % (r['lang'], t) for k, t in r['notes'] if k == 'err']
    if errors:
        print('ОШИБКА СБОРКИ (--strict): непереведенное или ошибки, файлы не записаны:', file=sys.stderr)
        for e in errors:
            print('  ' + e, file=sys.stderr)
        return 1
    for r in res:
        os.makedirs(os.path.dirname(r['path']), exist_ok=True)
        with open(r['path'], 'w', encoding='utf-8') as f:
            f.write(r['html'])
    if a['api']:
        write_assets(res)
    if a['api']:
        if set(a['langs']) == set(LANGS):
            # статические страницы, sitemap, robots, llms.txt на всех трех языках
            _, seo_problems = SEO.generate(strict=False, datas={r['lang']: r['data'] for r in res})
            if seo_problems and a['strict']:
                print('ОШИБКА SEO (--strict):', file=sys.stderr)
                for x in seo_problems:
                    print('  ' + x, file=sys.stderr)
                return 1
        else:
            print('SEO-страницы не пересобраны (нужны все три языка: --lang all)')
            with open(os.path.join(BASE, 'site', 'public', 'robots.txt'), 'w', encoding='utf-8') as f:
                f.write('User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n')
    for r in res:
        st = r['stats']
        extra = '' if r['lang'] == 'ru' else ' translated %d/%d' % (len(r['report'].translated_q), st['questions'])
        print('lang', r['lang'], 'bytes', st['bytes'], 'asset_bytes', st['asset_bytes'], 'modules', st['modules'], 'questions', st['questions'], 'scenes', st['scenes'],
              'signs', st['signs'], 'verified', st['verified'], 'api', st['api'], 'dashes', st['dashes'],
              '->', os.path.relpath(r['path'], BASE) + extra)
    for r in res:
        if r['lang'] == 'ru' and not r['notes']:
            continue
        lines = [] if r['lang'] == 'ru' else r['report'].summary()
        lines += ['[%s] %s%s' % (r['lang'], 'ВНИМАНИЕ: ' if k == 'warn' else '', t) for k, t in r['notes']]
        if lines:
            print('\n'.join(lines))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
