"""Контент сайта на языке сборки: русские данные из content/*.json и наложение переводов kk/en.

Переводы: content/i18n/<lang>/<pack>.json (структура исходного пакета content/i18n/packs/<pack>.json,
строки переведены, метки ⟦n⟧ на месте). Карта меток refs берется из исходного пакета.

Правила наложения:
- перевод строки принимается, только если исходный пакет совпадает с текущим русским текстом
  (иначе перевод устарел) и метки ⟦n⟧ в переводе те же, что в пакете;
- вопрос переводится целиком (q, options, explain, подписи схемы, ref) или остается русским целиком,
  чтобы текст и схема не расходились (буквы траекторий, значения на знаках);
- теория, знаки, practice и categories переводятся построчно;
- непереведенное остается по-русски и попадает в отчет (Report); build.py --strict превращает отчет в ошибку.

Используется build.py и tools/i18n_build_test.py.
"""
import glob, json, os, re, sys, textwrap

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from i18n_refs import conv, conv_inline  # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ('ru', 'kk', 'en')
LI = {'kk': 0, 'en': 1}                      # индекс языка в signs-names.json и таблицах ниже
CYR = re.compile('[А-Яа-яЁё]')               # русские буквы (так строятся пакеты)
CYR_ANY = re.compile('[Ѐ-ӿ]')      # любая кириллица, включая казахские буквы
PH = re.compile(r'⟦(\d+)⟧')

# названия групп знаков (group остается русским ключом для кода приложения, gname - подпись)
GROUPS = {
    'Предупреждающие знаки': ('Ескерту белгілері', 'Warning signs'),
    'Знаки приоритета': ('Басымдық белгілері', 'Priority signs'),
    'Запрещающие знаки': ('Тыйым салатын белгілер', 'Prohibitory signs'),
    'Предписывающие знаки': ('Нұсқайтын белгілер', 'Mandatory signs'),
    'Информационно-указательные знаки': ('Ақпараттық-нұсқағыш белгілер', 'Information signs'),
    'Знаки сервиса': ('Сервис белгілері', 'Service signs'),
    'Знаки дополнительной информации (таблички)': ('Қосымша ақпарат белгілері (тақтайшалар)', 'Additional information plates'),
}

# названия городов на знаках 5.22-5.25 (в схемах - значение кода, в каталоге - текст картинки)
CITY = {
    'kk': {'АКСУ': 'АҚСУ', 'АКЖАР': 'АҚЖАР', 'АКСАЙ': 'АҚСАЙ', 'ТАЛГАР': 'ТАЛҒАР', 'КОСТАНАЙ': 'ҚОСТАНАЙ',
           'КОРДАЙ': 'ҚОРДАЙ', 'ЕСИК': 'ЕСІК', 'ТАРАЗ': 'ТАРАЗ', 'АККОЛЬ': 'АҚКӨЛ'},
    'en': {'АКСУ': 'AKSU', 'АКЖАР': 'AKZHAR', 'АКСАЙ': 'AKSAY', 'ТАЛГАР': 'TALGAR', 'КОСТАНАЙ': 'KOSTANAY',
           'КОРДАЙ': 'KORDAY', 'ЕСИК': 'ESIK', 'ТАРАЗ': 'TARAZ', 'АККОЛЬ': 'AKKOL'},
}
CITY_SIGNS = ('5.22', '5.23', '5.24', '5.25')
# прочие надписи на картинках знаков каталога (kk: знаки как на дорогах, меняются только города)
SVG_WORDS = {
    'kk': {},
    'en': {'ТАМОЖНЯ': 'CUSTOMS', 'КОНТРОЛЬ': 'CONTROL', 'СТОП': 'STOP', 'кроме': 'except'},
}
# буквы траекторий на схемах (en); в kk буквы те же
PATH_EN = {'А': 'A', 'Б': 'B', 'В': 'C', 'Г': 'D', 'Д': 'E'}
# единицы после числа (en)
UNITS_EN = {'км/ч': 'km/h', 'км': 'km', 'кг': 'kg', 'мин': 'min', 'м': 'm', 'т': 't', 'ч': 'h'}
UNIT_RE = re.compile(r'(?<=\d)(\s?)(км/ч|км|кг|мин|м|т|ч)(?![А-Яа-яЁёA-Za-z])')
CODE_VAL = re.compile(r'^(p|\d+(?:\.\d+)*):(.+)$')
# подписи схем, которые переводят переводчики (как в tools/i18n_packs.py SCENE_TEXT)
SCENE_PACK_PATH = re.compile(r'^(?:labels\.\d+\.text|side\.\d+\.text|items\.\d+\.label)$')
SCENE_KEEP = re.compile(r'^cars\.\d+\.label$')    # 'У' (учебное ТС) остается на всех языках
# ключи practice/categories, которые не переводятся (как в tools/i18n_packs.py)
SKIP_FLAT = {'id', 'code', 'url', 'cats', 'updated', 'group'}


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


# ---------- русские данные ----------

def load_ru(base=BASE):
    """Модули (с доп. вопросами content/extra), знаки (с signs-extra), practice, categories."""
    mods = {}
    for f in sorted(glob.glob(base + '/content/m*.json')):
        m = load(f)
        mods[m['id']] = m
    seen = {}
    for m in mods.values():
        for q in m['questions']:
            assert q['id'] not in seen, ('duplicate id', q['id'])
            seen[q['id']] = m['id']
    for f in sorted(glob.glob(base + '/content/extra/m*-*.json')):
        d = load(f)
        mid = d['module']
        assert mid in mods, ('unknown module', f, mid)
        for q in d['questions']:
            assert q['id'] not in seen, ('duplicate id', f, q['id'])
            seen[q['id']] = mid
            mods[mid]['questions'].append(q)
    signs = load(base + '/content/signs.json')
    codes = {s['code'] for s in signs}
    extra = base + '/content/extra/signs-extra.json'
    if os.path.exists(extra):
        for s in load(extra):
            if s['code'] not in codes:
                signs.append(s)
                codes.add(s['code'])
    signs.sort(key=lambda s: [int(x) for x in re.findall(r'\d+', s['code'])])
    return {
        'modules': sorted(mods.values(), key=lambda m: m['order']),
        'signs': signs,
        'practice': load(base + '/content/practice.json'),
        'categories': load(base + '/content/categories.json'),
    }


def change_cls(status):
    """Цвет бейджа изменения 2026 по русскому статусу (как в app.js)."""
    s = status or ''
    return 'green' if s.startswith('в силе') else ('yellow' if s.startswith('объявлено') else 'blue')


def add_common(data, lang):
    """Поля для всех языков: cls у practice.exam.changes2026, gname у знаков (group - русский ключ)."""
    for c in ((data.get('practice') or {}).get('exam') or {}).get('changes2026') or []:
        c['cls'] = change_cls(c.get('status'))
    for s in data['signs']:
        s['gname'] = s['group']


# ---------- отчет о непереведенном ----------

class Report:
    """Непереведенное по пакетам. stat[pack] = [вопросов, из них без перевода, строк, из них без перевода]."""

    def __init__(self, lang):
        self.lang = lang
        self.stat = {}
        self.items = []          # (pack, где, причина)
        self.warn = []           # общие предупреждения (битый JSON и т.п.)
        self.real = set()        # исходные пакеты (content/i18n/packs) и signs-names
        self.files = set()       # пакеты, для которых есть файл перевода
        self.translated_q = set()

    def _st(self, pack):
        return self.stat.setdefault(pack, [0, 0, 0, 0])

    def total(self, pack, kind):
        self._st(pack)[0 if kind == 'q' else 2] += 1

    def miss(self, pack, kind, where, why):
        self._st(pack)[1 if kind == 'q' else 3] += 1
        self.items.append((pack, where, why))

    def issue(self, pack, where, why):
        """Проблема без отдельной единицы учета (метка без перевода, кириллица в схеме)."""
        self._st(pack)
        self.items.append((pack, where, why))

    def totals(self):
        q = sum(v[0] for v in self.stat.values())
        qm = sum(v[1] for v in self.stat.values())
        s = sum(v[2] for v in self.stat.values())
        sm = sum(v[3] for v in self.stat.values())
        return q, qm, s, sm

    def nofile(self):
        """Исходные пакеты без файла перевода (с непереведенными элементами)."""
        return [p for p in sorted(self.stat) if p in self.real and p not in self.files and (self.stat[p][1] or self.stat[p][3])]

    def summary(self):
        """Сводка для печати без --strict."""
        L = self.lang
        q, qm, s, sm = self.totals()
        out = ['[%s] контент: переведено вопросов %d из %d, строк %d из %d; непереведенное остается по-русски'
               % (L, q - qm, q, s - sm, s)]
        nofile = self.nofile()
        if nofile:
            head = '[%s] нет перевода в %d пакетах (вопросов/строк): ' % (L, len(nofile))
            body = ', '.join('%s %d/%d' % (p, self.stat[p][1], self.stat[p][3]) for p in nofile)
            out += textwrap.wrap(head + body, 150, subsequent_indent=' ' * 5, break_on_hyphens=False)
        why = {}
        for p, w, r in self.items:
            if p in nofile and r == 'нет перевода':
                continue
            why.setdefault(p, []).append((w, r))
        for p in sorted(why):
            st = self.stat[p]
            head = '[%s] %s: вопросов без перевода %d из %d, строк %d из %d' % (L, p, st[1], st[0], st[3], st[2])
            ex = '; '.join('%s: %s' % x for x in why[p][:4]) + (' ...' if len(why[p]) > 4 else '')
            out.append(head + (' (' + ex + ')' if ex else ''))
        for w in self.warn:
            out.append('[%s] %s' % (L, w))
        return out

    def errors(self, limit=300):
        """Список для ошибки --strict: пакеты без перевода одной строкой, остальное подробно."""
        L = self.lang
        out = []
        nofile = set(self.nofile())
        for p in sorted(nofile):
            out.append('[%s] %s: нет перевода (вопросов %d, строк %d)' % (L, p, self.stat[p][1], self.stat[p][3]))
        rest = [(p, w, r) for p, w, r in self.items if not (p in nofile and r == 'нет перевода')]
        for p, w, r in rest[:limit]:
            out.append('[%s] %s %s: %s' % (L, p, w, r))
        if len(rest) > limit:
            out.append('[%s] ... и еще %d' % (L, len(rest) - limit))
        out += ['[%s] %s' % (L, w) for w in self.warn]
        return out


# ---------- пакеты и переводы ----------

def restore(s, refs):
    """Строка пакета с метками -> русский текст контента."""
    return PH.sub(lambda m: refs.get(m.group(1), m.group(0)), s)


class Packs:
    """Индексы исходных пакетов: где лежит каждый элемент контента."""

    def __init__(self, base=BASE):
        self.src = {}
        for f in sorted(glob.glob(base + '/content/i18n/packs/*.json')):
            name = os.path.basename(f)[:-5]
            if not name.startswith('_'):
                self.src[name] = load(f)
        self.theory = {}      # module -> pack
        self.q = {}           # question id -> pack
        self.qsrc = {}        # question id -> вопрос пакета
        self.signs = None     # pack
        self.flat = {}        # (source, path) -> pack
        for name, p in self.src.items():
            if p.get('kind') == 'signs':
                self.signs = name
            elif p.get('kind') == 'flat':
                for k in p.get('strings', {}):
                    self.flat[(p['source'], k)] = name
            elif p.get('module'):
                if 'meta' in p:
                    self.theory[p['module']] = name
                for q in p.get('questions', []):
                    self.q[q['id']] = name
                    self.qsrc[q['id']] = q


def load_translations(lang, rep, base=BASE):
    tr = {}
    for f in sorted(glob.glob('%s/content/i18n/%s/*.json' % (base, lang))):
        name = os.path.basename(f)[:-5]
        try:
            tr[name] = load(f)
        except Exception as e:  # файл могут дописывать прямо сейчас
            rep.warn.append('перевод %s/%s.json не прочитан (%s), пакет считается непереведенным' % (lang, name, e))
    return tr


# ---------- детерминированные замены (схемы, картинки знаков) ----------

def en_units(s):
    """'3,5 м' -> '3.5 m', '10 т' -> '10 t', '20 км/ч' -> '20 km/h'."""
    s = re.sub(r'(?<=\d),(?=\d)', '.', s)
    return UNIT_RE.sub(lambda m: m.group(1) + UNITS_EN[m.group(2)], s)


def conv_code(code, lang, bad=None):
    """Код знака со значением 'база:значение' (5.22:АКСУ, 3.13:3,5 м, p:200 м) на языке сборки."""
    if not isinstance(code, str):
        return code
    m = CODE_VAL.match(code)
    if not m or lang == 'ru':
        return code
    base, val = m.groups()
    if base in CITY_SIGNS:
        u = val.upper()
        if u in CITY[lang]:
            val = CITY[lang][u]
        elif bad is not None and CYR.search(val):
            bad.append('город на знаке %s без перевода: %s' % (base, val))
    elif lang == 'en':
        val = en_units(val)
    return base + ':' + val


def _codes(x, lang, bad):
    if isinstance(x, str):
        return conv_code(x, lang, bad)
    if isinstance(x, list):
        return [_codes(y, lang, bad) for y in x]
    return x


def fix_scene(sc, lang, bad=None):
    """Замены в схеме, которых нет в пакетах (in place): буквы траекторий и размеры (en),
    значения на знаках (en: единицы и десятичная точка; kk, en: названия городов)."""
    if lang == 'ru' or not isinstance(sc, dict):
        return sc
    if lang == 'en':
        for car in sc.get('cars') or []:
            for p in (car.get('paths') or []) if isinstance(car, dict) else []:
                if isinstance(p, dict) and isinstance(p.get('label'), str):
                    if p['label'] in PATH_EN:
                        p['label'] = PATH_EN[p['label']]
                    elif bad is not None and CYR_ANY.search(p['label']):
                        bad.append('буква траектории без перевода: %s' % p['label'])
        for d in sc.get('dims') or []:
            if isinstance(d, dict) and isinstance(d.get('label'), str):
                d['label'] = en_units(d['label'])
    signs = sc.get('signs')
    if isinstance(signs, list):
        for i, g in enumerate(signs):
            if isinstance(g, dict):
                for k in ('codes', 'code'):
                    if k in g:
                        g[k] = _codes(g[k], lang, bad)
            else:
                signs[i] = _codes(g, lang, bad)
    elif isinstance(signs, dict):
        for k in list(signs):
            signs[k] = _codes(signs[k], lang, bad)
    items = sc.get('items')
    if isinstance(items, list):
        for i, it in enumerate(items):
            if isinstance(it, (str, list)):
                items[i] = _codes(it, lang, bad)
    return sc


def scene_strings(o, path=''):
    """Все строки схемы с путями 'labels.0.text'."""
    if isinstance(o, dict):
        for k, v in o.items():
            yield from scene_strings(v, (path + '.' if path else '') + str(k))
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from scene_strings(v, (path + '.' if path else '') + str(i))
    elif isinstance(o, str):
        yield path, o


def svg_text(svg, lang, bad=None):
    """Надписи на картинке знака каталога (<text>...</text>)."""
    if lang == 'ru':
        return svg

    def f(m):
        t = m.group(2)
        if t in CITY[lang]:
            t = CITY[lang][t]
        elif t in SVG_WORDS[lang]:
            t = SVG_WORDS[lang][t]
        elif lang == 'en':
            t = en_units(t)
        if lang == 'en' and bad is not None and CYR_ANY.search(t):
            bad.append(t)
        return m.group(1) + t + m.group(3)
    return re.sub(r'(<text\b[^>]*>)([^<]*)(</text>)', f, svg)


# ---------- наложение перевода ----------

def _set(obj, parts, val):
    """Записать значение по пути ['labels', '0', 'text'] (числа - индексы списков)."""
    for p in parts[:-1]:
        obj = obj[int(p)] if isinstance(obj, list) else obj[p]
    last = parts[-1]
    if isinstance(obj, list):
        obj[int(last)] = val
    else:
        obj[last] = val


def flat_strings(d, name):
    """Строки practice/categories с кириллицей по путям (правила tools/i18n_packs.py)."""
    out = {}

    def walk(o, path):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in SKIP_FLAT and not (name == 'practice' and k == 'group'):
                    continue
                walk(v, path + [k])
        elif isinstance(o, list):
            for i, v in enumerate(o):
                walk(v, path + [str(i)])
        elif isinstance(o, str) and CYR.search(o):
            out['.'.join(path)] = o
    walk(d, [])
    return out


class Localizer:
    def __init__(self, lang, rep, packs, tr):
        self.lang, self.rep, self.packs, self.tr = lang, rep, packs, tr
        self.li = LI[lang]

    def check(self, src_s, tr_s, ru, refs):
        """Причина отказа или None: перевод есть, пакет совпадает с текущим русским текстом, метки те же."""
        if not isinstance(tr_s, str) or not tr_s.strip():
            return 'нет перевода'
        if not isinstance(src_s, str):
            return 'нет в исходном пакете (пакет старше контента)'
        if restore(src_s, refs) != ru:
            return 'перевод устарел: русский текст изменился после выгрузки пакета'
        if sorted(PH.findall(src_s)) != sorted(PH.findall(tr_s)):
            return 'метки ⟦n⟧ не совпадают с пакетом'
        return None

    def marks(self, s, refs, pack, where):
        """⟦n⟧ -> ссылка на языке сборки; без перевода - русская ссылка и запись в отчет."""
        def f(m):
            ref = refs.get(m.group(1))
            if ref is None:
                self.rep.issue(pack, where, 'метка ⟦%s⟧ не найдена в пакете' % m.group(1))
                return ''
            r = conv_inline(ref, self.lang)
            if r is None:
                self.rep.issue(pack, where, 'ссылка %s без перевода' % ref)
                return ref
            return r
        return PH.sub(f, s)

    def string(self, pack, where, ru, src_s, tr_s, refs, count=True):
        """Одна строка: перевод или None (остается русской, записано в отчет).
        count=False - часть вопроса (ref, подпись схемы): не строка в счете, а замечание к вопросу."""
        if not isinstance(ru, str) or not ru.strip():
            return None
        if count:
            self.rep.total(pack, 's')
        why = self.check(src_s, tr_s, ru, refs)
        if why:
            if count:
                self.rep.miss(pack, 's', where, why)
            else:
                self.rep.issue(pack, where, why)
            return None
        return self.marks(tr_s, refs, pack, where)

    # --- модули ---
    def theory(self, m):
        mid = m['id']
        pack = self.packs.theory.get(mid)
        src = self.packs.src.get(pack) or {}
        t = self.tr.get(pack) or {}
        refs = src.get('refs') or {}
        pack = pack or mid + ' (нет в пакетах)'
        sm, tm = src.get('meta') or {}, t.get('meta') or {}
        for k in ('title', 'pdd', 'summary'):
            v = self.string(pack, 'meta.' + k, m[k], sm.get(k), tm.get(k), refs)
            if v is not None:
                m[k] = v
        sl, tl = src.get('lesson') or [], t.get('lesson') or []
        for i, sec in enumerate(m['lesson']):
            ss = sl[i] if i < len(sl) and isinstance(sl[i], dict) else {}
            ts = tl[i] if i < len(tl) and isinstance(tl[i], dict) else {}
            for k in ('h', 'tip'):
                if k in sec:
                    v = self.string(pack, 'lesson[%d].%s' % (i, k), sec[k], ss.get(k), ts.get(k), refs)
                    if v is not None:
                        sec[k] = v
            for k in ('p', 'list'):
                if k in sec:
                    sa, ta = ss.get(k) or [], ts.get(k) or []
                    for j, ru in enumerate(sec[k]):
                        v = self.string(pack, 'lesson[%d].%s[%d]' % (i, k, j), ru,
                                        sa[j] if j < len(sa) else None, ta[j] if j < len(ta) else None, refs)
                        if v is not None:
                            sec[k][j] = v
        for k in ('keyFacts', 'mistakes'):
            sa, ta = src.get(k) or [], t.get(k) or []
            for j, ru in enumerate(m[k]):
                v = self.string(pack, '%s[%d]' % (k, j), ru, sa[j] if j < len(sa) else None,
                                ta[j] if j < len(ta) else None, refs)
                if v is not None:
                    m[k][j] = v

    def question(self, m, q):
        """Вопрос переводится целиком или остается русским целиком."""
        qid = q['id']
        pack = self.packs.q.get(qid)
        if pack is None:
            pack = m['id'] + ' (нет в пакетах)'
            self.rep.total(pack, 'q')
            self.rep.miss(pack, 'q', qid, 'вопроса нет в пакетах')
            return
        self.rep.total(pack, 'q')
        sq = self.packs.qsrc[qid]
        refs = self.packs.src[pack].get('refs') or {}
        tq = None
        for x in (self.tr.get(pack) or {}).get('questions') or []:
            if isinstance(x, dict) and x.get('id') == qid:
                tq = x
                break
        if tq is None:
            self.rep.miss(pack, 'q', qid, 'нет перевода')
            return
        n = len(q['options'])
        why = None
        if sq.get('answer') != q['answer'] or len(sq.get('options') or []) != n:
            why = 'перевод устарел: ответ или варианты изменились после выгрузки пакета'
        elif tq.get('answer') != q['answer']:
            why = 'answer в переводе не совпадает (%r вместо %r)' % (tq.get('answer'), q['answer'])
        elif not isinstance(tq.get('options'), list) or len(tq['options']) != n:
            why = 'число вариантов в переводе не совпадает'
        else:
            pairs = [('q', q['q'], sq.get('q'), tq.get('q')), ('explain', q['explain'], sq.get('explain'), tq.get('explain'))]
            pairs += [('options[%d]' % i, q['options'][i], sq['options'][i], tq['options'][i]) for i in range(n)]
            for k, ru, s, t in pairs:
                why = self.check(s, t, ru, refs)
                if why:
                    why = k + ': ' + why
                    break
        if why:
            self.rep.miss(pack, 'q', qid, why)
            return
        where = qid
        q['q'] = self.marks(tq['q'], refs, pack, where)
        q['explain'] = self.marks(tq['explain'], refs, pack, where)
        q['options'] = [self.marks(x, refs, pack, where) for x in tq['options']]
        self.rep.translated_q.add(qid)
        # ref: перевод из пакета, иначе автоматически (conv)
        if 'ref' in sq:
            r = self.string(pack, qid + '.ref', q['ref'], sq['ref'], tq.get('ref'), {}, count=False)
        else:
            r = conv(q['ref'], self.lang)
            if r is None:
                self.rep.issue(pack, qid + '.ref', 'ссылка без перевода: ' + q['ref'])
        if r is not None:
            q['ref'] = r
        # схема: подписи из пакета + детерминированные замены
        sc = q.get('scene')
        if sc:
            ss, ts = sq.get('scene') or {}, tq.get('scene') or {}
            cur = dict(p for p in scene_strings(sc) if SCENE_PACK_PATH.match(p[0]) and CYR.search(p[1]))
            for path, ru in cur.items():
                v = self.string(pack, qid + '.scene.' + path, ru, ss.get(path),
                                ts.get(path) if isinstance(ts, dict) else None, {}, count=False)
                if v is not None:
                    _set(sc, path.split('.'), v)
            bad = []
            fix_scene(sc, self.lang, bad)
            if self.lang == 'en':
                for path, s in scene_strings(sc):
                    if CYR_ANY.search(s) and not SCENE_PACK_PATH.match(path) and not (SCENE_KEEP.match(path) and s == 'У'):
                        bad.append('кириллица в схеме %s: %s' % (path, s))
            for b in dict.fromkeys(bad):
                self.rep.issue(pack, qid + '.scene', b)

    # --- знаки ---
    def signs(self, signs, names):
        pack = self.packs.signs or 'signs (нет в пакетах)'
        src = self.packs.src.get(self.packs.signs) or {}
        refs = src.get('refs') or {}
        sidx = {s['code']: s for s in src.get('signs') or []}
        tidx = {s.get('code'): s for s in (self.tr.get(self.packs.signs) or {}).get('signs') or [] if isinstance(s, dict)}
        for s in signs:
            c = s['code']
            self.rep.total('signs-names', 's')
            nm = names.get(c)
            if isinstance(nm, list) and len(nm) == 2 and isinstance(nm[self.li], str) and nm[self.li].strip() \
                    and not (self.lang == 'en' and CYR_ANY.search(nm[self.li])):
                s['name'] = nm[self.li]
            else:
                self.rep.miss('signs-names', 's', c, 'нет названия в signs-names.json')
            ss, ts = sidx.get(c) or {}, tidx.get(c) or {}
            for k in ('meaning', 'note'):
                if k in s:
                    v = self.string(pack, c + '.' + k, s[k], ss.get(k), ts.get(k), refs)
                    if v is not None:
                        s[k] = v
            if s['group'] in GROUPS:
                s['gname'] = GROUPS[s['group']][self.li]
            else:
                self.rep.issue(pack, c, 'нет названия группы для «%s»' % s['group'])
            bad = []
            s['svg'] = svg_text(s['svg'], self.lang, bad)
            for b in bad:
                self.rep.issue(pack, c + '.svg', 'кириллица на картинке знака: ' + b)

    # --- practice / categories ---
    def flat(self, obj, source):
        for path, ru in flat_strings(obj, source).items():
            pack = self.packs.flat.get((source, path))
            if pack is None:
                self.rep.total(source + ' (нет в пакетах)', 's')
                self.rep.miss(source + ' (нет в пакетах)', 's', path, 'строки нет в пакетах')
                continue
            src = self.packs.src[pack]
            t = (self.tr.get(pack) or {}).get('strings') or {}
            v = self.string(pack, path, ru, src['strings'].get(path), t.get(path) if isinstance(t, dict) else None,
                            src.get('refs') or {})
            if v is not None:
                _set(obj, path.split('.'), v)


def localize(ru, lang, base=BASE):
    """Данные на языке lang (новая копия) и отчет о непереведенном.
    ru - результат load_ru(); cls, gname добавляются для всех языков."""
    data = json.loads(json.dumps(ru, ensure_ascii=False))
    add_common(data, lang)
    rep = Report(lang)
    if lang == 'ru':
        return data, rep
    packs = Packs(base)
    tr = load_translations(lang, rep, base)
    rep.real = set(packs.src) | {'signs-names'}
    rep.files = {p for p in tr if p in packs.src}
    for p in tr:
        if p not in packs.src:
            rep.warn.append('перевод %s/%s.json: нет такого исходного пакета, пропущен' % (lang, p))
    try:
        names = load(base + '/content/i18n/signs-names.json')
        rep.files.add('signs-names')
    except Exception as e:
        names = {}
        rep.warn.append('content/i18n/signs-names.json не прочитан (%s)' % e)
    L = Localizer(lang, rep, packs, tr)
    for m in data['modules']:
        L.theory(m)
        for q in m['questions']:
            L.question(m, q)
    L.signs(data['signs'], names)
    L.flat(data['practice'], 'practice')
    L.flat(data['categories'], 'categories')
    return data, rep
