"""Самотест трехъязычной сборки: собирает ru, kk, en в память (файлы не пишет) и проверяет инварианты.

- ru: данные совпадают с контентом, добавлены только lang, langs, gname, cls;
- kk, en: те же модули и вопросы (id, порядок, число), answer и число вариантов не изменились,
  у схем те же ключи и значения (меняются только подписи, буквы траекторий, размеры, значения на знаках),
  у знаков, practice, categories та же структура;
- нигде не осталось меток ⟦n⟧, в страницах нет длинных тире;
- en: в уже переведенных пакетах (вопросы, теория, знаки, practice, categories) нет кириллицы
  (кроме буквы «У» учебного ТС на схемах), в сводке переведенных пакетов нет пропусков;
- детерминированные замены (единицы, города, буквы траекторий, надписи на знаках) и шапка страницы.

Usage: python3 tools/i18n_build_test.py
"""
import json, os, re, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'tools'))
import build  # noqa: E402
import i18n_content as C  # noqa: E402

fails = []


def check(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond:
        fails.append(msg)


def strings(o, path=''):
    """Все строки структуры с путями."""
    if isinstance(o, dict):
        for k, v in o.items():
            yield from strings(v, (path + '.' if path else '') + str(k))
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from strings(v, (path + '.' if path else '') + str(i))
    elif isinstance(o, str):
        yield path, o


def shape(a, b, path=''):
    """Одинаковая структура: ключи, длины списков, типы, нестроковые значения. -> описание отличия или None."""
    if isinstance(a, dict):
        if not isinstance(b, dict) or set(a) != set(b):
            return '%s: ключи %s / %s' % (path, sorted(a) if isinstance(a, dict) else a, sorted(b) if isinstance(b, dict) else b)
        for k in a:
            r = shape(a[k], b[k], path + '.' + str(k))
            if r:
                return r
    elif isinstance(a, list):
        if not isinstance(b, list) or len(a) != len(b):
            return '%s: длина списка' % path
        for i, (x, y) in enumerate(zip(a, b)):
            r = shape(x, y, '%s[%d]' % (path, i))
            if r:
                return r
    elif isinstance(a, str):
        if not isinstance(b, str):
            return '%s: не строка' % path
    elif a != b or type(a) is not type(b):
        return '%s: %r != %r' % (path, a, b)
    return None


SCENE_CHANGE = re.compile(r'^(?:labels\.\d+\.text|side\.\d+\.text|items\.\d+\.label|cars\.\d+\.paths\.\d+\.label|dims\.\d+\.label)$')
SIGN_PATH = re.compile(r'^(?:signs|items)\.')


def scene_diff(a, b):
    """Отличия схемы, которых не должно быть (меняются только подписи и значения на знаках)."""
    r = shape(a, b)
    if r:
        return [r]
    bad = []
    sb = dict(strings(b))
    for p, v in strings(a):
        w = sb[p]
        if v == w or SCENE_CHANGE.match(p):
            continue
        if SIGN_PATH.match(p) and ':' in v and v.split(':', 1)[0] == w.split(':', 1)[0]:
            continue
        bad.append('%s: %r -> %r' % (p, v, w))
    return bad


def main():
    # ---------- детерминированные замены ----------
    check(C.en_units('3,5 м') == '3.5 m' and C.en_units('10 т') == '10 t' and C.en_units('3.5м') == '3.5m'
          and C.en_units('20 км/ч') == '20 km/h', 'en: единицы и десятичная точка')
    check(C.conv_code('5.22:АКСУ', 'en') == '5.22:AKSU' and C.conv_code('5.23:КОСТАНАЙ', 'kk') == '5.23:ҚОСТАНАЙ'
          and C.conv_code('5.24:ЕСИК', 'kk') == '5.24:ЕСІК', 'города на знаках 5.22-5.25')
    check(C.conv_code('3.13:3,5 м', 'en') == '3.13:3.5 m' and C.conv_code('3.13:3,5 м', 'kk') == '3.13:3,5 м'
          and C.conv_code('p:200 м', 'en') == 'p:200 m' and C.conv_code('2.4', 'en') == '2.4', 'значения на знаках')
    sc = {'cars': [{'label': 'У', 'paths': [{'label': 'А'}, {'label': 'В'}]}], 'dims': [{'label': '10 м'}],
          'signs': [{'codes': ['5.24:АКСАЙ', '3.11:10 т']}], 'items': [['3.13:3,5 м', '7.1.1'], '3.12:6 т']}
    bad = []
    C.fix_scene(sc, 'en', bad)
    check(sc == {'cars': [{'label': 'У', 'paths': [{'label': 'A'}, {'label': 'C'}]}], 'dims': [{'label': '10 m'}],
                 'signs': [{'codes': ['5.24:AKSAY', '3.11:10 t']}], 'items': [['3.13:3.5 m', '7.1.1'], '3.12:6 t']} and not bad,
          'en: схема (буквы траекторий, размеры, знаки; «У» остается)')
    sc = {'cars': [{'paths': [{'label': 'Б'}]}], 'dims': [{'label': '10 м'}], 'signs': {'S': ['5.22:ТАЛГАР', '3.11:10 т']}}
    C.fix_scene(sc, 'kk')
    check(sc == {'cars': [{'paths': [{'label': 'Б'}]}], 'dims': [{'label': '10 м'}], 'signs': {'S': ['5.22:ТАЛҒАР', '3.11:10 т']}},
          'kk: схема (меняются только города)')
    bad = []
    C.fix_scene({'signs': [{'codes': ['5.22:ШЫМКЕНТ']}]}, 'en', bad)
    check(len(bad) == 1, 'неизвестный город на знаке попадает в отчет')
    svg = "<svg><text x='5'>2,5 м</text><text>ТАМОЖНЯ</text><text>АККОЛЬ</text></svg>"
    check(C.svg_text(svg, 'en') == "<svg><text x='5'>2.5 m</text><text>CUSTOMS</text><text>AKKOL</text></svg>"
          and C.svg_text(svg, 'kk') == "<svg><text x='5'>2,5 м</text><text>ТАМОЖНЯ</text><text>АҚКӨЛ</text></svg>",
          'надписи на картинках знаков каталога')
    check(C.change_cls('в силе с 01.01') == 'green' and C.change_cls('объявлено') == 'yellow' and C.change_cls('проект') == 'blue',
          'cls по статусу изменений 2026')
    check(build.main(['--lang', 'kk']) == 2, 'kk без --api: ошибка')

    ru = C.load_ru()
    before = json.dumps(ru, ensure_ascii=False)
    nq = sum(len(m['questions']) for m in ru['modules'])
    rq = {q['id']: q for m in ru['modules'] for q in m['questions']}
    print('     вопросов в банке:', nq)

    # ---------- устаревший перевод и ошибки в переводе: остается русский текст, запись в отчете ----------
    ru2 = json.loads(before)
    q2 = {q['id']: q for m in ru2['modules'] for q in m['questions']}
    m01 = [m for m in ru2['modules'] if m['id'] == 'm01'][0]
    q2['m01-01']['q'] += ' (изменено)'       # русский текст изменился после выгрузки пакета
    m01['keyFacts'][0] += ' (изменено)'
    orig = C.load_translations

    def fake(lang, rep, base=C.BASE):
        tr = orig(lang, rep, base)
        qs = {q['id']: q for q in (tr.get('m01-1') or {}).get('questions', [])}
        if 'm01-05' in qs and 'm01-n005' in qs:
            qs['m01-05']['explain'] += ' ⟦999⟧'                              # чужая метка
            qs['m01-n005']['answer'] = (qs['m01-n005']['answer'] + 1) % 4     # answer изменен переводчиком
        return tr
    C.load_translations = fake
    try:
        for lang in ('kk', 'en'):
            d2, rep2 = C.localize(ru2, lang)
            if 'm01-1' not in rep2.files:
                print('     [%s] нет перевода m01-1, проверка устаревших переводов пропущена' % lang)
                continue
            dq = {q['id']: q for m in d2['modules'] for q in m['questions']}
            why = {w: r for p, w, r in rep2.items if p == 'm01-1'}
            dm01 = [m for m in d2['modules'] if m['id'] == 'm01'][0]
            check(dq['m01-01'] == q2['m01-01'] and 'устарел' in why.get('m01-01', ''), '[%s] устаревший вопрос остается русским' % lang)
            check(dm01['keyFacts'][0] == m01['keyFacts'][0] and 'устарел' in why.get('keyFacts[0]', ''), '[%s] устаревшая строка теории остается русской' % lang)
            check(dq['m01-05'] == q2['m01-05'] and 'метки' in why.get('m01-05', ''), '[%s] перевод с чужой меткой не принят' % lang)
            check(dq['m01-n005'] == q2['m01-n005'] and 'answer' in why.get('m01-n005', ''), '[%s] перевод с другим answer не принят' % lang)
            check('m01-02' in rep2.translated_q and dm01['keyFacts'][1] != m01['keyFacts'][1], '[%s] остальное переведено' % lang)
    finally:
        C.load_translations = orig

    # ---------- ru ----------
    r = build.build_lang('ru', ru, True, True)
    d = json.loads(json.dumps(r['data'], ensure_ascii=False))
    check(d.pop('lang') == 'ru' and d.pop('langs') == build.LANG_MENU and d.pop('api') == '/api/v1', 'ru: D.lang, D.langs, D.api')
    check(all(s.pop('gname') == s['group'] for s in d['signs']), 'ru: gname = group')
    check(all(c.pop('cls') in ('green', 'yellow', 'blue') for c in d['practice']['exam']['changes2026']), 'ru: cls у изменений 2026')
    check(json.dumps(d, ensure_ascii=False) == before, 'ru: остальные данные совпадают с контентом')
    check(not r['notes'] and not r['stats']['dashes'], 'ru: без замечаний и длинных тире')

    for lang in ('kk', 'en'):
        r = build.build_lang(lang, ru, True, True, strict=False)
        d, rep, page = r['data'], r['report'], r['html']
        L = '[%s] ' % lang
        check(json.dumps(ru, ensure_ascii=False) == before, L + 'русские данные не изменились при наложении')
        # модули и вопросы
        check([m['id'] for m in d['modules']] == [m['id'] for m in ru['modules']], L + 'те же модули в том же порядке')
        lq = [q for m in d['modules'] for q in m['questions']]
        check([q['id'] for q in lq] == [q['id'] for m in ru['modules'] for q in m['questions']] and len(lq) == nq,
              L + 'те же %d вопросов в том же порядке' % nq)
        bad_ans = [q['id'] for q in lq if q['answer'] != rq[q['id']]['answer']]
        check(not bad_ans, L + 'answer не изменились %s' % bad_ans[:5])
        bad_opt = [q['id'] for q in lq if len(q['options']) != len(rq[q['id']]['options'])]
        check(not bad_opt, L + 'число вариантов совпадает %s' % bad_opt[:5])
        keys = ('id', 'type', 'answer', 'difficulty', 'cats', 'sign')
        bad_f = [q['id'] for q in lq if set(q) != set(rq[q['id']]) or any(q.get(k) != rq[q['id']].get(k) for k in keys)]
        check(not bad_f, L + 'служебные поля вопросов не изменились %s' % bad_f[:5])
        bad_sc = []
        for q in lq:
            if 'scene' in rq[q['id']]:
                bad_sc += ['%s: %s' % (q['id'], x) for x in scene_diff(rq[q['id']]['scene'], q.get('scene'))]
        check(not bad_sc, L + 'схемы: те же ключи и значения, меняются только подписи %s' % bad_sc[:5])
        untouched = [q['id'] for q in lq if q['id'] not in rep.translated_q and q != rq[q['id']]]
        check(not untouched, L + 'непереведенные вопросы остались русскими целиком %s' % untouched[:5])
        # знаки, practice, categories
        check([(s['code'], s['group']) for s in d['signs']] == [(s['code'], s['group']) for s in ru['signs']], L + 'знаки: те же коды и group')
        strip = lambda svg: re.sub(r'(<text\b[^>]*>)[^<]*(</text>)', r'\1\2', svg)  # noqa: E731
        check(all(strip(a['svg']) == strip(b['svg']) for a, b in zip(d['signs'], ru['signs'])), L + 'знаки: картинки отличаются только надписями')
        check(all(s['gname'] == C.GROUPS[s['group']][C.LI[lang]] for s in d['signs']), L + 'знаки: gname на языке сборки')
        for src in ('practice', 'categories'):
            x = json.loads(json.dumps(d[src], ensure_ascii=False))
            if src == 'practice':  # cls добавляет сборка
                for c in x['exam']['changes2026']:
                    c.pop('cls')
            r2 = shape(ru[src], x)
            xs = dict(strings(x))
            same_plain = all(xs.get(p) == v for p, v in strings(ru[src]) if not C.CYR.search(v))
            check(r2 is None and same_plain, L + '%s: та же структура, служебные строки не изменились %s' % (src, r2 or ''))
        check(all(c['cls'] == C.change_cls(c0['status']) for c, c0 in zip(d['practice']['exam']['changes2026'], ru['practice']['exam']['changes2026'])),
              L + 'cls по русскому статусу')
        # метки, тире, шапка
        marks = [p for p, v in strings(d) if '⟦' in v]
        check(not marks, L + 'нет меток ⟦n⟧ в данных %s' % marks[:5])
        check('⟦' not in page and not any(c in page for c in build.DASHES), L + 'в странице нет меток и длинных тире')
        P = build.PAGE[lang]
        import build_seo as SEO
        from seo_text import TXT as SEOT
        Sx = SEO.stats(d, lang)
        Mx = SEO.home_meta(lang, Sx)
        check(page.startswith('<!doctype html>\n<html lang="%s">' % lang) and '<title>%s</title>' % Mx['title'] in page
              and 'content="%s"' % Mx['desc'] in page and 'og:locale" content="%s"' % P['locale'] in page, L + 'шапка: lang, title, description, og')
        check(all('<link rel="alternate" hreflang="%s" href="%s">' % (l, SEO.url_for(l, '/')) for l in SEOT) and '<link rel="canonical" href="%s">' % SEO.url_for(lang, '/') in page
              and 'hreflang="x-default"' in page, L + 'hreflang ru, kk, en, x-default и canonical (абсолютные адреса)')
        check('class="seo-pre"' in page and page.count('<title>') == 1 and page.count('name="description"') == 1, L + 'предварительная разметка главной, один title и description')
        check('aria-label="Жолдас, мой план"' not in page and 'aria-label="Разделы"' not in page
              and P['foot2'] in page and P['foot1'] in page and '<span class="brand-sub">%s</span>' % P['sub'] in page,
              L + 'шаблон: aria-label, бренд, футер')
        check(d['lang'] == lang and d['langs'] == build.LANG_MENU, L + 'D.lang, D.langs')
        check(not [t for k, t in r['notes'] if k == 'err'], L + 'нет ошибок сборки в обычном режиме')
        # переведенные пакеты
        done = sorted(p for p in rep.files if p != 'signs-names')
        print('     %sпереведенные пакеты: %s; вопросов переведено %d из %d' % (L, ', '.join(done) or '-', len(rep.translated_q), nq))
        problems = [x for x in rep.items if x[0] in rep.files]
        check(not problems, L + 'в переведенных пакетах нет пропусков и устаревших строк %s' % problems[:5])
        packs = C.Packs()
        tq = [q for q in lq if packs.q.get(q['id']) in rep.files]
        check(all(q['id'] in rep.translated_q for q in tq), L + 'все вопросы переведенных пакетов переведены (%d)' % len(tq))
        if lang == 'kk':
            same = [q['id'] for q in tq if q['q'] == rq[q['id']]['q']]
            check(not same, L + 'текст переведенных вопросов отличается от русского %s' % same[:5])
            continue
        # en: кириллица в переведенном
        cyr = []
        for q in tq:
            for p, v in strings({k: q[k] for k in ('q', 'options', 'explain', 'ref', 'scene') if k in q}):
                if C.CYR_ANY.search(v) and not (re.match(r'^scene\.cars\.\d+\.label$', p) and v == 'У'):
                    cyr.append('%s.%s: %s' % (q['id'], p, v[:40]))
        for m in d['modules']:
            if packs.theory.get(m['id']) in rep.files:
                th = {k: m[k] for k in ('title', 'pdd', 'summary', 'lesson', 'keyFacts', 'mistakes')}
                cyr += ['%s.%s: %s' % (m['id'], p, v[:40]) for p, v in strings(th) if C.CYR_ANY.search(v)]
        cyr += ['знак %s: %s' % (s['code'], s['name']) for s in d['signs'] if C.CYR_ANY.search(s['name'] + s['gname'])]
        cyr += ['знак %s: картинка' % s['code'] for s in d['signs'] if C.CYR_ANY.search(''.join(re.findall(r'<text\b[^>]*>([^<]*)</text>', s['svg'])))]
        if packs.signs in rep.files:
            cyr += ['знак %s: %s' % (s['code'], k) for s in d['signs'] for k in ('meaning', 'note') if C.CYR_ANY.search(s.get(k, ''))]
        for src in ('practice', 'categories'):
            cyr += ['%s.%s' % (src, p) for p, v in strings(d[src]) if C.CYR_ANY.search(v) and packs.flat.get((src, p)) in rep.files]
        check(not cyr, L + 'нет кириллицы в переведенном контенте %s' % cyr[:5])

    print('FAILS', len(fails))
    for f in fails:
        print(' -', f)
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
