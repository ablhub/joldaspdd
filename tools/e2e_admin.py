"""E2E админки: настройки, поиск, карточка, временный пароль, блокировка, удаление, выгрузка, лента, языки учеников.
Usage: python3 tools/e2e_admin.py http://127.0.0.1:3200 <admin-password>   (база joldas_dev с данными из tools/seed_dev.js)
Если пароль админки еще не задан, скрипт задает его сам через код установки в /tmp/jdev/var (как у tools/dev_server.sh)."""
import sys, re, subprocess, json, csv, io, urllib.request
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3200'
APW = sys.argv[2] if len(sys.argv) > 2 else 'admin-password-1'
fails = []
def check(c, m):
    print(('OK   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
def sql(q):
    return subprocess.run(['psql', '-h', '/tmp', '-p', '55432', '-U', 'postgres', '-d', 'joldas_dev', '-Atc', q], capture_output=True, text=True).stdout.strip()
def post(path, body, headers=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers=dict({'Content-Type': 'application/json'}, **(headers or {})), method='POST')
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
def get_json(path, headers=None):
    with urllib.request.urlopen(urllib.request.Request(BASE + path, headers=headers or {})) as r: return json.loads(r.read())
LANG_SHORT = {'ru': 'РУС', 'kk': 'ҚАЗ', 'en': 'ENG'}
LANG_NAME = {'ru': 'русский', 'kk': 'казахский', 'en': 'английский'}

# пароль админки: на чистой базе задаем через код установки
if not get_json('/admin/api/whoami')['configured']:
    open('/tmp/jdev/var/setup-code', 'w').write('e2e-admin-setup\n')
    st, r = post('/admin/setup', {'code': 'e2e-admin-setup', 'password': APW}, {'X-Requested-With': 'joldas'})
    check(st == 200, 'admin password set via setup code')

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.goto(BASE + '/admin'); pg.wait_for_timeout(500)
    if pg.is_visible('#l-pw'):
        pg.fill('#l-pw', APW); pg.click('#f-login button'); pg.wait_for_timeout(1200)
    check(pg.is_visible('#tabs'), 'admin logged in')
    # overview: языки учеников
    pg.wait_for_timeout(800)
    lang_rows = pg.locator('#ov-langs .hbar .k')
    got = {lang_rows.nth(i).inner_text(): int(re.sub(r'\D', '', pg.locator('#ov-langs .hbar .n').nth(i).inner_text()) or 0) for i in range(lang_rows.count())}
    want = {'Русский': 0, 'Казахский': 0, 'Английский': 0}
    for line in sql("select lang, count(*) from users group by 1").splitlines():
        k, n = line.split('|'); want[{'ru': 'Русский', 'kk': 'Казахский', 'en': 'Английский'}[k]] = int(n)
    check(pg.locator('#ov-langs h2').inner_text() == 'Языки' and got == want, 'overview: languages block %s' % got)
    # settings
    pg.click('#tabs button[data-tab="settings"]'); pg.wait_for_timeout(800)
    pg.get_by_text('Проверка раз в').wait_for(timeout=5000)
    check(pg.locator('button:has-text("Обновить с GitHub")').count() == 1 and pg.locator('input[placeholder="владелец/репозиторий"]').input_value() == 'ablhub/joldaspdd', 'settings: обновление с GitHub (репозиторий подставлен)')
    check(pg.locator('#autoUp').count() == 1 and pg.locator('button:has-text("Проверить сейчас")').count() == 1, 'settings: карточка автообновления со статусом')
    rin = pg.locator('input[placeholder="владелец/репозиторий"]')
    rin.fill('own/repo'); pg.locator('button:has-text("Сохранить репозиторий")').click()
    pg.get_by_text('Репозиторий сохранен: own/repo').wait_for(timeout=5000)
    rin.fill('ablhub/joldaspdd'); pg.locator('button:has-text("Сохранить репозиторий")').click()
    pg.get_by_text('Репозиторий сохранен: ablhub/joldaspdd').wait_for(timeout=5000)
    check(True, 'settings: репозиторий автообновления сохраняется из админки')
    card = pg.locator('#page section.card').first
    vals = {'Как связаться с поддержкой': 'WhatsApp +7 700 111 22 33', 'Ссылка для связи': 'https://wa.me/77001112233',
            'Текст поддержки на казахском': 'WhatsApp +7 700 111 22 33 (қазақша)', 'Текст поддержки на английском': 'WhatsApp +7 700 111 22 33 (in English)',
            'Оператор: ФИО или наименование': 'ИП Тестов Тест', 'ИИН или БИН': '900101300123', 'Адрес': 'Алматы, ул. Абая 1',
            'Контакт для обращений по персональным данным': 'support@example.kz'}
    check(card.locator('input').count() == len(vals), 'settings: %d fields incl. kk/en support text' % card.locator('input').count())
    for label, v in vals.items(): card.get_by_label(label, exact=True).fill(v)
    card.locator('button:has-text("Сохранить")').click(); pg.wait_for_timeout(800)
    check(pg.locator('#warn .warn').count() == 0, 'warning hidden after settings saved')
    cfg = get_json('/api/v1/config')
    check(cfg['operator']['name'] == 'ИП Тестов Тест' and cfg['support']['url'] == 'https://wa.me/77001112233' and cfg['support']['text'] == 'WhatsApp +7 700 111 22 33', 'public config updated')
    check(get_json('/api/v1/config', {'X-Lang': 'kk'})['support']['text'] == 'WhatsApp +7 700 111 22 33 (қазақша)', 'config: kk support text for X-Lang kk')
    check(get_json('/api/v1/config', {'X-Lang': 'en'})['support']['text'] == 'WhatsApp +7 700 111 22 33 (in English)', 'config: en support text for X-Lang en')
    pg.click('#tabs button[data-tab="overview"]'); pg.wait_for_timeout(500); pg.click('#tabs button[data-tab="settings"]'); pg.wait_for_timeout(800)
    check(pg.locator('#page section.card').first.get_by_label('Текст поддержки на казахском', exact=True).input_value() == vals['Текст поддержки на казахском'], 'kk support text kept after reload')
    # users: колонка и фильтр языка, выгрузка по языку
    pg.click('#tabs button[data-tab="users"]'); pg.wait_for_timeout(800)
    heads = [t.strip() for t in pg.locator('thead th').all_inner_texts()]
    check(heads[:3] == ['Ученик', 'Кат.', 'Язык'] and len(heads) == 10, 'users table has language column: %s' % heads)
    opts = pg.locator('select[aria-label="Язык"] option')
    check([opts.nth(i).get_attribute('value') for i in range(opts.count())] == ['', 'ru', 'kk', 'en'] and opts.first.inner_text() == 'Все языки', 'language filter options')
    li = heads.index('Язык') if 'Язык' in heads else 2
    cells = pg.locator('tbody tr td:nth-child(%d)' % (li + 1)).all_inner_texts()
    check(set(cells) <= set(LANG_SHORT.values()) and len(set(cells)) >= 2, 'language cells: %s' % sorted(set(cells)))
    pg.select_option('select[aria-label="Язык"]', 'kk'); pg.wait_for_timeout(900)
    n_kk = int(sql("select count(*) from users where lang='kk'"))
    cells = pg.locator('tbody tr td:nth-child(%d)' % (li + 1)).all_inner_texts()
    check(n_kk > 0 and len(cells) == min(n_kk, 50) and set(cells) == {'ҚАЗ'}, 'filter by language kk: %d rows' % len(cells))
    href = pg.get_attribute('a:has-text("Выгрузить CSV")', 'href')
    check('lang=kk' in href, 'csv link keeps language filter')
    with pg.expect_download() as dl:
        pg.click('a:has-text("Выгрузить CSV")')
    rows = list(csv.reader(io.StringIO(open(dl.value.path(), encoding='utf-8-sig').read()), delimiter=';'))
    ci = rows[0].index('Язык интерфейса') if 'Язык интерфейса' in rows[0] else -1
    check(ci > 0 and len(rows) == n_kk + 1 and all(r[ci] == 'казахский' for r in rows[1:]), 'csv by language: column «Язык интерфейса», %d rows' % (len(rows) - 1))
    pg.select_option('select[aria-label="Язык"]', ''); pg.wait_for_timeout(900)
    # users: search and open card
    pg.fill('input[type=search]', 'Ахметов'); pg.wait_for_timeout(900)
    check(pg.locator('tbody tr').count() == 1, 'search finds one user')
    href = pg.get_attribute('a:has-text("Выгрузить CSV")', 'href')
    check('q=' in href and 'users.csv' in href, 'csv link keeps filters')
    pg.select_option('select[aria-label="Согласие на рекламу"]', '1'); pg.wait_for_timeout(800)
    href2 = pg.get_attribute('a:has-text("Выгрузить CSV")', 'href')
    with pg.expect_download() as dl:
        pg.click('a:has-text("Выгрузить CSV")')
    path = dl.value.path(); data = open(path, 'rb').read()
    check(data[:3] == b'\xef\xbb\xbf' and 'marketing=1' in href2, 'csv downloaded with BOM')
    pg.select_option('select[aria-label="Согласие на рекламу"]', ''); pg.wait_for_timeout(800)
    pg.locator('tbody tr').first.click(); pg.wait_for_timeout(1200)
    check('Ахметов' in pg.inner_text('.drawer'), 'user card opens')
    uid = sql("select id from users where last_name='Ахметов'")
    phone = sql("select phone from users where id='%s'" % uid)
    ulang = sql("select lang from users where id='%s'" % uid)
    kv = pg.locator('.drawer dl.kv').inner_text()
    check(('Язык интерфейса\t' + LANG_NAME[ulang]) in kv or ('Язык интерфейса\n' + LANG_NAME[ulang]) in kv, 'card shows interface language (%s)' % LANG_NAME[ulang])
    # temp password
    pg.click('.drawer button:has-text("Выдать временный пароль")'); pg.wait_for_timeout(1200)
    tmp = pg.inner_text('.drawer .secret').strip()
    check(len(tmp) == 10, 'temp password shown once')
    st, r = post('/api/v1/auth/login', {'phone': phone, 'password': tmp})
    check(st == 200 and r['user']['mustChangePassword'] is True, 'temp password works, must change')
    # block
    pg.fill('.drawer input[placeholder^="Причина"]', 'проверка'); pg.click('.drawer button:has-text("Заблокировать")'); pg.wait_for_timeout(1500)
    check('заблокирован' in pg.inner_text('.drawer').lower(), 'card shows blocked')
    st, r = post('/api/v1/auth/login', {'phone': phone, 'password': tmp})
    check(st == 403 and r.get('code') == 'blocked', 'blocked user cannot log in')
    pg.click('.drawer button:has-text("Разблокировать")'); pg.wait_for_timeout(1500)
    st, r = post('/api/v1/auth/login', {'phone': phone, 'password': tmp})
    check(st == 200, 'unblocked user can log in')
    # edit category
    pg.select_option('.drawer select', 'D'); pg.click('.drawer button:has-text("Сохранить")'); pg.wait_for_timeout(1500)
    check(sql("select category from users where id='%s'" % uid) == 'D', 'category edited by admin')
    # delete
    pg.fill('.drawer input[placeholder="Напишите УДАЛИТЬ"]', 'удалить'); pg.click('.drawer button:has-text("Удалить навсегда")'); pg.wait_for_timeout(1500)
    check(sql("select count(*) from users where id='%s'" % uid) == '0', 'user deleted from card')
    check(pg.locator('#drawer .drawer').count() == 0, 'card closed after delete')
    # activity feed
    pg.click('#tabs button[data-tab="activity"]'); pg.wait_for_timeout(1000)
    check(pg.locator('.feed .ev').count() >= 10, 'activity feed filled')
    pg.select_option('#page select.input', 'register'); pg.wait_for_timeout(1000)
    txt = pg.inner_text('.feed')
    check('Регистрация' in txt and 'Прочитана тема' not in txt, 'feed filter by type')
    check('язык: казахский' in txt and 'язык: русский' in txt, 'register events show language')
    pg.select_option('#page select.input', 'profile'); pg.wait_for_timeout(1000)
    txt = pg.inner_text('.feed')
    check('Изменение профиля: язык (казахский)' in txt, 'profile event shows language change')
    pg.click('#tabs button[data-tab="settings"]'); pg.wait_for_timeout(1000)
    log = pg.locator('#page section.card').last.inner_text()
    check('Удален' in log and 'Выдан временный пароль' in log and 'Выгрузка CSV' in log, 'audit log lists actions')
    check(not errs, 'no page errors %s' % errs[:3])
    br.close()
print('FAILS', len(fails))
for f in fails: print(' -', f)
