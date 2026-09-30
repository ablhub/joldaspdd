"""Готовый первый экран в HTML (для быстрого показа на слабых телефонах).

Страница без прогресса и без входа (новый посетитель) показывает главный экран гостя. Раньше его рисовал только код приложения, то есть браузер
ждал скачивания и разбора всех данных (сотни КБ). Теперь этот экран лежит прямо в HTML: скрипт открывает собранные страницы ru, kk и en в чистом
браузере, берет готовую разметку шапки и главного экрана и вставляет ее между метками <!--pre:...--> в index.html. Приложение потом рисует то же самое
поверх (без сдвига). Вернувшемуся пользователю заготовку скрывает класс ret (см. RET_SCRIPT в build.py).

Запуск после build.py --api --lang all:  python3 tools/prerender.py [site/public]
Повторный запуск безопасен: прежняя заготовка между метками заменяется."""
import functools, http.server, os, re, socketserver, sys, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, 'site', 'public')
PAGES = (('ru', 'index.html', '/'), ('kk', 'kk/index.html', '/kk/'), ('en', 'en/index.html', '/en/'))
PARTS = (('app', '#app'), ('nav', '#nav'), ('acct', '#acct'), ('bnav', '#bnav'))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main():
    from playwright.sync_api import sync_playwright
    handler = functools.partial(Quiet, directory=PUB)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), handler)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = 'http://127.0.0.1:%d' % port
    done = []
    with sync_playwright() as p:
        br = p.chromium.launch()
        for lang, rel, url in PAGES:
            ctx = br.new_context(viewport={'width': 1280, 'height': 900})
            pg = ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.route('**/api/**', lambda r: r.fulfill(status=404, content_type='application/json', body='{}'))
            pg.goto(base + url, wait_until='load')
            pg.wait_for_selector('html[data-ready="1"]', state='attached', timeout=20000)   # приложение запущено и нарисовало экран сам
            pg.wait_for_selector('#app .hero', timeout=5000)
            got = {k: pg.evaluate('document.querySelector(%r).innerHTML' % sel) for k, sel in PARTS}
            bstyle = pg.evaluate("document.querySelector('#bnav').getAttribute('style')") or ''   # число колонок нижнего меню задает приложение: без него меню сдвигается при запуске
            ctx.close()
            if errs:
                raise SystemExit('prerender %s: ошибки страницы: %s' % (lang, errs[:3]))
            if 'class="hero' not in got['app'] or 'data-go="register"' not in got['app'] or 'data-go=' not in got['nav']:
                raise SystemExit('prerender %s: на экране нет ожидаемой разметки гостя' % lang)
            path = os.path.join(PUB, rel)
            html = open(path, encoding='utf-8').read()
            for k, _ in PARTS:
                pat = re.compile(r'<!--pre:%s-->.*?<!--/pre:%s-->' % (k, k), re.S)
                if not pat.search(html):
                    raise SystemExit('prerender %s: в %s нет меток pre:%s (собрать сайт с --api)' % (lang, rel, k))
                html = pat.sub(lambda m: '<!--pre:%s-->%s<!--/pre:%s-->' % (k, got[k], k), html, count=1)
            if bstyle:
                html = re.sub(r'(<nav class="bnav" id="bnav")( style="[^"]*")?', lambda m: m.group(1) + ' style="%s"' % bstyle.replace('"', '&quot;'), html, count=1)
            # заголовок SEO-блока ниже главного экрана: главный заголовок страницы теперь один (h1 героя)
            html = re.sub(r'(<div class="seo-pre">)<h1>(.*?)</h1>', r'\1<h2 class="seo-h">\2</h2>', html, count=1, flags=re.S)
            open(path, 'w', encoding='utf-8').write(html)
            done.append('%s: %d КБ разметки' % (lang, sum(len(v) for v in got.values()) // 1024))
        br.close()
    srv.shutdown()
    print('prerender: ' + '; '.join(done))


if __name__ == '__main__':
    main()
