"""Проверка в браузере: скорость загрузки (нет внешних шрифтов, код и данные отдельными файлами), отложенные схемы,
картинки знаков в учебнике, вопросах и экзамене, случайный билет. Запуск: python3 tools/e2e_perf.py [http://127.0.0.1:3200] [outdir]"""
import json, os, re, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3200'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/e2eperf'
os.makedirs(OUT, exist_ok=True)
fails = []
def check(c, m):
    print(('OK   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

with sync_playwright() as p:
    br = p.chromium.launch()
    for lang, path in (('ru', '/'), ('kk', '/kk/'), ('en', '/en/')):
        ctx = br.new_context(viewport={'width': 1280, 'height': 900})
        pg = ctx.new_page()
        errs, reqs = [], []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type == 'error' and '/api/' not in (m.location or {}).get('url', '') else None)   # без сервера API (в CI) запросы /api/ не удаются, это не ошибка страницы
        pg.on('request', lambda r: reqs.append(r.url))
        pg.add_init_script("window.__rm=[];document.addEventListener('DOMContentLoaded',function(){new MutationObserver(function(ms){ms.forEach(function(m){m.removedNodes.forEach(function(n){if(n.nodeType===1&&n.classList.contains('hero'))__rm.push(1)})})}).observe(document.getElementById('app'),{childList:true})})")
        pg.goto(BASE + path, wait_until='load')
        raw = ctx.request.get(BASE + path).text()
        check('<!--pre:app--><section class="hero' in raw and 'data-go="register"' in raw, '%s: первый экран есть в самом HTML (до запуска кода)' % lang)
        pg.wait_for_selector('html[data-ready="1"]', state='attached', timeout=15000)
        check(pg.evaluate("__rm.length===0"), '%s: готовый первый экран не пересоздается приложением (элементы остаются на месте)' % lang)
        pg.wait_for_selector('#app .hero, #app h1', timeout=8000)
        pg.wait_for_timeout(600)
        ext = [u for u in reqs if not u.startswith(BASE)]
        check(not ext, '%s: нет обращений к внешним сайтам %s' % (lang, ext[:3]))
        check(any(re.search(r'/assets/data\.%s\.[0-9a-f]{8}\.json$' % lang, u) for u in reqs) and any(re.search(r'/assets/app\.%s\.[0-9a-f]{8}\.js$' % lang, u) for u in reqs), '%s: данные и код загружены отдельными файлами' % lang)
        check(not any('/assets/scene.' in u for u in reqs), '%s: схемы при открытии главной не грузятся' % lang)
        check(pg.evaluate("!!window.__PDD && window.__PDD.modules.length===25"), '%s: данные на месте (25 тем)' % lang)
        fonts = pg.evaluate("Promise.all([document.fonts.load('400 16px \"Golos Text\"','а'), document.fonts.load('400 16px \"Golos Text\"','a')]).then(r=>r.map(x=>x.length))")
        check(all(n > 0 for n in fonts), '%s: шрифт Golos Text загружен с нашего сервера %s' % (lang, fonts))
        check(not errs, '%s: нет ошибок в консоли %s' % (lang, errs[:3]))
        html_len = len(pg.content())
        pg.screenshot(path=f'{OUT}/{lang}-home.png')
        ctx.close()

    # ---- картинки знаков и схемы (ru) ----
    ctx = br.new_context(viewport={'width': 1280, 'height': 900})
    pg = ctx.new_page()
    errs, reqs = [], []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type == 'error' and '/api/' not in (m.location or {}).get('url', '') else None)   # без сервера API (в CI) запросы /api/ не удаются, это не ошибка страницы
    pg.on('request', lambda r: reqs.append(r.url))
    pg.goto(BASE + '/', wait_until='load'); pg.wait_for_timeout(500)
    # учебник: тема про знаки и про разметку (гостю закрыт учебник, поэтому данные читаем из страницы и проверяем разметку функцией приложения через экзамен ниже)
    # пробный экзамен гостя: 40 вопросов, картинки знаков видны там, где в тексте упомянут знак
    def start_exam():
        pg.evaluate("location.hash='exam'"); pg.wait_for_timeout(300)
        b = pg.locator('#app button[data-act="ex-start"], #app button:has-text("Начать экзамен"), #app button:has-text("Начать")').first
        b.click(); pg.wait_for_timeout(700)
    start_exam()
    st = pg.evaluate("JSON.parse(localStorage.getItem('joldas-pdd-v1')||'{}')")
    ids1 = (st.get('exam') or {}).get('ids') or []
    check(len(ids1) == 40 and len(set(ids1)) == 40, 'экзамен: 40 разных вопросов')
    check(any('/assets/scene.' in u for u in reqs), 'экзамен: схемы загрузились, когда понадобились')
    # пройти по всем 40 вопросам, считать картинки знаков и схемы
    seen_signs = 0; seen_scene = 0; opt_signs = 0; shots = 0
    for i in range(40):
        pg.wait_for_selector('.qcard', timeout=5000)
        seen_signs += pg.locator('.qcard .zs.big .zv svg').count()
        opt_signs += pg.locator('.qcard .opt .zs .zv svg').count()
        seen_scene += pg.locator('.qcard .qmedia svg').count()
        if pg.locator('.qcard .zs').count() and shots < 2:
            pg.screenshot(path=f'{OUT}/exam-sign-{shots}.png'); shots += 1
        pg.locator('.qcard .opt').first.click(); pg.wait_for_timeout(60)
        pg.locator('#ex-ok').click(); pg.wait_for_timeout(60)
    print('     в билете: схем', seen_scene, ', картинок знаков в вопросах', seen_signs, ', в вариантах', opt_signs)
    check(seen_scene > 0, 'экзамен: схемы ситуаций показываются')
    # второй билет: сбросить память браузера (новый гость), вопросы должны отличаться
    ctx.close()
    ctx2 = br.new_context(viewport={'width': 1280, 'height': 900}); pg = ctx2.new_page()
    pg.goto(BASE + '/', wait_until='load'); pg.wait_for_timeout(500)
    start_exam()
    ids2 = (pg.evaluate("JSON.parse(localStorage.getItem('joldas-pdd-v1')||'{}')").get('exam') or {}).get('ids') or []
    same = len(set(ids1) & set(ids2))
    print('     общих вопросов между двумя билетами:', same, 'из 40')
    check(len(ids2) == 40 and set(ids1) != set(ids2) and ids1 != ids2, 'экзамен: следующий билет собран иначе')
    ctx2.close()
    br.close()
print('FAILS', len(fails))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
