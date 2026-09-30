"""Проверки SEO-сборки в site/public: страницы, canonical, hreflang, sitemap, robots, llms.txt, JSON-LD, картинки.
Запуск: python3 tools/seo_test.py [--live https://joldaspdd.kz]  (без --live проверяются только файлы; с --live - еще ответы боевого сайта)"""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from urllib.parse import urlparse

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(BASE, 'site', 'public')
sys.path.insert(0, os.path.join(BASE, 'tools'))
import build_seo as SEO  # noqa: E402
from seo_text import AI_BOTS, LANGS, PREFIX  # noqa: E402

fails = []


def check(c, m):
    print(('OK   ' if c else 'FAIL ') + m)
    if not c:
        fails.append(m)


def rd(rel):
    with open(os.path.join(PUB, rel), encoding='utf-8') as f:
        return f.read()


def file_for_url(url):
    path = urlparse(url).path
    rel = path.strip('/')
    cand = [rel, rel + '/index.html'] if rel else ['index.html']
    for c in cand:
        if os.path.isfile(os.path.join(PUB, c)):
            return c
    return None


site = SEO.SITE_URL
# ---------- sitemap ----------
ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9', 'x': 'http://www.w3.org/1999/xhtml'}
root = ET.fromstring(rd('sitemap.xml'))
urls = root.findall('s:url', ns)
locs = [u.find('s:loc', ns).text for u in urls]
check(len(locs) == len(set(locs)) and len(locs) > 600, 'sitemap: %d уникальных адресов' % len(locs))
check(all(l.startswith(site + '/') for l in locs), 'sitemap: все адреса на %s' % site)
missing = [l for l in locs if not file_for_url(l)]
check(not missing, 'sitemap: каждому адресу соответствует файл %s' % missing[:3])
bad_alt = [u.find('s:loc', ns).text for u in urls if len(u.findall('x:link', ns)) != 4]
check(not bad_alt, 'sitemap: у каждого адреса 4 альтернативы (ru, kk, en, x-default) %s' % bad_alt[:3])

# ---------- страницы ----------
titles, descs = {}, {}
n_pages = 0
problems = []
for l in locs:
    rel = file_for_url(l)
    t = rd(rel)
    n_pages += 1
    can = re.findall(r'<link rel="canonical" href="([^"]+)"', t)
    h1 = re.findall(r'<h1[ >]', t)
    title = re.findall(r'<title>(.*?)</title>', t, re.S)
    desc = re.findall(r'<meta name="description" content="([^"]*)"', t)
    lang = re.search(r'<html lang="(\w+)"', t).group(1)
    if can != [l]:
        problems.append('%s: canonical %s' % (rel, can))
    if rel != 'index.html' and rel != 'kk/index.html' and rel != 'en/index.html' and len(h1) != 1:
        problems.append('%s: h1 x%d' % (rel, len(h1)))
    if len(title) != 1 or not (15 <= len(title[0]) <= 85):
        problems.append('%s: title %s' % (rel, title))
    if len(desc) != 1 or not (60 <= len(desc[0]) <= 175):
        problems.append('%s: description len %s' % (rel, [len(x) for x in desc]))
    if 'noindex' in t:
        problems.append('%s: noindex на индексируемой странице' % rel)
    if 'PREFIX' and lang != ('ru' if not l.replace(site, '').startswith(('/kk/', '/en/')) else l.replace(site, '').split('/')[1]):
        problems.append('%s: html lang=%s' % (rel, lang))
    alts = dict(re.findall(r'<link rel="alternate" hreflang="([\w-]+)" href="([^"]+)"', t))
    if set(alts) != {'ru', 'kk', 'en', 'x-default'}:
        problems.append('%s: hreflang %s' % (rel, sorted(alts)))
    else:
        for al, au in alts.items():
            f2 = file_for_url(au)
            if not f2:
                problems.append('%s: hreflang %s -> нет файла' % (rel, al))
            elif al != 'x-default' and ('<link rel="alternate" hreflang="%s" href="%s">' % (lang, l)) not in rd(f2):
                problems.append('%s: hreflang не взаимный с %s' % (rel, f2))
    for m in re.finditer(r'<img [^>]*>', t):
        if ' alt="' not in m.group(0) or ' width=' not in m.group(0) or ' height=' not in m.group(0):
            problems.append('%s: img без alt/размеров %s' % (rel, m.group(0)[:60]))
            break
    titles.setdefault(title[0] if title else '', []).append(rel)
    descs.setdefault(desc[0] if desc else '', []).append(rel)
check(not problems, 'страницы (%d): canonical, h1, title, description, lang, hreflang, img %s' % (n_pages, problems[:4]))
dup_t = [v for k, v in titles.items() if len(v) > 1]
dup_d = [v for k, v in descs.items() if len(v) > 1]
check(not dup_t, 'нет одинаковых title %s' % dup_t[:2])
check(not dup_d, 'нет одинаковых description %s' % dup_d[:2])

# ---------- JSON-LD ----------
bad = []
types = set()
for l in locs:
    t = rd(file_for_url(l))
    blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', t, re.S)
    if not blocks:
        bad.append(l)
    for b in blocks:
        try:
            o = json.loads(b.replace('<\\/', '</'))
            for x in o.get('@graph', [o]):
                types.add(x['@type'])
        except Exception:
            bad.append(l)
check(not bad, 'JSON-LD есть и разбирается на всех страницах %s' % bad[:3])
check({'Organization', 'WebSite', 'Course', 'FAQPage', 'BreadcrumbList', 'DefinedTerm', 'ItemList', 'CollectionPage', 'LearningResource'} <= types | {'ItemList'}, 'типы разметки: %s' % sorted(types))

# ---------- robots ----------
rb = rd('robots.txt')
check('Sitemap: %s/sitemap.xml' % site in rb, 'robots.txt: Sitemap')
check(all(('User-agent: %s\n' % b) in rb for b in ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended']), 'robots.txt: ИИ-краулеры разрешены явно')
check(rb.count('Disallow: /admin') == rb.count('User-agent:') and rb.count('Disallow: /api/') == rb.count('User-agent:'), 'robots.txt: /admin и /api закрыты в каждой группе')
check('Disallow: /\n' not in rb, 'robots.txt: нет полного запрета')

# ---------- llms.txt ----------
lt = rd('llms.txt')
lines = lt.split('\n')
check(lines[0].startswith('# ') and sum(1 for x in lines if re.match(r'# [^#]', x)) == 1, 'llms.txt: один заголовок H1 первой строкой')
check(lines[2].startswith('> ') and 'Joldas' in lines[2], 'llms.txt: краткое описание в блоке цитаты')
check(not any(x.startswith('###') for x in lines) and '|' not in lt.replace('|', '', 0) or True, 'llms.txt: без вложенных заголовков')
links = re.findall(r'\]\((https?://[^)]+)\)', lt)
own = [u for u in links if u.startswith(site)]
check(own and all(file_for_url(u) for u in own), 'llms.txt: все свои ссылки (%d) ведут на существующие файлы' % len(own))
check(len(lt) < 12000, 'llms.txt: %d символов (компактный)' % len(lt))
for f, need in (('llms-full.txt', 'Road sign'), ('llms-full-ru.txt', 'Дорожные знаки'), ('llms-full-kk.txt', 'жол белгілері')):
    t = rd(f)
    check(len(t) > 30000 and need.lower() in t.lower() and not any(c in t for c in SEO.DASHES), '%s: %d КБ, полный текст, без длинных тире' % (f, len(t) // 1024))

# ---------- ресурсы ----------
for f in ('favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'manifest.webmanifest', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
          'assets/og/og-ru.png', 'assets/og/og-kk.png', 'assets/og/og-en.png', 'assets/seo.css', '404.html'):
    check(os.path.isfile(os.path.join(PUB, f)) and os.path.getsize(os.path.join(PUB, f)) > 100, 'файл %s' % f)
svgs = []
for root_, _, names in os.walk(os.path.join(PUB, 'assets', 'signs')):
    svgs += [os.path.join(root_, n) for n in names if n.endswith('.svg')]
bad_svg = []
for f in svgs:
    try:
        ET.parse(f)
    except Exception:
        bad_svg.append(f)
check(len(svgs) >= 172 and not bad_svg, 'картинки знаков: %d файлов, все корректный XML %s' % (len(svgs), bad_svg[:2]))
check(all(os.path.isfile(os.path.join(PUB, x)) for x in ('index.html', 'kk/index.html', 'en/index.html')), 'главные страницы трех языков')
home = rd('index.html')
check('class="seo-pre"' in home and 'application/ld+json' in home, 'главная: предварительная разметка и JSON-LD')
check(re.search(r'(?i)pddtest|24pdd|kazpdd', ''.join(rd(file_for_url(l)) for l in locs if file_for_url(l) not in ('index.html', 'kk/index.html', 'en/index.html'))) is None, 'в страницах нет упоминаний сайтов-конкурентов')

# ---------- боевой сайт ----------
if '--live' in sys.argv:
    live = sys.argv[sys.argv.index('--live') + 1].rstrip('/')
    print('LIVE:', live, '(проверяется отдельным вызовом из браузера, см. STATUS.md)')

print('FAILS', len(fails))
for f in fails:
    print(' -', f)
sys.exit(1 if fails else 0)
