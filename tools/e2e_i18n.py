"""E2E языков сайта: страницы /kk/ и /en/, переключатель языка, язык аккаунта, ответы сервера на языке страницы.
Usage: python3 tools/e2e_i18n.py http://127.0.0.1:3200 [admin-password]
Сервер: tools/dev_server.sh (база joldas_dev). Страницы собирает запускающий: python3 build.py --verified --api --lang all.
Переводы интерфейса могут быть еще не готовы: проверки не зависят от них, кроме сообщений сервера из server/src/i18n.js.
Пароль админки нужен только для проверки текста поддержки (по умолчанию admin-password-1; на чистой базе задается сам).
Каждый прогон делает 2 запроса регистрации, а сервер принимает 20 в час с одного адреса (вместе с tools/seed_dev.js):
при ошибке регистрации после нескольких прогонов перезапустите tools/dev_server.sh."""
import sys, json, random, subprocess, datetime, urllib.request, urllib.error, http.cookiejar
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3200'
APW = sys.argv[2] if len(sys.argv) > 2 else 'admin-password-1'
fails = []
def check(c, m):
    print(('OK   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
def sql(q):
    return subprocess.run(['psql', '-h', '/tmp', '-p', '55432', '-U', 'postgres', '-d', 'joldas_dev', '-Atc', q], capture_output=True, text=True).stdout.strip()
def ls(pg, k):
    return pg.evaluate("JSON.parse(localStorage.getItem('%s')||'null')" % k)
def years_ago(n):
    d = datetime.date.today(); return d.replace(year=d.year - n, day=min(d.day, 28)).isoformat()
def html_lang(pg):
    return pg.evaluate('document.documentElement.lang')
def fetch_page(path):
    try:
        with urllib.request.urlopen(BASE + path) as r: return r.status, r.read(4000).decode('utf-8', 'replace')
    except urllib.error.HTTPError as e: return e.code, ''

# номер для этого прогона: +7 708 XXX XX XX (в конце удаляется)
DIGITS = '708' + str(random.randint(1000000, 9999999))
PHONE = '+7' + DIGITS
MSG_BAD_LOGIN = {'ru': 'Неверный телефон или пароль', 'kk': 'Телефон немесе құпиясөз қате', 'en': 'Wrong phone number or password'}
MSG_TAKEN_EN = 'This number is already registered. Log in with your number and password'
def cleanup():
    sql("update events set data = data - 'ip' - 'ua' where user_id in (select id from users where phone = '%s'); delete from users where phone = '%s'" % (PHONE, PHONE))
cleanup()

# 1. страницы отдаются, у <html> правильный lang
for path, lang in [('/', 'ru'), ('/kk/', 'kk'), ('/en/', 'en'), ('/kk', 'kk'), ('/en', 'en')]:
    st, body = fetch_page(path)
    check(st == 200 and ('<html lang="%s"' % lang) in body, 'GET %s: 200, <html lang="%s">' % (path, lang))

with sync_playwright() as p:
    br = p.chromium.launch()
    errs = []
    def page(ctx, name):
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(name + ': ' + str(e))); return pg

    # 2. переключатель языка на каждой странице, текущий язык отмечен
    A = br.new_context(viewport={'width': 1280, 'height': 900})
    pa = page(A, 'A')
    for path, lang in [('/kk/', 'kk'), ('/en/', 'en'), ('/', 'ru')]:
        pa.goto(BASE + path + '#about'); pa.wait_for_selector('html[data-ready="1"]', state='attached'); pa.wait_for_timeout(700)
        codes = pa.locator('.langsw button[data-act="lang"]').evaluate_all('bs => bs.map(b => b.getAttribute("data-code"))')
        cur = pa.locator('.langsw button[aria-current="true"]')
        check(html_lang(pa) == lang and sorted(codes) == ['en', 'kk', 'ru'] and cur.count() == 1 and cur.get_attribute('data-code') == lang,
              '%s: html lang=%s, switcher %s, current %s' % (path, html_lang(pa), codes, cur.get_attribute('data-code') if cur.count() else None))
    # 3. «Eng» на / ведет на /en/ с тем же hash; выбор запоминается
    pa.goto(BASE + '/#privacy'); pa.wait_for_selector('html[data-ready="1"]', state='attached'); pa.wait_for_timeout(700)
    pa.click('.langsw button[data-code="en"]')
    pa.wait_for_url(BASE + '/en/#privacy', timeout=10000); pa.wait_for_timeout(500)
    check(pa.url == BASE + '/en/#privacy' and html_lang(pa) == 'en', 'click «Eng» on / opens /en/ with hash: ' + pa.url)
    check(pa.evaluate("localStorage.getItem('joldas-lang')") == 'en', 'chosen language saved in browser')
    pa.goto(BASE + '/#about'); pa.wait_for_selector('html[data-ready="1"]', state='attached'); pa.wait_for_timeout(1200)
    check(pa.url == BASE + '/en/#about', 'root page opens saved language with hash: ' + pa.url)
    pa.click('.langsw button[data-code="ru"]')
    pa.wait_for_url(BASE + '/#about', timeout=10000); pa.wait_for_timeout(800)
    check(pa.url == BASE + '/#about' and html_lang(pa) == 'ru', 'back to Russian: ' + pa.url)
    pa.goto(BASE + '/'); pa.wait_for_selector('html[data-ready="1"]', state='attached'); pa.wait_for_timeout(800)
    check(pa.url.rstrip('/') == BASE and html_lang(pa) == 'ru', 'root stays Russian after choosing Russian')

    # 4. регистрация на /kk/: язык аккаунта kk
    B = br.new_context(viewport={'width': 1280, 'height': 900})
    pb = page(B, 'B')
    pb.goto(BASE + '/kk/#register'); pb.wait_for_selector('html[data-ready="1"]', state='attached'); pb.wait_for_timeout(800)
    pb.fill('#rg-first', 'айдана'); pb.fill('#rg-last', 'серікқызы')
    pb.fill('#rg-birth', years_ago(25)); pb.select_option('#rg-cat', 'B')
    pb.click('#rg-phone'); pb.type('#rg-phone', DIGITS)
    pb.fill('#rg-pass', 'kk-pass-2026'); pb.check('#rg-pd')
    pb.click('#rg-submit'); pb.wait_for_timeout(1800)
    auth = ls(pb, 'joldas-auth-v1')
    check(bool(auth and auth.get('token')) and auth['user'].get('lang') == 'kk', 'registered on /kk/, user.lang in response: %s' % (auth and auth['user'].get('lang')))
    uid = sql("select id from users where phone = '%s'" % PHONE)
    check(bool(uid) and sql("select lang from users where id = '%s'" % uid) == 'kk', 'server: users.lang = kk')
    check(sql("select data->>'lang' from events where user_id = '%s' and type = 'register'" % uid) == 'kk', 'server: register event has lang kk')
    # 5. переключатель у вошедшего ученика меняет язык аккаунта (PATCH /me {lang})
    if uid:
        pb.click('.langsw button[data-code="en"]'); pb.wait_for_timeout(2000)
        check('/en/' in pb.url and html_lang(pb) == 'en', 'logged-in switch opens /en/: ' + pb.url)
        check(sql("select lang from users where id = '%s'" % uid) == 'en', 'server: users.lang = en after switch')
        check(sql("select count(*) from events where user_id = '%s' and type = 'profile' and data->'fields' ? 'lang'" % uid) == '1', 'server: profile event with fields [lang]')
        check((ls(pb, 'joldas-auth-v1') or {}).get('token') == auth['token'], 'still logged in on /en/')

    # 6. сообщения сервера на языке страницы
    C = br.new_context(viewport={'width': 390, 'height': 844})
    pc = page(C, 'C')
    if uid:
        pc.goto(BASE + '/en/#register'); pc.wait_for_selector('html[data-ready="1"]', state='attached'); pc.wait_for_timeout(800)
        pc.fill('#rg-first', 'Emily'); pc.fill('#rg-last', 'Brown'); pc.fill('#rg-birth', years_ago(30)); pc.select_option('#rg-cat', 'B')
        pc.click('#rg-phone'); pc.type('#rg-phone', DIGITS); pc.fill('#rg-pass', 'en-pass-2026'); pc.check('#rg-pd')
        pc.click('#rg-submit'); pc.wait_for_timeout(1500)
        check(pc.inner_text('#rg-msg').strip() == MSG_TAKEN_EN, 'en: duplicate phone message: ' + pc.inner_text('#rg-msg').strip())
    for path, lang in [('/en/', 'en'), ('/kk/', 'kk'), ('/', 'ru')]:
        pc.goto(BASE + path + '#login'); pc.wait_for_selector('html[data-ready="1"]', state='attached'); pc.wait_for_timeout(800)
        pc.click('#lg-phone'); pc.type('#lg-phone', DIGITS); pc.fill('#lg-pass', 'wrong-pass-1')
        pc.click('#lg-submit'); pc.wait_for_timeout(1200)
        txt = pc.inner_text('#lg-msg').strip()
        check(txt == MSG_BAD_LOGIN[lang], '%s: login error in page language: %s' % (path, txt))

    # 7. текст поддержки на языке страницы (настройки через API админки)
    jar = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    def adm(method, path, body=None):
        req = urllib.request.Request(BASE + path, data=None if body is None else json.dumps(body).encode(), method=method,
                                     headers={'Content-Type': 'application/json', 'X-Requested-With': 'joldas'})
        try:
            with op.open(req) as r: return r.status, json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
    st, w = adm('GET', '/admin/api/whoami')
    if not w.get('configured'):
        try:
            open('/tmp/jdev/var/setup-code', 'w').write('e2e-i18n-setup\n')   # каталог JOLDAS_VAR из tools/dev_server.sh
            st, _ = adm('POST', '/admin/setup', {'code': 'e2e-i18n-setup', 'password': APW})
        except OSError:
            st = 0
    else:
        st, _ = adm('POST', '/admin/login', {'password': APW})
    if st != 200:
        print('SKIP support text: no admin session (pass the admin password as the 2nd argument)')
    else:
        st, cur = adm('GET', '/admin/api/settings'); prev = cur['settings']
        mine = dict(prev, supportText='WhatsApp +7 700 000 00 01', supportTextKk='WhatsApp +7 700 000 00 01, қазақ тілінде', supportTextEn='')
        st, _ = adm('POST', '/admin/api/settings', {'settings': mine})
        check(st == 200, 'admin: support texts saved (kk set, en empty)')
        for path, want, not_want in [('/kk/', 'қазақ тілінде', None), ('/en/', 'WhatsApp +7 700 000 00 01', 'қазақ тілінде'), ('/', 'WhatsApp +7 700 000 00 01', 'қазақ тілінде')]:
            pc.goto(BASE + path + '#login'); pc.wait_for_selector('html[data-ready="1"]', state='attached'); pc.wait_for_timeout(700)
            pc.click('button[data-act="forgot"]'); pc.wait_for_timeout(900)
            box = pc.inner_text('#forgot-box')
            check(want in box and (not not_want or not_want not in box), '%s: support text in forgot box (%s)' % (path, 'kk text' if path == '/kk/' else 'Russian fallback'))
        st, _ = adm('POST', '/admin/api/settings', {'settings': prev})
        check(st == 200, 'admin: previous settings restored')

    check(not errs, 'no page errors %s' % errs[:3])
    br.close()

cleanup()
print('FAILS', len(fails))
for f in fails: print(' -', f)
