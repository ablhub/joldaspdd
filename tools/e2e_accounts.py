"""E2E: гость -> пробный тест -> регистрация -> обучение -> выход -> вход на другом устройстве -> профиль.
Usage: python3 tools/e2e_accounts.py http://127.0.0.1:3200   (сервер из tools/dev_server.sh --fresh)"""
import os, sys, json, subprocess, datetime
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3200'
fails = []
def check(c, m):
    print(('OK   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
def sql(q):
    return subprocess.run(['psql', '-h', '/tmp', '-p', '55432', '-U', 'postgres', '-d', 'joldas_dev', '-Atc', q], capture_output=True, text=True).stdout.strip()
def ls(pg, k):
    return pg.evaluate("JSON.parse(localStorage.getItem('%s')||'null')" % k)
def years_ago(n):
    d = datetime.date.today(); return d.replace(year=d.year - n).isoformat()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT = ROOT + '/site/smoke/'
os.makedirs(SHOT, exist_ok=True)
PHONE = '+7 705 111 22 33'

with sync_playwright() as p:
    br = p.chromium.launch()
    errs = []
    A = br.new_context(viewport={'width': 1280, 'height': 900})
    pa = A.new_page(); pa.on('pageerror', lambda e: errs.append('A: ' + str(e)))
    pa.goto(BASE + '/'); pa.wait_for_selector('html[data-ready="1"]', state='attached'); pa.wait_for_timeout(600)
    check('построенная под вас' in pa.inner_text('#app') and 'обучение бесплатное' in pa.inner_text('#app'), 'guest landing: individual course, free mentioned gently')
    check(pa.locator('#nav button').count() == 3, 'guest nav has 3 items')
    # gated
    pa.evaluate("location.hash='train'"); pa.wait_for_timeout(300)
    check(pa.locator('#reg-form').count() == 1 and 'Чтобы открыть раздел «Тренировка», зарегистрируйтесь' in pa.inner_text('#app'), 'training is gated')
    # trial exam
    pa.evaluate("location.hash='exam'"); pa.wait_for_timeout(300)
    pa.click('button[data-act="ex-start"]'); pa.wait_for_timeout(300)
    for i in range(40):
        pa.click('.opt >> nth=0'); pa.click('#ex-ok'); pa.wait_for_timeout(40)
    pa.wait_for_timeout(300)
    if pa.locator('button[data-act="ex-finish"]').count(): pa.click('button[data-act="ex-finish"]'); pa.wait_for_timeout(400)
    txt = pa.inner_text('#app')
    check('Сохранить результат и начать' in txt and 'из 40' in txt, 'trial result with register CTA')
    pa.screenshot(path=SHOT + 'e2e-trial-result.png', full_page=False)
    pa.wait_for_timeout(500)
    check(sql('select count(*) from trial_results') == '1', 'trial reported to server')
    st = ls(pa, 'joldas-pdd-v1')
    check(st['trialUsed'] is True and len(st['exams']) == 1, 'trial stored locally')
    pa.click('#nav button[data-go="exam"]'); pa.wait_for_timeout(300)
    check('уже прошли' in pa.inner_text('#app') and pa.locator('button[data-act="ex-start"]').count() == 0, 'second trial requires registration')
    # register
    pa.evaluate("location.hash='register'"); pa.wait_for_timeout(300)
    pa.fill('#rg-first', 'тест'); pa.fill('#rg-last', 'ученик')
    pa.fill('#rg-birth', years_ago(16)); pa.wait_for_timeout(100)
    check(pa.is_visible('#rg-guard-row') and not pa.is_visible('#rg-mk-row'), 'minor: guardian consent shown, marketing hidden')
    pa.fill('#rg-birth', years_ago(30)); pa.wait_for_timeout(100)
    check(not pa.is_visible('#rg-guard-row') and pa.is_visible('#rg-mk-row'), 'adult: marketing shown')
    pa.select_option('#rg-cat', 'C')
    pa.click('#rg-phone'); pa.type('#rg-phone', '7051112233')
    check(pa.input_value('#rg-phone') == PHONE, 'phone mask: ' + pa.input_value('#rg-phone'))
    pa.fill('#rg-pass', 'pass-12345')
    pa.click('#rg-submit'); pa.wait_for_timeout(300)
    check(pa.is_visible('#rg-msg') and 'согласие' in pa.inner_text('#rg-msg'), 'pd consent required client-side')
    pa.click('button[data-act="privacy-sheet"]'); pa.wait_for_timeout(300)
    check('Политика конфиденциальности' in pa.inner_text('#ovl'), 'privacy sheet opens over the form')
    pa.click('#ovl button[data-act="sheet-close"]'); pa.wait_for_timeout(200)
    check(pa.input_value('#rg-first') == 'тест', 'form values kept after sheet')
    pa.check('#rg-pd'); pa.check('#rg-mk')
    pa.screenshot(path=SHOT + 'e2e-register-filled.png', full_page=True)
    pa.click('#rg-submit'); pa.wait_for_timeout(1500)
    auth = ls(pa, 'joldas-auth-v1')
    check(bool(auth and auth['token']) and auth['user']['firstName'] == 'Тест', 'registered, name normalized')
    check('Сәлем, Тест' in pa.inner_text('#app'), 'plan greets user')
    st = ls(pa, 'joldas-pdd-v1')
    check(st['owner'] == auth['user']['id'] and len(st['exams']) == 1 and st['profile']['cat'] == 'C', 'trial exam moved into account, category C')
    check(sql("select count(*) from users where reg_trial and marketing_consent and category='C'") == '1', 'server: user with trial flag and consent')
    check(pa.locator('#nav button').count() == 7, 'full nav after registration')
    # account menu + category change
    pa.click('button[data-act="acct"]'); pa.wait_for_timeout(200)
    check('Мой профиль' in pa.inner_text('#ovl'), 'account menu opens')
    pa.screenshot(path=SHOT + 'e2e-acct-menu.png', full_page=False)
    pa.click('#ovl button[data-act="cat-sheet"]'); pa.wait_for_timeout(200)
    pa.click('#ovl button[data-c="D"]'); pa.wait_for_timeout(300)
    check(ls(pa, 'joldas-pdd-v1')['profile']['cat'] == 'D' and pa.locator('#ovl .overlay').count() == 0, 'category switched via menu')
    # learn: other categories hidden in details
    pa.evaluate("location.hash='learn'"); pa.wait_for_timeout(300)
    check(pa.locator('details:has-text("Темы для других категорий")').count() == 1, 'other categories collapsed in learn')
    # lesson questions
    pa.evaluate("location.hash='m01'"); pa.wait_for_timeout(300)
    pa.click('button[data-kind="lesson"] >> nth=0'); pa.wait_for_timeout(300)
    for i in range(5):
        pa.click('.opt >> nth=0'); pa.wait_for_timeout(80); pa.click('#q-next'); pa.wait_for_timeout(80)
    pa.wait_for_timeout(5000)
    uid = auth['user']['id']
    check(int(sql("select coalesce(sum(answers),0) from user_days where user_id='%s'" % uid) or 0) >= 45, 'answers counted on server')
    check(sql("select category from users where id='%s'" % uid) == 'D', 'server category D')
    check(sql("select count(*) from events where user_id='%s' and type='lesson'" % uid) == '1', 'lesson event')
    # profile
    pa.evaluate("location.hash='profile'"); pa.wait_for_timeout(300)
    pa.screenshot(path=SHOT + 'e2e-profile.png', full_page=True)
    pa.fill('#pr-first', 'Тестхан'); pa.click('#pr-submit'); pa.wait_for_timeout(800)
    check(ls(pa, 'joldas-auth-v1')['user']['firstName'] == 'Тестхан', 'profile name saved')
    pa.click('#pr-mk'); pa.wait_for_timeout(800)
    check(sql("select marketing_consent from users where id='%s'" % uid) == 'f', 'marketing withdrawn from profile')
    # logout
    pa.click('button[data-act="logout"] >> nth=0'); pa.wait_for_timeout(1200)
    check(ls(pa, 'joldas-auth-v1') is None and len(ls(pa, 'joldas-pdd-v1')['q']) == 0, 'logout clears local progress')
    check('Начать подготовку' in pa.inner_text('#app'), 'back to landing')

    # device B: login
    B = br.new_context(viewport={'width': 390, 'height': 844})
    pb = B.new_page(); pb.on('pageerror', lambda e: errs.append('B: ' + str(e)))
    pb.goto(BASE + '/#login'); pb.wait_for_selector('html[data-ready="1"]', state='attached'); pb.wait_for_timeout(500)
    pb.click('#lg-phone'); pb.type('#lg-phone', '87051112233'); pb.fill('#lg-pass', 'wrong-pass')
    pb.click('#lg-submit'); pb.wait_for_timeout(800)
    check('Неверный' in pb.inner_text('#lg-msg'), 'wrong password message')
    pb.click('button[data-act="forgot"]'); pb.wait_for_timeout(400)
    check('восстановление пароля' in pb.inner_text('#forgot-box').lower(), 'forgot password help')
    pb.fill('#lg-pass', 'pass-12345'); pb.click('#lg-submit'); pb.wait_for_timeout(1500)
    stb = ls(pb, 'joldas-pdd-v1')
    check(len(stb['q']) >= 5 and len(stb['exams']) == 1 and stb['profile']['cat'] == 'D', 'device B got progress (%d q)' % len(stb['q']))
    pb.screenshot(path=SHOT + 'e2e-mobile-plan.png', full_page=False)
    # admin blocks user -> device B session ends on next sync
    sql("update users set status='blocked' where id='%s'" % uid)
    sql("delete from devices where user_id='%s'" % uid)
    pb.evaluate("location.hash='m02'"); pb.wait_for_timeout(300)
    pb.click('button[data-kind="lesson"] >> nth=0'); pb.wait_for_timeout(300)
    pb.click('.opt >> nth=0'); pb.wait_for_timeout(5500)
    check(ls(pb, 'joldas-auth-v1') is None and pb.locator('#login-form').count() == 1, 'revoked session returns to login')
    pb.click('#lg-phone'); pb.type('#lg-phone', '7051112233'); pb.fill('#lg-pass', 'pass-12345'); pb.click('#lg-submit'); pb.wait_for_timeout(1000)
    check('заблокирован' in pb.inner_text('#lg-msg'), 'blocked user sees message')
    sql("update users set status='active' where id='%s'" % uid)
    # must change password flow (temp password set directly via API helper)
    out = subprocess.run(['node', '-e', "require('"+ROOT+"/server/src/util').hashPassword('temp-pass-9').then(h=>process.stdout.write(h))"], capture_output=True, text=True).stdout
    sql("update users set password_hash='%s', must_change_password=true where id='%s'" % (out, uid))
    pb.fill('#lg-pass', 'temp-pass-9'); pb.click('#lg-submit'); pb.wait_for_timeout(1200)
    check(pb.locator('#mc-form').count() == 1, 'must change password screen')
    pb.fill('#mc-new', 'brand-new-1'); pb.fill('#mc-new2', 'brand-new-1'); pb.click('#mc-submit'); pb.wait_for_timeout(1000)
    check(pb.locator('#mc-form').count() == 0 and sql("select must_change_password from users where id='%s'" % uid) == 'f', 'password changed, flag cleared')
    # delete account
    pb.evaluate("location.hash='profile'"); pb.wait_for_timeout(300)
    pb.click('button[data-act="del-ask"]'); pb.wait_for_timeout(200)
    pb.fill('#del-pw', 'brand-new-1'); pb.click('#del-submit'); pb.wait_for_timeout(1200)
    check(sql("select count(*) from users where id='%s'" % uid) == '0' and ls(pb, 'joldas-auth-v1') is None, 'account deleted')
    # about + privacy
    pb.evaluate("location.hash='privacy'"); pb.wait_for_timeout(500)
    check('трансграничная передача не производится' in pb.inner_text('#app'), 'privacy page public')
    check(not errs, 'no page errors %s' % errs[:3])
    br.close()
print('FAILS', len(fails))
for f in fails: print(' -', f)
