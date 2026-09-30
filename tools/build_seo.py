"""SEO и файлы для ИИ-ассистентов: статические страницы, sitemap.xml, robots.txt, llms.txt, manifest.

Запуск: python3 tools/build_seo.py [--strict]   (обычно вызывается из build.py --api --lang all)
Базовый адрес сайта: переменная SITE_URL (по умолчанию https://joldaspdd.kz). Смените домен - пересоберите.

Что создается в site/public:
  /exam/, /categories/, /categories/<код>/, /signs/, /signs/<код>/, /topics/, /topics/<тема>/, /faq/, /about/
  и то же под /kk/ и /en/; sitemap.xml с hreflang; robots.txt (ИИ-краулеры разрешены); llms.txt и llms-full*.txt;
  manifest.webmanifest, favicon и картинки Open Graph (из src/seo/); assets/seo.css; assets/signs/*.svg; 404.html.
Данные берутся из тех же переведенных пакетов, что и сайт (tools/i18n_content.py).
"""
import datetime
import html
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import i18n_content as C  # noqa: E402
from seo_text import (AI_BOTS, HTML_LANG, LANG_LABEL, LANG_NAME, LANGS, OG_LOCALE, PREFIX, TOPIC_SLUG, TXT)  # noqa: E402

SITE_URL = os.environ.get('SITE_URL', 'https://joldaspdd.kz').rstrip('/')
PUB = os.path.join(BASE, 'site', 'public')
TODAY = os.environ.get('SEO_DATE') or datetime.date.today().isoformat()
DASHES = ('—', '–')
OFFICIAL = ('adilet.zan.kz', 'prg.kz', 'zakon.kz', 'egov.kz', 'gov.kz')
COMPETITORS = re.compile(r'(?i)24pdd|kazpdd|pdd24|pddtest|pdds\.kz|zarul|autotson|avtotson')
MODCATS = {'m21': 'A1, A, B1', 'm22': 'C1, C, C1E, CE', 'm23': 'D1, D, D1E, DE', 'm24': 'BE, C1E, CE, D1E, DE', 'm25': 'Tb, Tm'}
GROUP_ORDER = ['Предупреждающие знаки', 'Знаки приоритета', 'Запрещающие знаки', 'Предписывающие знаки',
               'Информационно-указательные знаки', 'Знаки сервиса', 'Знаки дополнительной информации (таблички)']
MARK = ('<svg class="brand-mark" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 3 L97 50 L50 97 L3 50 Z" fill="#fff" stroke="#1A1A1A" stroke-width="3"/>'
        '<path d="M50 16 L84 50 L50 84 L16 50 Z" fill="#F2B200"/></svg>')
FONT_PRELOAD = {'ru': ['golos-text-cyrillic', 'golos-text-latin'], 'kk': ['golos-text-cyrillic', 'golos-text-latin'], 'en': ['golos-text-latin']}


def fonts_head(lang):
    """Шрифты лежат на нашем сервере (assets/fonts); правила @font-face внутри assets/seo.css. Заранее подгружаем основные файлы."""
    return ''.join('<link rel="preload" href="/assets/fonts/%s-wght-normal.woff2" as="font" type="font/woff2" crossorigin>' % f for f in FONT_PRELOAD[lang])


e = lambda s: html.escape(str(s), quote=True)  # noqa: E731


# ---------- общие помощники ----------

def fmt(s, S):
    return s.format_map(S) if '{' in s else s


def path_for(lang, key):
    return PREFIX[lang] + key


def url_for(lang, key):
    return SITE_URL + path_for(lang, key)


def slug_sign(code):
    return code.replace('.', '-')


def cut(s, n=158):
    s = re.sub(r'\s+', ' ', s).strip()
    if len(s) <= n:
        return s
    s = s[:n].rsplit(' ', 1)[0].rstrip(',;:(')
    return s + '...'


def mk_title(tpl, cut_key, limit=72, **kw):
    """Заголовок страницы не длиннее limit: длинное имя сокращается."""
    t = tpl.format(**kw)
    if len(t) <= limit:
        return t
    over = len(t) - limit + 1
    kw = dict(kw)
    kw[cut_key] = kw[cut_key][:max(12, len(kw[cut_key]) - over)].rstrip(' ,;:(«') + '…'
    return tpl.format(**kw)


def ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '</script>'


def plural_ru(n, a, b, c):
    n = abs(n) % 100
    n1 = n % 10
    if 10 < n < 20:
        return c
    if 1 < n1 < 5:
        return b
    return a if n1 == 1 else c


def stats(data, lang='ru'):
    """Числа и формы слов для текстов из данных одного языка (w_*: слово после числа; в kk и en форма не меняется)."""
    S = {'n_q': sum(len(m['questions']) for m in data['modules']), 'n_signs': len(data['signs']),
         'n_topics': len(data['modules']), 'n_cat': len(data['categories']['categories']), 'date': TODAY}
    if lang == 'ru':
        S.update(w_q=plural_ru(S['n_q'], 'вопрос', 'вопроса', 'вопросов'), w_signs=plural_ru(S['n_signs'], 'знак', 'знака', 'знаков'),
                 w_topics=plural_ru(S['n_topics'], 'тема', 'темы', 'тем'))
    return S


def bad_note(s):
    return bool(COMPETITORS.search(s))


def is_official(url):
    m = re.match(r'https?://([^/]+)', url or '')
    return bool(m) and any(m.group(1) == h or m.group(1).endswith('.' + h) for h in OFFICIAL)


def ext_link(url, label):
    rel = 'noopener' if is_official(url) else 'nofollow noopener'
    return '<a href="%s" rel="%s" target="_blank">%s</a>' % (e(url), rel, e(label))


def ul(items, cls=''):
    return '<ul%s>%s</ul>' % (' class="%s"' % cls if cls else '', ''.join('<li>%s</li>' % it for it in items))


def sign_svg_url(lang, sign, ru_svgs):
    """Файл знака: общий для всех языков, а если картинка на языке отличается (надписи) - свой."""
    slug = slug_sign(sign['code'])
    if lang == 'ru' or sign['svg'] == ru_svgs.get(sign['code']):
        return '/assets/signs/%s.svg' % slug
    return '/assets/signs/%s/%s.svg' % (lang, slug)


# ---------- JSON-LD ----------

def org_ld(lang, T):
    return {'@type': 'Organization', '@id': SITE_URL + '/#org', 'name': T['name'], 'alternateName': ['Joldas', 'Жолдас ПДД'],
            'url': SITE_URL + '/', 'logo': SITE_URL + '/assets/icons/icon-512.png',
            'description': 'Free personal preparation for the Kazakhstan driving theory test (PDD RK) in Kazakh, Russian and English.',
            'areaServed': {'@type': 'Country', 'name': 'Kazakhstan'}, 'knowsLanguage': ['kk', 'ru', 'en']}


def website_ld():
    return {'@type': 'WebSite', '@id': SITE_URL + '/#website', 'url': SITE_URL + '/', 'name': 'Joldas (Жолдас ПДД)',
            'inLanguage': ['ru', 'kk', 'en'], 'publisher': {'@id': SITE_URL + '/#org'}}


def course_ld(lang, T, S):
    return {'@type': 'Course', 'name': T['home_h1'], 'description': fmt(T['home_desc'], S), 'url': url_for(lang, '/'),
            'inLanguage': HTML_LANG[lang], 'provider': {'@id': SITE_URL + '/#org'}, 'isAccessibleForFree': True,
            'educationalLevel': 'Beginner', 'about': 'Driving licence theory test, Kazakhstan (Road Traffic Rules 2026)',
            'availableLanguage': ['kk', 'ru', 'en'],
            'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'KZT', 'category': 'Free', 'availability': 'https://schema.org/InStock'},
            'hasCourseInstance': {'@type': 'CourseInstance', 'courseMode': 'Online', 'inLanguage': HTML_LANG[lang]}}


def crumbs_ld(lang, crumbs):
    return {'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': label, 'item': url_for(lang, key)} for i, (label, key) in enumerate(crumbs)]}


def graph(*objs):
    return ld({'@context': 'https://schema.org', '@graph': list(objs)})


# ---------- главная страница (SPA): голова, предварительная разметка, ссылки в подвале ----------

def home_meta(lang, S):
    T = TXT[lang]
    return {'title': T['home_title'], 'desc': fmt(T['home_desc'], S)}


def head_common(lang, key, title, desc, og_type='website', extra=''):
    T = TXT[lang]
    alts = ''.join('<link rel="alternate" hreflang="%s" href="%s">' % (l, url_for(l, key)) for l in LANGS)
    alts += '<link rel="alternate" hreflang="x-default" href="%s">' % url_for('ru', key)
    img = SITE_URL + '/assets/og/og-%s.png' % lang
    return ('<meta name="description" content="%s">' % e(desc)
            + '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">'
            + '<link rel="canonical" href="%s">' % url_for(lang, key) + alts
            + '<meta property="og:type" content="%s"><meta property="og:site_name" content="%s">' % (og_type, e(T['name_full']))
            + '<meta property="og:locale" content="%s">' % OG_LOCALE[lang]
            + ''.join('<meta property="og:locale:alternate" content="%s">' % OG_LOCALE[l] for l in LANGS if l != lang)
            + '<meta property="og:title" content="%s"><meta property="og:description" content="%s">' % (e(title), e(desc))
            + '<meta property="og:url" content="%s">' % url_for(lang, key)
            + '<meta property="og:image" content="%s"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' % img
            + '<meta property="og:image:alt" content="%s">' % e(T['name_full'])
            + '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="%s">' % e(title)
            + '<meta name="twitter:description" content="%s"><meta name="twitter:image" content="%s">' % (e(desc), img)
            + '<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="32x32">'
            + '<link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">'
            + '<meta name="theme-color" content="#1A2129">' + extra)


def home_head(lang, S):
    """Начало страницы SPA для своего хостинга: doctype, <html lang>, метатеги, canonical, hreflang, JSON-LD."""
    T = TXT[lang]
    m = home_meta(lang, S)
    jl = graph(org_ld(lang, T), website_ld(), course_ld(lang, T, S))
    return ('<!doctype html>\n<html lang="%s"><head><meta charset="utf-8">' % HTML_LANG[lang]
            + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            + head_common(lang, '/', m['title'], m['desc'], 'website', jl) + '\n')


def home_prerender(lang, S):
    """Содержимое <main id="app"> до запуска JS: его видят краулеры без JS и ИИ-ассистенты; приложение заменит его при запуске."""
    T = TXT[lang]
    P = PREFIX[lang]
    faq = TXT[lang]['faq'][:4]
    links = ''.join('<li><a href="%s">%s</a></li>' % (path_for(lang, '/%s/' % k), e(t)) for k, t in T['home_explore_links'])
    qa = ''.join('<h3>%s</h3><p>%s</p>' % (e(q), e(fmt(a, S))) for q, a in faq)
    return ('<div class="seo-pre"><h1>%s</h1><p class="lead">%s</p>' % (e(T['home_h1']), e(fmt(T['home_lead'], S)))
            + ul([e(fmt(x, S)) for x in T['home_points']])
            + '<p><a class="btn primary" href="%s/#register">%s</a> <a class="btn" href="%s/#login">%s</a></p><p class="muted">%s</p>'
            % (P, e(T['cta']), P, e(T['cta_login']), e(T['cta_note']))
            + '<h2>%s</h2><ul>%s</ul>' % (e(T['home_explore']), links)
            + '<h2>%s</h2>%s<p><a href="%s">%s</a></p></div>' % (e(T['faq_h1']), qa, path_for(lang, '/faq/'), e(T['nav']['faq'])))


def footer_links(lang):
    """Ссылки на статические страницы для подвала SPA (краулеры находят их отсюда)."""
    T = TXT[lang]
    items = ''.join('<a href="%s">%s</a>' % (path_for(lang, '/%s/' % k), e(T['nav'][k])) for k in ('exam', 'categories', 'signs', 'topics', 'faq', 'about'))
    return '<nav class="seo-foot" aria-label="%s">%s</nav>' % (e(T['nav_label']), items)


# ---------- каркас статических страниц ----------

def switcher(lang, key):
    T = TXT[lang]
    a = ''
    for l in ('kk', 'ru', 'en'):
        cur = ' aria-current="true"' if l == lang else ''
        a += '<a href="%s" hreflang="%s" lang="%s" title="%s"%s>%s</a>' % (path_for(l, key), l, l, e(LANG_NAME[l]), cur, LANG_LABEL[l])
    return '<nav class="langsw" aria-label="%s">%s</nav>' % (e(T['lang_label']), a)


def page_html(lang, p):
    """p: key, title, desc, body, ld (список JSON-LD скриптов), crumbs [(label, key)], type."""
    T = TXT[lang]
    P = PREFIX[lang]
    key = p['key']
    nav = ''.join('<a href="%s"%s>%s</a>' % (path_for(lang, '/%s/' % k), ' aria-current="page"' if key.startswith('/%s/' % k) else '', e(T['nav'][k]))
                  for k in ('exam', 'categories', 'signs', 'topics', 'faq'))
    crumbs = [(T['crumb_home'], '/')] + p.get('crumbs', [])
    bc = '<nav class="crumbs" aria-label="breadcrumb"><ol>%s</ol></nav>' % ''.join(
        ('<li><a href="%s">%s</a></li>' % (path_for(lang, k), e(l))) if i < len(crumbs) - 1 else '<li aria-current="page">%s</li>' % e(l)
        for i, (l, k) in enumerate(crumbs))
    jl = graph(*p.get('ld', []), crumbs_ld(lang, crumbs))
    foot = ('<footer><div class="wrap"><p>%s <a href="https://adilet.zan.kz/%s/docs/V2300033003" rel="noopener" target="_blank">adilet.zan.kz</a>. %s</p>'
            '<p class="upd">%s: %s</p><nav class="seo-foot" aria-label="%s">%s<a href="%s/#privacy">%s</a></nav></div></footer>'
            % (e(T['foot']), 'kaz' if lang == 'kk' else 'rus', e(T['foot_check']), e(T['updated']), TODAY, e(T['nav_label']),
               ''.join('<a href="%s">%s</a>' % (path_for(lang, '/%s/' % k), e(T['nav'][k])) for k in ('exam', 'categories', 'signs', 'topics', 'faq', 'about')),
               P, e(T['privacy'])))
    return ('<!doctype html>\n<html lang="%s"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<title>%s</title>%s%s<link rel="stylesheet" href="/assets/seo.css?v=%s">%s</head>\n<body>'
            '<header class="top"><div class="wrap"><a class="brand" href="%s/">%s<span class="brand-name">%s</span></a>'
            '<nav class="nav" aria-label="%s">%s</nav>%s<a class="btn primary sm" href="%s/#register">%s</a></div></header>'
            '<main class="wrap"><article class="doc">%s%s</article></main>%s</body></html>\n'
            % (HTML_LANG[lang], e(p['title']), head_common(lang, key, p['title'], p['desc'], p.get('type', 'article'), jl), fonts_head(lang),
               CSS_VERSION[0], '', P, MARK, e(T['name']), e(T['nav_label']), nav, switcher(lang, key), P, e(T['cta']), bc, p['body'], foot))


CSS_VERSION = ['1']


# ---------- страницы ----------

def cta_block(lang):
    T = TXT[lang]
    return ('<div class="cta"><a class="btn primary" href="%s/#register">%s</a> <a class="btn" href="%s/#login">%s</a><p class="muted">%s</p></div>'
            % (PREFIX[lang], e(T['cta']), PREFIX[lang], e(T['cta_login']), e(T['cta_note'])))


def facts_grid(pairs):
    return '<dl class="facts">%s</dl>' % ''.join('<div><dt>%s</dt><dd>%s</dd></div>' % (e(k), e(v)) for k, v in pairs)


def page_exam(lang, d, S):
    T = TXT[lang]
    ex = d['practice']['exam']
    th, pr = ex['theory'], ex['practical']
    valid_short = {'ru': '2 года', 'kk': '2 жыл', 'en': '2 years'}[lang]
    facts = facts_grid(list(zip(T['exam_facts'], [str(th['questions']), str(th['minutes']), str(th['passCorrect']), ', '.join(th['languages']), valid_short])))
    body = '<h1>%s</h1><p class="lead">%s</p>%s' % (e(T['exam_h1']), e(T['exam_lead']), facts)
    body += '<h2>%s</h2>%s<p>%s</p>' % (e(T['exam_theory']), ul([e(n) for n in th['notes'] if not bad_note(n)]), e(th['validity']))
    body += '<h2>%s</h2><p><strong>%s.</strong> %s</p><p><strong>%s.</strong> %s</p>%s' % (
        e(T['exam_practical']), e(T['exam_where']), e(pr['where']), e(T['exam_scoring']), e(pr['scoring']),
        ul([e(n) for n in pr['notes'] if not bad_note(n)]))
    body += '<h2>%s</h2><ol class="steps">%s</ol>' % (e(T['exam_steps']), ''.join(
        '<li><h3>%s</h3><p>%s</p></li>' % (e(re.sub(r'^\d+\.\s*', '', s['h'])), e(s['p'])) for s in ex['steps'] if not bad_note(s['p'])))
    body += '<h2>%s</h2>%s' % (e(T['exam_retakes']), ul([e(n) for n in ex['retakes'] if not bad_note(n)]))
    body += '<h2>%s</h2>%s' % (e(T['exam_changes']), ''.join(
        '<section class="change"><h3>%s</h3><p class="muted">%s: %s. %s</p><p>%s</p></section>' % (
            e(c['h']), e(T['exam_status']), e(c['status']), e(c['date']), e(c['p'])) for c in ex['changes2026']))
    src = [s for s in ex.get('sources', []) if is_official(s.get('url'))]
    if src:
        body += '<h2>%s</h2>%s' % (e(T['exam_sources']), ul([ext_link(s['url'], s['title']) for s in src]))
    body += cta_block(lang)
    return {'key': '/exam/', 'title': T['exam_title'], 'desc': cut(T['exam_desc']), 'body': body, 'crumbs': [(T['nav']['exam'], '/exam/')],
            'ld': [{'@type': 'WebPage', 'name': T['exam_h1'], 'url': url_for(lang, '/exam/'), 'inLanguage': HTML_LANG[lang], 'dateModified': TODAY,
                    'isPartOf': {'@id': SITE_URL + '/#website'}, 'about': 'Driving licence tests in Kazakhstan'}]}


def page_categories(lang, d, S):
    T = TXT[lang]
    cats = d['categories']['categories']
    groups = d['categories']['groups']
    body = '<h1>%s</h1><p class="lead">%s</p>' % (e(T['cats_h1']), e(fmt(T['cats_lead'], S)))
    for g in groups:
        rows = [c for c in cats if c['group'] == g['id']]
        body += '<h2>%s</h2><p class="muted">%s</p><div class="tw"><table><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (
            e(g['name']), e(g.get('note', '')), ''.join('<th>%s</th>' % e(x) for x in T['cats_col']),
            ''.join('<tr><td><a href="%s"><strong>%s</strong></a></td><td>%s</td><td>%s</td><td>%s</td></tr>' % (
                path_for(lang, '/categories/%s/' % c['code'].lower()), e(c['code']), e(cut(c['vehicles'], 170)), e(cut(c['age'], 80)), e(cut(c['experience'], 80))) for c in rows))
    body += cta_block(lang)
    items = [{'@type': 'ListItem', 'position': i + 1, 'url': url_for(lang, '/categories/%s/' % c['code'].lower()), 'name': c['name']} for i, c in enumerate(cats)]
    return {'key': '/categories/', 'title': T['cats_title'], 'desc': cut(fmt(T['cats_desc'], S)), 'body': body, 'crumbs': [(T['nav']['categories'], '/categories/')],
            'ld': [{'@type': 'CollectionPage', 'name': T['cats_h1'], 'url': url_for(lang, '/categories/'), 'inLanguage': HTML_LANG[lang], 'dateModified': TODAY,
                    'mainEntity': {'@type': 'ItemList', 'itemListElement': items}}]}


def page_category(lang, d, S, c):
    T = TXT[lang]
    sec = T['cat_sections']
    pr = c.get('practical') or {}
    key = '/categories/%s/' % c['code'].lower()
    body = '<h1>%s</h1>' % e(c['name'])
    body += '<h2>%s</h2><p>%s</p><h2>%s</h2><p>%s</p><h2>%s</h2><p>%s</p>' % (
        e(sec['vehicles']), e(c['vehicles']), e(sec['age']), e(c['age']), e(sec['experience']), e(c['experience']))
    body += '<h2>%s</h2><p>%s</p>' % (e(sec['theory']), e(c['theory']))
    body += '<h2>%s</h2>' % e(sec['practical'])
    if pr.get('where'):
        body += '<p><strong>%s.</strong> %s</p>' % (e(sec['where']), e(pr['where']))
    if pr.get('vehicle'):
        body += '<p><strong>%s.</strong> %s</p>' % (e(sec['car']), e(pr['vehicle']))
    if pr.get('exercises'):
        body += '<h3>%s</h3><ol>%s</ol>' % (e(sec['exercises']), ''.join('<li>%s</li>' % e(x) for x in pr['exercises']))
    src = [s for s in c.get('sources', []) if is_official(s.get('url'))]
    if src:
        body += '<h2>%s</h2>%s' % (e(sec['sources']), ul([ext_link(s['url'], s['title']) for s in src]))
    others = [x for x in d['categories']['categories'] if x['code'] != c['code']]
    body += '<h2>%s</h2><p class="chips">%s</p>' % (e(T['cat_other']), ''.join(
        '<a class="chip" href="%s">%s</a>' % (path_for(lang, '/categories/%s/' % x['code'].lower()), e(x['code'])) for x in others))
    body += cta_block(lang)
    desc = cut('%s. %s. %s' % (c['name'], c['age'], c['vehicles']))
    return {'key': key, 'title': mk_title(T['cat_title'], 'name', name=c['name']), 'desc': desc, 'body': body,
            'crumbs': [(T['nav']['categories'], '/categories/'), (c['code'], key)],
            'ld': [{'@type': 'WebPage', 'name': c['name'], 'url': url_for(lang, key), 'inLanguage': HTML_LANG[lang], 'dateModified': TODAY,
                    'isPartOf': {'@id': SITE_URL + '/#website'}, 'about': {'@type': 'Thing', 'name': c['name']}}]}


def page_topics(lang, d, S):
    T = TXT[lang]
    mods = d['modules']
    body = '<h1>%s</h1><p class="lead">%s</p><ol class="topics">' % (e(T['topics_h1']), e(fmt(T['topics_lead'], S)))
    for m in mods:
        body += '<li><h2><a href="%s">%s</a></h2><p class="muted">%s</p><p>%s</p></li>' % (
            path_for(lang, '/topics/%s/' % TOPIC_SLUG[m['id']]), e(m['title']), e(m['pdd']), e(cut(m['summary'], 260)))
    body += '</ol>' + cta_block(lang)
    items = [{'@type': 'ListItem', 'position': i + 1, 'url': url_for(lang, '/topics/%s/' % TOPIC_SLUG[m['id']]), 'name': m['title']} for i, m in enumerate(mods)]
    return {'key': '/topics/', 'title': T['topics_title'], 'desc': cut(fmt(T['topics_desc'], S)), 'body': body, 'crumbs': [(T['nav']['topics'], '/topics/')],
            'ld': [{'@type': 'CollectionPage', 'name': T['topics_h1'], 'url': url_for(lang, '/topics/'), 'inLanguage': HTML_LANG[lang], 'dateModified': TODAY,
                    'mainEntity': {'@type': 'ItemList', 'itemListElement': items}}]}


def page_topic(lang, d, S, m, idx):
    T = TXT[lang]
    sec = T['topic_sections']
    key = '/topics/%s/' % TOPIC_SLUG[m['id']]
    body = '<h1>%s</h1><p class="muted">%s. %s</p>' % (e(m['title']), e(m['pdd']), e(sec['minutes'].format(n=m['minutes'])))
    if m['id'] in MODCATS:
        body += '<p class="muted">%s: %s</p>' % (e(T['topic_cats']), e(MODCATS[m['id']]))
    body += '<p class="lead">%s</p>' % e(m['summary'])
    body += '<h2>%s</h2>%s' % (e(sec['facts']), ul([e(x) for x in m['keyFacts']]))
    if m.get('mistakes'):
        body += '<h2>%s</h2>%s' % (e(sec['mistakes']), ul([e(x) for x in m['mistakes']]))
    body += '<p class="note">%s</p>' % e(sec['full']) + cta_block(lang)
    mods = d['modules']
    near = [mods[i] for i in (idx - 1, idx + 1) if 0 <= i < len(mods)]
    body += '<h2>%s</h2><p class="chips">%s<a class="chip" href="%s">%s</a></p>' % (
        e(sec['more']), ''.join('<a class="chip" href="%s">%s</a>' % (path_for(lang, '/topics/%s/' % TOPIC_SLUG[x['id']]), e(x['title'])) for x in near),
        path_for(lang, '/topics/'), e(sec['all']))
    desc = cut(m['summary'])
    return {'key': key, 'title': mk_title(T['topic_title'], 'title', title=m['title']), 'desc': desc, 'body': body,
            'crumbs': [(T['nav']['topics'], '/topics/'), (m['title'], key)],
            'ld': [{'@type': 'LearningResource', 'name': m['title'], 'description': desc, 'url': url_for(lang, key), 'inLanguage': HTML_LANG[lang],
                    'dateModified': TODAY, 'learningResourceType': 'Lesson summary', 'isAccessibleForFree': True,
                    'timeRequired': 'PT%dM' % int(m['minutes']), 'isPartOf': {'@id': SITE_URL + '/#website'}}]}


SIGN_WORD = re.compile(r'(?:знак\w*|табличк\w*|белгі\w*|тақтайша\w*|sign\w*|plate\w*)\s*[«"“(]?\s*(\d\.\d{1,2}(?:\.\d)?)(?![\d.]\d)', re.I)
SIGN_WORD_POST = re.compile(r'(?<![\d.])(\d\.\d{1,2}(?:\.\d)?)\s*(?:белгі\w*|тақтайша\w*)', re.I)


def sign_questions(datas):
    """код знака -> id вопросов, где он упоминается (по русскому банку); затем вопросы берутся на языке страницы."""
    codes_ok = {s['code'] for s in datas['ru']['signs']}
    idx = {}
    for m in datas['ru']['modules']:
        for q in m['questions']:
            codes = set()
            sc = q.get('scene') or {}
            for s in sc.get('signs') or []:
                for c in (s.get('codes') if isinstance(s, dict) else [s]) or []:
                    if isinstance(c, str):
                        codes.add(c.split(':')[0])
            txt = q['q'] + ' ' + q['explain']
            codes |= set(SIGN_WORD.findall(txt)) | set(SIGN_WORD_POST.findall(txt))
            for c in codes & codes_ok:
                idx.setdefault(c, []).append(q['id'])
    return idx


def page_signs(lang, d, S, ru_svgs):
    T = TXT[lang]
    body = '<h1>%s</h1><p class="lead">%s</p>' % (e(T['signs_h1']), e(fmt(T['signs_lead'], S)))
    by = {}
    for s in d['signs']:
        by.setdefault(s['group'], []).append(s)
    for g in GROUP_ORDER:
        if g not in by:
            continue
        gn = by[g][0].get('gname') or g
        body += '<h2 id="%s">%s</h2><p class="muted">%s</p><div class="sgrid">%s</div>' % (
            'g%d' % (GROUP_ORDER.index(g) + 1), e(gn), e(T['group_blurb'][g]), ''.join(
                '<a class="sg" href="%s"><img src="%s" width="72" height="72" loading="lazy" alt="%s"><span class="cd">%s</span><span class="nm">%s</span></a>' % (
                    path_for(lang, '/signs/%s/' % slug_sign(s['code'])), sign_svg_url(lang, s, ru_svgs), e('%s %s «%s»' % (T['sign_labels']['img'], s['code'], s['name'])),
                    e(s['code']), e(s['name'])) for s in by[g]))
    body += cta_block(lang)
    items = [{'@type': 'ListItem', 'position': i + 1, 'url': url_for(lang, '/signs/%s/' % slug_sign(s['code'])), 'name': '%s %s' % (s['code'], s['name'])} for i, s in enumerate(d['signs'])]
    return {'key': '/signs/', 'title': T['signs_title'], 'desc': cut(fmt(T['signs_desc'], S)), 'body': body, 'crumbs': [(T['nav']['signs'], '/signs/')],
            'ld': [{'@type': 'CollectionPage', 'name': T['signs_h1'], 'url': url_for(lang, '/signs/'), 'inLanguage': HTML_LANG[lang], 'dateModified': TODAY,
                    'mainEntity': {'@type': 'ItemList', 'itemListElement': items}}]}


def page_sign(lang, d, S, s, i, qidx, qbyid, ru_svgs):
    T = TXT[lang]
    L = T['sign_labels']
    code, name = s['code'], s['name']
    slug = slug_sign(code)
    key = '/signs/%s/' % slug
    gn = s.get('gname') or s['group']
    body = '<h1>%s</h1>' % e(T['sign_h1'].format(code=code, name=name))
    body += ('<div class="signhead"><img src="%s" width="160" height="160" alt="%s">'
             '<div><p class="lead">%s</p><p>%s</p></div></div>' % (
                 sign_svg_url(lang, s, ru_svgs), e('%s %s «%s»' % (L['img'], code, name)),
                 e(T['sign_intro'].format(code=code, name=name, group=gn)), e(s['meaning'])))
    body += facts_grid([(L['code'], code), (L['name'], name), (L['group'], gn)])
    body += '<h2>%s</h2><p>%s</p>' % (e(L['meaning']), e(s['meaning']))
    if s.get('note'):
        body += '<h2>%s</h2><p>%s</p>' % (e(L['note']), e(s['note']))
    body += '<p class="muted">%s</p>' % e(T['group_blurb'][s['group']])
    qs = sorted((qbyid[i_] for i_ in qidx.get(code, []) if i_ in qbyid), key=lambda q: len(q['q']) + len(q['explain']))[:2]
    if qs:
        body += '<h2>%s</h2>' % e(L['questions'])
        for q in qs:
            ans = q['options'][q['answer']]
            body += '<section class="qa"><h3>%s</h3>%s<p><strong>%s:</strong> %s</p><p>%s</p></section>' % (
                e(q['q']), ul([e(o) for o in q['options']]), e(L['answer']), e(ans), e(q['explain']))
    grp = [x for x in d['signs'] if x['group'] == s['group']]
    pos = [x['code'] for x in grp].index(code)
    rel = [x for x in grp[max(0, pos - 3):pos] + grp[pos + 1:pos + 4] if x['code'] != code][:6]
    if rel:
        body += '<h2>%s</h2><div class="sgrid">%s</div>' % (e(L['related']), ''.join(
            '<a class="sg" href="%s"><img src="%s" width="72" height="72" loading="lazy" alt="%s"><span class="cd">%s</span><span class="nm">%s</span></a>' % (
                path_for(lang, '/signs/%s/' % slug_sign(x['code'])), sign_svg_url(lang, x, ru_svgs), e('%s %s «%s»' % (L['img'], x['code'], x['name'])),
                e(x['code']), e(x['name'])) for x in rel))
    body += '<p><a href="%s">%s</a></p>' % (path_for(lang, '/signs/'), e(L['all'])) + cta_block(lang)
    base = '%s %s «%s»: %s' % ({'ru': 'Знак', 'kk': 'Жол белгісі', 'en': 'Road sign'}[lang], code, name, s['meaning'])
    desc = cut(base + (' ' + gn + '.' if len(base) < 100 else ''))
    return {'key': key, 'title': mk_title(T['sign_title'], 'name', code=code, name=name), 'desc': desc, 'body': body,
            'crumbs': [(T['nav']['signs'], '/signs/'), (code, key)],
            'ld': [{'@type': 'DefinedTerm', 'name': '%s %s' % (code, name), 'termCode': code, 'description': s['meaning'], 'url': url_for(lang, key),
                    'inLanguage': HTML_LANG[lang], 'image': SITE_URL + sign_svg_url(lang, s, ru_svgs),
                    'inDefinedTermSet': {'@type': 'DefinedTermSet', 'name': T['signs_h1'], 'url': url_for(lang, '/signs/')}},
                   {'@type': 'WebPage', 'url': url_for(lang, key), 'name': T['sign_h1'].format(code=code, name=name), 'inLanguage': HTML_LANG[lang], 'dateModified': TODAY,
                    'isPartOf': {'@id': SITE_URL + '/#website'}, 'primaryImageOfPage': {'@type': 'ImageObject', 'contentUrl': SITE_URL + sign_svg_url(lang, s, ru_svgs)}}]}


def page_faq(lang, d, S):
    T = TXT[lang]
    qa = [(q, fmt(a, S)) for q, a in T['faq']]
    body = '<h1>%s</h1><p class="lead">%s</p>' % (e(T['faq_h1']), e(T['faq_lead']))
    body += ''.join('<section class="q"><h2>%s</h2><p>%s</p></section>' % (e(q), e(a)) for q, a in qa) + cta_block(lang)
    return {'key': '/faq/', 'title': T['faq_title'], 'desc': cut(T['faq_desc']), 'body': body, 'crumbs': [(T['nav']['faq'], '/faq/')],
            'ld': [{'@type': 'FAQPage', 'url': url_for(lang, '/faq/'), 'inLanguage': HTML_LANG[lang], 'dateModified': TODAY,
                    'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in qa]}]}


def page_about(lang, d, S):
    T = TXT[lang]
    body = '<h1>%s</h1>' % e(T['about_h1'])
    body += ''.join('<h2>%s</h2><p>%s</p>' % (e(h), e(fmt(p, S))) for h, p in T['about_sections'])
    body += '<h2>%s</h2>%s' % (e(T['about_facts_h']), ul([e(fmt(x, S)) for x in T['about_facts']])) + cta_block(lang)
    return {'key': '/about/', 'title': T['about_title'], 'desc': cut(T['about_desc']), 'body': body, 'crumbs': [(T['nav']['about'], '/about/')],
            'ld': [{'@type': 'AboutPage', 'name': T['about_h1'], 'url': url_for(lang, '/about/'), 'inLanguage': HTML_LANG[lang], 'dateModified': TODAY,
                    'mainEntity': {'@id': SITE_URL + '/#org'}}]}


def page_404(lang, T):
    body = '<h1>404</h1><p class="lead">%s</p><p><a class="btn primary" href="%s/">%s</a></p>' % (
        {'ru': 'Такой страницы нет. Вернитесь на главную или выберите раздел.', 'kk': 'Мұндай бет жоқ. Басты бетке оралыңыз немесе бөлімді таңдаңыз.',
         'en': 'This page does not exist. Go to the home page or pick a section.'}[lang], PREFIX[lang], e(T['crumb_home']))
    return body


# ---------- сборка всех страниц ----------

def build_pages(datas):
    """-> список страниц [(lang, page dict)] для всех языков."""
    out = []
    ru_svgs = {s['code']: s['svg'] for s in datas['ru']['signs']}
    qidx = sign_questions(datas)
    for lang in LANGS:
        d = datas[lang]
        S = stats(d, lang)
        qbyid = {q['id']: q for m in d['modules'] for q in m['questions']}
        pages = [page_exam(lang, d, S), page_categories(lang, d, S), page_topics(lang, d, S), page_signs(lang, d, S, ru_svgs), page_faq(lang, d, S), page_about(lang, d, S)]
        pages += [page_category(lang, d, S, c) for c in d['categories']['categories']]
        pages += [page_topic(lang, d, S, m, i) for i, m in enumerate(d['modules'])]
        pages += [page_sign(lang, d, S, s, i, qidx, qbyid, ru_svgs) for i, s in enumerate(d['signs'])]
        out += [(lang, p) for p in pages]
    return out


def write(path, text, binary=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb' if binary else 'w', **({} if binary else {'encoding': 'utf-8'})) as f:
        f.write(text)


def out_file(lang, key):
    return os.path.join(PUB, *(PREFIX[lang].strip('/').split('/') if PREFIX[lang] else []), *key.strip('/').split('/'), 'index.html')


# ---------- sitemap, robots, manifest ----------

def sitemap(keys):
    rows = []
    for key in keys:
        alts = ''.join('<xhtml:link rel="alternate" hreflang="%s" href="%s"/>' % (l, url_for(l, key)) for l in LANGS)
        alts += '<xhtml:link rel="alternate" hreflang="x-default" href="%s"/>' % url_for('ru', key)
        for l in LANGS:
            rows.append('<url><loc>%s</loc><lastmod>%s</lastmod>%s</url>' % (url_for(l, key), TODAY, alts))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
            + '\n'.join(rows) + '\n</urlset>\n')


def robots():
    common = 'Allow: /\nDisallow: /admin\nDisallow: /api/\n'
    seen, blocks = set(), []
    for bot in AI_BOTS:
        if bot.lower() in seen:
            continue
        seen.add(bot.lower())
        blocks.append('User-agent: %s\n%s' % (bot, common))
    return ('# Joldas (Жолдас ПДД): public pages are open to search engines and AI assistants.\n'
            '# LLM-readable summary: %s/llms.txt   Full text: %s/llms-full.txt\n\n' % (SITE_URL, SITE_URL)
            + 'User-agent: *\n' + common + '\n' + '\n'.join(blocks) + '\nSitemap: %s/sitemap.xml\n' % SITE_URL)


def manifest():
    return json.dumps({'name': 'Joldas (Жолдас ПДД)', 'short_name': 'Жолдас', 'description': 'Kazakhstan driving theory test preparation',
                       'start_url': '/', 'scope': '/', 'display': 'standalone', 'background_color': '#EDF0F3', 'theme_color': '#1A2129', 'lang': 'ru',
                       'icons': [{'src': '/assets/icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
                                 {'src': '/assets/icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
                                 {'src': '/favicon.svg', 'sizes': 'any', 'type': 'image/svg+xml', 'purpose': 'any'}]}, ensure_ascii=False, indent=1) + '\n'


# ---------- llms.txt ----------

def llms_txt(datas):
    dE = datas['en']
    S = stats(dE, 'en')
    T = TXT['en']
    ex = dE['practice']['exam']['theory']
    U = lambda lang, key: url_for(lang, key)  # noqa: E731
    lines = ['# Joldas (Жолдас): free Kazakhstan driving theory test preparation', '',
             '> Joldas (Жолдас ПДД) is a free online course that prepares learners for the driving licence theory test in Kazakhstan (PDD RK, Road Traffic Rules 2026). '
             'It offers %(n_q)d practice questions with explanations and diagrams, %(n_signs)d road signs, a 40-question mock exam in the official format, a personal study plan '
             'and all %(n_cat)d licence categories (A1 to Tm), in Kazakh, Russian and English. It is an unofficial study aid based on the Road Traffic Rules of Kazakhstan '
             '(Ministry of Internal Affairs Order No. 534, 2026 edition).' % S, '',
             'Key facts about the test (from the Rules for Examinations and Issuing Driving Licences, July 2026 edition; verify with eGov or your specialised PSC before the test):', '',
             '- Theory test: %d questions, %d minutes, at least %d correct answers (at most 8 mistakes). Languages: Kazakh, Russian, English. A pass is valid for 2 years.' % (ex['questions'], ex['minutes'], ex['passCorrect']),
             '- Practical test: at an automated test ground of a specialised Public Service Centre (PSC), scored by an automatic system with penalty points.',
             '- Minimum age for category B: 18. Retakes: first retake on the next working day; after two failed attempts, no earlier than one month later.',
             '- Joldas is free to learn with. One mock test can be taken without registration; the personal plan, textbook and explained questions need a phone-number sign-up.',
             '- Joldas is not the official question bank (it is not published) and is not affiliated with the State Corporation "Government for Citizens".', '',
             'Best suited for: learners preparing for the Kazakhstan driving theory test who want free practice questions with clause references in Kazakh, Russian or English. '
             'For legal or official questions, rely on the text of the Rules at adilet.zan.kz.', '',
             '## English pages', '',
             '- [Driving test in Kazakhstan 2026](%s): theory and practical test format, route to a licence, retakes, 2026 changes' % U('en', '/exam/'),
             '- [Licence categories](%s): all %d categories A1 to Tm with age, experience and test rules' % (U('en', '/categories/'), S['n_cat']),
             '- [Road signs of Kazakhstan](%s): %d signs with names, meanings and explanations' % (U('en', '/signs/'), S['n_signs']),
             '- [Topics of the Road Traffic Rules](%s): %d topics with key points and common mistakes' % (U('en', '/topics/'), S['n_topics']),
             '- [Frequently asked questions](%s): test format, age, retakes, registration' % U('en', '/faq/'),
             '- [About Joldas](%s): what it is, sources and accuracy' % U('en', '/about/'),
             '- [Start the course](%s): home page and sign-up' % U('en', '/'), '',
             '## Kazakh pages (Қазақша)', '',
             '- [Емтихан](%s): теория мен практика, қайта тапсыру' % U('kk', '/exam/'),
             '- [Санаттар](%s): A1-ден Tm-ге дейін' % U('kk', '/categories/'),
             '- [Жол белгілері](%s): атаулары мен мағыналары' % U('kk', '/signs/'),
             '- [Тақырыптар](%s): ЖЖҚ тақырыптары' % U('kk', '/topics/'),
             '- [Сұрақ-жауап](%s)' % U('kk', '/faq/'),
             '- [Басты бет](%s)' % U('kk', '/'), '',
             '## Russian pages (Русский)', '',
             '- [Экзамен](%s): теория, практика, пересдачи' % U('ru', '/exam/'),
             '- [Категории](%s): от A1 до Tm' % U('ru', '/categories/'),
             '- [Дорожные знаки](%s): названия и значения' % U('ru', '/signs/'),
             '- [Темы ПДД](%s): главное и типичные ошибки' % U('ru', '/topics/'),
             '- [Вопросы и ответы](%s)' % U('ru', '/faq/'),
             '- [Главная](%s)' % U('ru', '/'), '',
             '## Full text for AI assistants', '',
             '- [llms-full.txt](%s/llms-full.txt): complete reference in English (test guide, categories, topics, signs, FAQ)' % SITE_URL,
             '- [llms-full-ru.txt](%s/llms-full-ru.txt): the same in Russian' % SITE_URL,
             '- [llms-full-kk.txt](%s/llms-full-kk.txt): the same in Kazakh' % SITE_URL, '',
             '## Optional', '',
             '- [Sitemap](%s/sitemap.xml): all pages in three languages with hreflang' % SITE_URL,
             '- [Official text of the Rules](https://adilet.zan.kz/eng/docs/V2300033003): the primary source (Adilet)', '']
    return '\n'.join(lines)


def llms_full(lang, d):
    S = stats(d, lang)
    T = TXT[lang]
    ex = d['practice']['exam']
    th, pr = ex['theory'], ex['practical']
    o = ['# %s: %s' % (T['name_full'], T['home_h1']), '',
         '> %s' % fmt(T['home_lead'], S), '', '%s: %s. %s' % (T['updated'], TODAY, SITE_URL + PREFIX[lang] + '/'), '',
         '## %s' % T['about_facts_h'], ''] + ['- ' + fmt(x, S) for x in T['about_facts']] + ['', '## %s' % T['nav']['faq'], '']
    for q, a in T['faq']:
        o += ['### ' + q, fmt(a, S), '']
    o += ['## ' + T['exam_h1'], '', '### ' + T['exam_theory'], ''] + ['- ' + n for n in th['notes'] if not bad_note(n)] + ['- ' + th['validity'], '',
          '### ' + T['exam_practical'], '', '- %s: %s' % (T['exam_where'], pr['where']), '- %s: %s' % (T['exam_scoring'], pr['scoring'])]
    o += ['- ' + n for n in pr['notes'] if not bad_note(n)] + ['', '### ' + T['exam_steps'], '']
    o += ['- **%s** %s' % (s['h'], s['p']) for s in ex['steps'] if not bad_note(s['p'])] + ['', '### ' + T['exam_retakes'], '']
    o += ['- ' + n for n in ex['retakes'] if not bad_note(n)] + ['', '### ' + T['exam_changes'], '']
    o += ['- **%s** (%s): %s' % (c['h'], c['status'], c['p']) for c in ex['changes2026']] + ['', '## ' + T['cats_h1'], '']
    for c in d['categories']['categories']:
        pc = c.get('practical') or {}
        o += ['### ' + c['name'], '', '- %s: %s' % (T['cat_sections']['vehicles'], c['vehicles']), '- %s: %s' % (T['cat_sections']['age'], c['age']),
              '- %s: %s' % (T['cat_sections']['experience'], c['experience']), '- %s: %s' % (T['cat_sections']['theory'], c['theory']),
              '- %s: %s' % (T['cat_sections']['practical'], pc.get('where', '')), '- %s: %s' % (T['cat_sections']['car'], pc.get('vehicle', '')),
              '- %s: %s' % (T['cat_sections']['exercises'], '; '.join(pc.get('exercises', []))), '']
    o += ['## ' + T['topics_h1'], '']
    for m in d['modules']:
        o += ['### %s (%s)' % (m['title'], m['pdd']), '', m['summary'], ''] + ['- ' + x for x in m['keyFacts']]
        if m.get('mistakes'):
            o += ['', '%s:' % T['topic_sections']['mistakes']] + ['- ' + x for x in m['mistakes']]
        o += ['']
    o += ['## ' + T['signs_h1'], '']
    by = {}
    for s in d['signs']:
        by.setdefault(s['group'], []).append(s)
    for g in GROUP_ORDER:
        if g in by:
            o += ['### ' + (by[g][0].get('gname') or g), '', T['group_blurb'][g], '']
            o += ['- **%s %s**: %s%s' % (s['code'], s['name'], s['meaning'], (' ' + s['note']) if s.get('note') else '') for s in by[g]] + ['']
    return '\n'.join(o)


# ---------- ресурсы, проверки ----------

def build_css():
    src = open(os.path.join(BASE, 'src', 'styles.css'), encoding='utf-8').read()
    tokens = src[:src.index('*{box-sizing')]
    own = open(os.path.join(BASE, 'src', 'seo.css'), encoding='utf-8').read()
    css = tokens + '\n' + open(os.path.join(BASE, 'src', 'fonts.css'), encoding='utf-8').read() + own
    import hashlib
    CSS_VERSION[0] = hashlib.sha256(css.encode()).hexdigest()[:8]
    return css


def copy_assets():
    seo = os.path.join(BASE, 'src', 'seo')
    need = ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og-ru.png', 'og-kk.png', 'og-en.png']
    miss = [n for n in need if not os.path.exists(os.path.join(seo, n))]
    if miss:
        raise SystemExit('build_seo: нет файлов в src/seo: %s (запустите python3 tools/make_seo_images.py)' % ', '.join(miss))
    shutil.copy(os.path.join(seo, 'favicon.svg'), os.path.join(PUB, 'favicon.svg'))
    shutil.copy(os.path.join(seo, 'favicon.ico'), os.path.join(PUB, 'favicon.ico'))
    shutil.copy(os.path.join(seo, 'apple-touch-icon.png'), os.path.join(PUB, 'apple-touch-icon.png'))
    for n in ('icon-192.png', 'icon-512.png'):
        os.makedirs(os.path.join(PUB, 'assets', 'icons'), exist_ok=True)
        shutil.copy(os.path.join(seo, n), os.path.join(PUB, 'assets', 'icons', n))
    for l in LANGS:
        os.makedirs(os.path.join(PUB, 'assets', 'og'), exist_ok=True)
        shutil.copy(os.path.join(seo, 'og-%s.png' % l), os.path.join(PUB, 'assets', 'og', 'og-%s.png' % l))


def write_signs_svg(datas):
    ru = {s['code']: s['svg'] for s in datas['ru']['signs']}
    n = 0
    for lang in LANGS:
        sub = [] if lang == 'ru' else [lang]
        for s in datas[lang]['signs']:
            if lang == 'ru' or s['svg'] != ru[s['code']]:
                write(os.path.join(PUB, 'assets', 'signs', *sub, slug_sign(s['code']) + '.svg'), s['svg'])
                n += 1
    return n


def check_site(pages):
    """Проверки: ссылки ведут на существующие файлы, hreflang взаимные, JSON-LD разбирается, нет длинных тире и меток."""
    problems = []
    files = set()
    for root, _, names in os.walk(PUB):
        for nm in names:
            files.add(os.path.relpath(os.path.join(root, nm), PUB).replace(os.sep, '/'))

    def exists(path):
        path = path.split('#')[0].split('?')[0]
        if not path.startswith('/'):
            return True
        rel = path.strip('/')
        return (rel in files) or (rel + '/index.html' in files) or (rel == '')

    for lang, p in pages:
        f = out_file(lang, p['key'])
        text = open(f, encoding='utf-8').read()
        for m in re.finditer(r'href="(/[^"#?]*)', text):
            if not exists(m.group(1)):
                problems.append('%s: битая ссылка %s' % (os.path.relpath(f, PUB), m.group(1)))
        for m in re.finditer(r'src="(/[^"?]*)', text):
            if not exists(m.group(1)):
                problems.append('%s: нет файла %s' % (os.path.relpath(f, PUB), m.group(1)))
        for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', text, re.S):
            try:
                json.loads(m.group(1).replace('<\\/', '</'))
            except Exception as ex:
                problems.append('%s: JSON-LD не разбирается: %s' % (os.path.relpath(f, PUB), ex))
        if any(c in text for c in DASHES):
            problems.append('%s: длинное тире' % os.path.relpath(f, PUB))
        if '⟦' in text:
            problems.append('%s: метка ⟦n⟧' % os.path.relpath(f, PUB))
        if lang == 'en' and re.search('[А-Яа-яЁё]', re.sub(r'<script.*?</script>|<title>.*?</title>|<nav class="langsw".*?</nav>', '', text, flags=re.S).replace('Жолдас', '')):
            problems.append('%s: кириллица на английской странице' % os.path.relpath(f, PUB))
        if len(p['title']) > 80 or len(p['desc']) > 175:
            problems.append('%s: слишком длинные title/description (%d/%d)' % (os.path.relpath(f, PUB), len(p['title']), len(p['desc'])))
    return problems


def generate(strict=False, datas=None):
    """Собирает все SEO-страницы и файлы. -> (число страниц, список проблем)."""
    if datas is None:
        ru = C.load_ru(BASE)
        datas = {lang: C.localize(ru, lang, BASE)[0] for lang in LANGS}
    css = build_css()
    write(os.path.join(PUB, 'assets', 'seo.css'), css)
    copy_assets()
    pages = build_pages(datas)
    for lang, p in pages:
        write(out_file(lang, p['key']), page_html(lang, p))
    T = TXT['ru']
    write(os.path.join(PUB, '404.html'), page_html('ru', {'key': '/404.html', 'title': '404 - ' + T['name_full'], 'desc': '404', 'body': page_404('ru', T) + '<hr>' + page_404('kk', TXT['kk']) + '<hr>' + page_404('en', TXT['en']),
                                                            'type': 'website'}).replace('<meta name="robots" content="index,follow', '<meta name="robots" content="noindex,follow'))
    keys = ['/'] + sorted({p['key'] for _, p in pages}, key=lambda k: (k.count('/'), k))
    write(os.path.join(PUB, 'sitemap.xml'), sitemap(keys))
    write(os.path.join(PUB, 'robots.txt'), robots())
    write(os.path.join(PUB, 'manifest.webmanifest'), manifest())
    write(os.path.join(PUB, 'llms.txt'), llms_txt(datas))
    write(os.path.join(PUB, 'llms-full.txt'), llms_full('en', datas['en']))
    write(os.path.join(PUB, 'llms-full-ru.txt'), llms_full('ru', datas['ru']))
    write(os.path.join(PUB, 'llms-full-kk.txt'), llms_full('kk', datas['kk']))
    nsvg = write_signs_svg(datas)
    problems = check_site(pages)
    for f in ('llms.txt', 'llms-full.txt', 'llms-full-ru.txt', 'llms-full-kk.txt', 'robots.txt', 'sitemap.xml'):
        t = open(os.path.join(PUB, f), encoding='utf-8').read()
        if any(c in t for c in DASHES):
            problems.append('%s: длинное тире' % f)
    print('seo: pages %d (%d per language), sitemap urls %d, signs svg %d, site %s, problems %d' % (
        len(pages), len(pages) // 3, len(keys) * 3, nsvg, SITE_URL, len(problems)))
    for pr in problems[:40]:
        print('  ' + pr)
    if strict and problems:
        raise SystemExit(1)
    return len(pages), problems


if __name__ == '__main__':
    generate(strict='--strict' in sys.argv)
