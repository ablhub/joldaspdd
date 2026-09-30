import asyncio, json, os
ROOT = os.path.dirname(os.path.abspath(__file__))
from playwright.async_api import async_playwright
html=open(ROOT+'/site/joldas-pdd.html').read()
doc='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}body{margin:0}img{max-width:100%}</style>'+html.replace('<header','</head><body><header',1)+'</body></html>'
open(ROOT+'/site/_test.html','w').write(doc)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        errs=[]
        pg=await b.new_page(viewport={'width':1280,'height':900})
        pg.on('pageerror',lambda e: errs.append('pageerror: '+str(e)))
        pg.on('console',lambda m: errs.append('console: '+m.text) if m.type=='error' else None)
        await pg.goto('file://'+ROOT+'/site/_test.html')
        await pg.wait_for_timeout(800)
        async def txt(sel): return (await pg.inner_text(sel))[:200].replace('\n',' | ')
        print('HOME:', await txt('#app'))
        # profile
        await pg.fill('#pf-name','Айгерим'); await pg.fill('#pf-date','2026-10-10')
        await pg.click('button[data-act="pf-daily"][data-n="50"]')
        await pg.click('#pf button[type=submit]')
        print('PLAN:', await txt('.tasks'))
        # lesson
        await pg.click('button[data-go="m11"]')
        print('LESSON:', await txt('#app'))
        await pg.click('button[data-act="quiz"][data-kind="lesson"]')
        for i in range(10):
            await pg.keyboard.press(str((i%3)+1))
            await pg.wait_for_timeout(30)
            ex=await pg.query_selector('.explain')
            if not ex:
                print('NOEXPLAIN at', i, (await pg.inner_text('#app'))[:400]); print(errs); break
            await pg.keyboard.press('Enter')
            await pg.wait_for_timeout(30)
        print('SUMMARY:', await txt('.quiz'))
        # errors view
        await pg.click('.nav button[data-go="errors"]')
        print('ERRORS:', await txt('#app'))
        # exam
        await pg.click('.nav button[data-go="exam"]')
        await pg.click('button[data-act="ex-start"]')
        for i in range(40):
            await pg.keyboard.press(str((i%3)+1))
            await pg.keyboard.press('Enter')
            await pg.wait_for_timeout(20)
        print('AFTER40:', await txt('.examside'))
        await pg.click('button[data-act="ex-finish"]')
        print('RESULT:', await txt('.quiz'))
        await pg.click('button[data-act="ex-wrong"]')
        print('EXWRONG:', await txt('.qhead'))
        # signs
        await pg.click('.nav button[data-go="signs"]')
        await pg.fill('#sg-q','уступ')
        print('SIGNSEARCH:', await txt('#sg-grid'))
        await pg.click('.sg')
        print('OVERLAY:', await txt('.sheet'))
        await pg.click('.sheet button[data-act="close"]')
        await pg.click('button[data-act="sgroup"]:nth-of-type(3)')
        # sign quiz
        await pg.click('button[data-act="quiz"][data-kind="signs"]')
        await pg.keyboard.press('1'); print('SIGNQ:', await txt('.qcard'))
        # practice
        await pg.click('.nav button[data-go="practice"]')
        for t in ['autodrom','city','check']:
            await pg.click(f'button[data-act="ptab"][data-t="{t}"]')
        await pg.click('button[data-act="ptab"][data-t="autodrom"]')
        await pg.click('button[data-act="aopen"][data-id="a05"]')
        await pg.click('button[data-act="adone"][data-id="a05"]')
        print('AUTODROM:', await txt('.tabs'))
        await pg.click('button[data-act="ptab"][data-t="check"]')
        await pg.click('.checklist label >> nth=0')
        # train view + smart
        await pg.click('.nav button[data-go="train"]')
        await pg.click('button[data-act="quiz"][data-kind="smart"]')
        await pg.keyboard.press('3')
        # navigate away mid-quiz -> banner
        await pg.click('.nav button[data-go="plan"]')
        print('BANNER:', await txt('.live'))
        # export/import
        await pg.click('details summary')
        await pg.click('button[data-act="export"]')
        code=await pg.input_value('#xfer'); print('CODE len', len(code))
        await pg.click('button[data-act="import"]')
        # reload persistence
        await pg.reload(); await pg.wait_for_timeout(500)
        print('RELOAD:', await txt('.kpis'))
        await pg.goto('file://'+ROOT+'/site/_test.html#about'); await pg.wait_for_timeout(300)
        await pg.click('.nav button[data-go="plan"]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=ROOT+'/site/shot-desktop.png', full_page=False)
        # mobile
        m=await b.new_page(viewport={'width':390,'height':844}, device_scale_factor=2)
        m.on('pageerror',lambda e: errs.append('m pageerror: '+str(e)))
        await m.goto('file://'+ROOT+'/site/_test.html'); await m.wait_for_timeout(600)
        sw=await m.evaluate('document.documentElement.scrollWidth'); print('mobile scrollWidth', sw)
        await m.screenshot(path=ROOT+'/site/shot-mobile-home.png')
        await m.click('.bnav button[data-go="learn"]'); await m.click('button[data-go="m07"]')
        await m.click('button[data-act="quiz"][data-kind="lesson"] >> nth=0'); await m.keyboard.press('2')
        sw2=await m.evaluate('document.documentElement.scrollWidth'); print('mobile quiz scrollWidth', sw2)
        await m.screenshot(path=ROOT+'/site/shot-mobile-quiz.png')
        for v in ['exam','practice','signs','errors','train','about']:
            await m.evaluate(f"location.hash='{v}'"); await m.wait_for_timeout(150)
            w=await m.evaluate('document.documentElement.scrollWidth')
            if w>390: print('OVERFLOW', v, w)
        print('ERRS', errs)
        await b.close()
asyncio.run(main())
