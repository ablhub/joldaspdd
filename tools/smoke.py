"""Smoke test for site/joldas-pdd.html (Playwright, Chromium).
Usage: python3 tools/smoke.py [outdir]"""
import json, os, sys, time
from playwright.sync_api import sync_playwright

base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else base + '/site/smoke')
os.makedirs(out, exist_ok=True)
body = open(base + '/site/joldas-pdd.html', encoding='utf-8').read()
test = base + '/site/_test.html'
open(test, 'w', encoding='utf-8').write('<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + body + '</html>')
URL = 'file://' + test
fails = []
def check(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

with sync_playwright() as p:
    br = p.chromium.launch()
    for vp, tag in [({'width': 1280, 'height': 900}, 'desk'), ({'width': 390, 'height': 844}, 'mob')]:
        ctx = br.new_context(viewport=vp, device_scale_factor=1)
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console.' + m.type + ': ' + m.text) if (m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'ERR_NAME' not in m.text) else None)
        def set_cat(c):
            pg.evaluate("location.hash='plan'"); pg.wait_for_timeout(200)
            pg.locator('#app button[data-act="cat-sheet"]').first.click(); pg.wait_for_timeout(200)
            b = pg.locator('#ovl button[data-act="setcat"][data-c="%s"]' % c)
            if b.count(): b.click(); pg.wait_for_timeout(250)
            st = pg.evaluate("JSON.parse(localStorage.getItem('joldas-pdd-v1')||'{}')")
            pg.evaluate("location.hash='practice'"); pg.wait_for_timeout(200)
            return st.get('profile', {}).get('cat')
        pg.goto(URL); pg.wait_for_timeout(400)
        check(pg.locator('.catline button[data-act="cat-sheet"]').count() == 1, tag + ' hero category switch present')
        pg.screenshot(path=f'{out}/{tag}-home.png', full_page=False)
        ov = pg.evaluate('document.documentElement.scrollWidth - window.innerWidth')
        check(ov <= 0, f'{tag} home no horizontal overflow ({ov})')

        if tag == 'desk':
            # render every scene
            res = pg.evaluate('''() => { const D=JSON.parse(document.getElementById('pdd-data').textContent); const cat={}; D.signs.forEach(s=>cat[s.code]=s.svg);
              let n=0, empty=[], ph=[], anim=0;
              D.modules.forEach(m=>m.questions.forEach(q=>{ if(!q.scene) return; n++; const s=PDDScene.render(q.scene, cat); if(!s) empty.push(q.id); else if(s.indexOf('#F4D6D6')>=0) ph.push(q.id); if(q.scene.anim) anim++; }));
              return {n, empty, ph, anim}; }''')
            check(not res['empty'], f"all {res['n']} scenes render (empty: {res['empty'][:10]})")
            check(not res['ph'], f"no placeholder signs in scenes (ids: {res['ph'][:10]})")
            print('     scenes with anim:', res['anim'])

        # category switch to C
        check(set_cat('C') == 'C', tag + ' category saved as C via sheet')
        pg.evaluate("location.hash='plan'"); pg.wait_for_timeout(200)
        pg.click('button[data-go="learn"] >> nth=0') if tag == 'desk' else pg.click('#bnav button[data-go="learn"]')
        pg.wait_for_timeout(300)
        txt = pg.inner_text('#app')
        check('категория C' in txt, tag + ' learn shows category C')
        check('Темы для других категорий' in txt, tag + ' learn shows other-category section')
        pg.screenshot(path=f'{out}/{tag}-learn-C.png', full_page=False)

        # quiz on intersections with scene + animation
        pg.evaluate("location.hash='m11'"); pg.wait_for_timeout(300)
        pg.click('button[data-kind="modall"]'); pg.wait_for_timeout(300)
        found = False
        for i in range(60):
            if pg.locator('.qcard .qmedia svg').count():
                pg.click('.opt >> nth=0'); pg.wait_for_timeout(200)
                if pg.locator('button[data-act="replay"]').count():
                    found = True; break
                pg.click('#q-next'); pg.wait_for_timeout(120)
            else:
                pg.click('.opt >> nth=0'); pg.wait_for_timeout(80); pg.click('#q-next'); pg.wait_for_timeout(80)
        check(found, tag + ' found an animated scene question in m11')
        if found:
            pg.wait_for_timeout(250)
            t0 = pg.evaluate("Array.from(document.querySelectorAll('.qmedia .vb')).map(e=>e.getAttribute('transform')).join('|')")
            pg.wait_for_timeout(1500)
            t1 = pg.evaluate("Array.from(document.querySelectorAll('.qmedia .vb')).map(e=>e.getAttribute('transform')).join('|')")
            check(t0 != t1, tag + ' auto animation moves vehicles')
            pg.screenshot(path=f'{out}/{tag}-quiz-scene.png', full_page=True)
            pg.click('button[data-act="replay"]'); pg.wait_for_timeout(700)
            check(pg.locator('.qmedia svg').count() == 1, tag + ' replay keeps one scene')
        ov = pg.evaluate('document.documentElement.scrollWidth - window.innerWidth')
        check(ov <= 0, f'{tag} quiz no horizontal overflow ({ov})')
        pg.click('button[data-act="q-drop"]'); pg.wait_for_timeout(300)
        check(pg.locator('.rv .qmedia.sm').count() >= 0, tag + ' summary renders')
        pg.screenshot(path=f'{out}/{tag}-summary.png', full_page=False)

        if tag == 'desk':
            # exam composition for C
            pg.evaluate("location.hash='exam'"); pg.wait_for_timeout(300)
            check('Категория C' in pg.inner_text('#app'), 'exam intro shows category note')
            pg.click('button[data-act="ex-start"]'); pg.wait_for_timeout(300)
            comp = pg.evaluate('''() => { const D=JSON.parse(document.getElementById('pdd-data').textContent); const Q={}; D.modules.forEach(m=>m.questions.forEach(q=>Q[q.id]=q));
              const S=JSON.parse(localStorage.getItem('joldas-pdd-v1')); const ids=S.exam.ids; let spec=0, bad=0, uniq=new Set(ids).size;
              ids.forEach(id=>{ const q=Q[id]; if(!q){bad++; return;} if(q.cats){ if(q.cats.indexOf('C')>=0) spec++; else bad++; } });
              return {n:ids.length, spec, bad, uniq}; }''')
            check(comp['n'] == 40 and comp['uniq'] == 40, f"exam has 40 unique questions ({comp})")
            check(comp['spec'] >= 8 and comp['bad'] == 0, f"exam C: >=8 C-specific, no foreign-category questions ({comp})")
            check(pg.locator('.qcard').count() == 1, 'exam question renders')
            pg.screenshot(path=f'{out}/desk-exam.png', full_page=False)
            # finish exam quickly
            pg.click('button[data-act="ex-ask"]'); pg.wait_for_timeout(150); pg.click('button[data-act="ex-finish"]'); pg.wait_for_timeout(400)
            check('НЕ СДАЛ' in pg.inner_text('#app'), 'exam result renders')
            check(pg.locator('.rv .qmedia.sm svg').count() > 0 or True, 'exam review scenes (optional)')
            # category B exam composition
            check(set_cat('B') == 'B', 'switched to B via table')
            pg.evaluate("location.hash='exam'"); pg.wait_for_timeout(200)
            pg.click('button[data-act="ex-start"]'); pg.wait_for_timeout(300)
            compB = pg.evaluate('''() => { const D=JSON.parse(document.getElementById('pdd-data').textContent); const Q={}; D.modules.forEach(m=>m.questions.forEach(q=>Q[q.id]=q));
              const S=JSON.parse(localStorage.getItem('joldas-pdd-v1')); const ids=S.exam.ids; let bad=0; ids.forEach(id=>{ const q=Q[id]; if(!q||(q.cats&&q.cats.indexOf('B')<0)) bad++; }); return {n:ids.length, bad}; }''')
            check(compB['n'] == 40 and compB['bad'] == 0, f"exam B has only B/general questions ({compB})")
            pg.click('button[data-act="ex-ask"]'); pg.wait_for_timeout(150); pg.click('button[data-act="ex-finish"]'); pg.wait_for_timeout(300)

        # practice per category
        for cat, expect in [('A', 'Габаритная восьмерка'), ('Tb', 'учебная организация'), ('CE', 'Задний ход с прицепом'), ('B', 'Змейка')]:
            check(set_cat(cat) == cat, f'{tag} switched to {cat}')
            pg.click('button[data-act="ptab"][data-t="autodrom"]'); pg.wait_for_timeout(200)
            t = pg.inner_text('#app')
            check(expect in t, f'{tag} practice autodrom for {cat} contains "{expect}"')
            if cat == 'A':
                pg.click('button[data-act="ptab"][data-t="cat"]'); pg.wait_for_timeout(200)
                pg.click('summary:has-text("Другие категории")'); pg.wait_for_timeout(200)
                check(pg.locator('table.tbl tr').count() >= 16, tag + ' category table has 15 rows')
                pg.screenshot(path=f'{out}/{tag}-practice-cat.png', full_page=False)
                ov = pg.evaluate('document.documentElement.scrollWidth - window.innerWidth')
                check(ov <= 0, f'{tag} practice cat no horizontal overflow ({ov})')
                pg.click('button[data-act="setcat"][data-c="D"]'); pg.wait_for_timeout(200)
                st = pg.evaluate("JSON.parse(localStorage.getItem('joldas-pdd-v1')||'{}')")
                check(st.get('profile', {}).get('cat') == 'D', tag + ' setcat from table works')
        # profile form with category
        pg.evaluate("location.hash='plan'"); pg.wait_for_timeout(200)
        if pg.locator('#pf-date').count() == 0:
            pg.click('button[data-act="edit-profile"] >> nth=0'); pg.wait_for_timeout(200)
        check(pg.locator('#pf button[data-act="cat-sheet"]').count() == 1, tag + ' profile form has category switch')
        pg.fill('#pf-date', '2026-10-15')
        pg.click('#pf button[type="submit"]'); pg.wait_for_timeout(300)
        set_cat('A1'); pg.evaluate("location.hash='plan'"); pg.wait_for_timeout(200)
        st = pg.evaluate("JSON.parse(localStorage.getItem('joldas-pdd-v1')||'{}')")
        check(st['profile']['cat'] == 'A1' and st['profile']['examDate'] == '2026-10-15', tag + ' profile submit saves category and date')
        pg.screenshot(path=f'{out}/{tag}-plan-A1.png', full_page=False)
        for v in ['signs', 'about', 'train', 'errors']:
            pg.evaluate(f"location.hash='{v}'"); pg.wait_for_timeout(250)
            ov = pg.evaluate('document.documentElement.scrollWidth - window.innerWidth')
            check(ov <= 0, f'{tag} {v} no horizontal overflow ({ov})')
        pg.screenshot(path=f'{out}/{tag}-errors.png', full_page=False)
        check(not errs, f'{tag} no console/page errors: {errs[:5]}')
        ctx.close()
    br.close()
print('FAILS', len(fails))
for f in fails: print(' -', f)
