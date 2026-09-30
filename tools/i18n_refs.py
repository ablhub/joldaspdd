"""Перевод ссылок на нормы (поле ref и скобочные ссылки в тексте) на казахский и английский.

conv(ref, lang) -> строка или None, если в ссылке есть свободный текст, который нельзя
перевести по шаблону (тогда ссылку переводит переводчик вместе с текстом).
"""
import os
import re

NUM = r'\d+(?:\.\d+)*(?:-\d+(?:\.\d+)*)?'

# фиксированные фразы (целый сегмент между ';')
PHRASES = {
    'Техника вождения (вне текста ПДД)': ('Жүргізу техникасы (ЖЖҚ мәтінінен тыс)', 'Driving technique (outside the Rules)'),
    'Техника вождения': ('Жүргізу техникасы', 'Driving technique'),
    'Расчет ориентировочный (вне текста ПДД)': ('Шамамен есеп (ЖЖҚ мәтінінен тыс)', 'Approximate calculation (outside the Rules)'),
    'Методика практического экзамена на автодроме, категория A': ('Автодромдағы практикалық емтихан әдістемесі, A санаты', 'Test-ground practical exam method, category A'),
    'Руководство для мотоциклистов штата Нью-Йорк (вне ПДД)': ('Нью-Йорк штатының мотоциклшілерге арналған нұсқаулығы (ЖЖҚ мәтінінен тыс)', 'New York State Motorcycle Manual (outside the Rules)'),
    'Перечень неисправностей': ('Ақаулар тізбесі', 'List of Defects'),
    'Основные положения': ('Негізгі ережелер', 'Basic Provisions'),
    'Закон «О дорожном движении»': ('«Жол жүрісі туралы» Заң', 'Road Traffic Act'),
    'ПДД РК': ('ЖЖҚ', 'the Rules'),
}

# документы-префиксы "<док>, <ссылки>"
DOCS = [
    ('Основные положения по допуску ТС к эксплуатации', 'Көлік құралдарын пайдалануға рұқсат беру жөніндегі негізгі ережелер', 'Basic Provisions on Admitting Vehicles'),
    ('Основные положения по допуску ТС', 'Көлік құралдарын пайдалануға рұқсат беру жөніндегі негізгі ережелер', 'Basic Provisions on Admitting Vehicles'),
    ('Основные положения', 'Негізгі ережелер', 'Basic Provisions'),
    ('Правила приема экзаменов и выдачи водительских удостоверений', 'Емтихан қабылдау және жүргізуші куәліктерін беру қағидалары', 'Rules for Examinations and Issuing Driving Licences'),
    ('Правила организации труда и отдыха водителей и применения тахографов', 'Жүргізушілердің еңбек және демалыс режимін ұйымдастыру және тахографтарды қолдану қағидалары', 'Drivers\' Working and Rest Time and Tachograph Rules'),
    ('Стандарт первой помощи РК', 'ҚР алғашқы көмек көрсету стандарты', 'Kazakhstan First Aid Standard'),
    ('Правила первой помощи РК', 'ҚР алғашқы көмек көрсету қағидалары', 'Kazakhstan First Aid Rules'),
    ('Перечень неисправностей', 'Ақаулар тізбесі', 'List of Defects'),
    ('Правила приема экзаменов', 'Емтихан қабылдау қағидалары', 'Examination Rules'),
    ('Правил приема экзаменов', 'Емтихан қабылдау қағидалары', 'Examination Rules'),
    ('Правила организации труда и отдыха водителей', 'Жүргізушілердің еңбек және демалыс режимін ұйымдастыру қағидалары', 'Drivers\' Working and Rest Time Rules'),
    ('Правил организации труда и отдыха водителей', 'Жүргізушілердің еңбек және демалыс режимін ұйымдастыру қағидалары', 'Drivers\' Working and Rest Time Rules'),
    ('Закон «О дорожном движении»', '«Жол жүрісі туралы» Заң', 'Road Traffic Act'),
    ('ПДД РК', 'ЖЖҚ', 'Rules'),
]
PAREN = {
    '(зона действия)': ('(қолданылу аймағы)', '(zone of application)'),
    '(исключения)': ('(ерекшеліктер)', '(exceptions)'),
    '(вне текста ПДД)': ('(ЖЖҚ мәтінінен тыс)', '(outside the Rules)'),
}
FOREIGN = re.compile(r'^(?:RC UK|ERC|ANZCOR|ERC/RC UK|AHA|MedlinePlus|American Red Cross)(?: \d{4}| \d+(?:\.\d+)*)?(?:, (?:RC UK|ERC)(?: \d{4})?)*$')


def _nums(s):
    """'44, 45' / '44-46' / '9 и 10' -> ['44', '45']"""
    parts = re.split(r',\s*|\s+и\s+', s.strip())
    for p in parts:
        if not re.fullmatch(NUM, p):
            return None
    return parts


def _kk_list(nums, suf):
    return ', '.join(nums) + suf


def _en_list(nums, one, many):
    return (one if len(nums) == 1 and '-' not in nums[0] else many) + ' ' + ', '.join(nums)


def _points(s, lang):
    """'п. 2 пп. 9 и 10' или 'п. 44, 45' или 'пп. 3' -> перевод или None"""
    m = re.fullmatch(r'п\. (' + NUM + r'(?:(?:,\s*| и )' + NUM + r')*)(?:,? пп\. (' + NUM + r'(?:(?:,\s*| и )' + NUM + r')*))?', s)
    if m:
        ps = _nums(m.group(1))
        sub = _nums(m.group(2)) if m.group(2) else None
        if ps is None or (m.group(2) and sub is None):
            return None
        if sub and len(ps) != 1:
            return None
        if lang == 'kk':
            out = _kk_list(ps, '-т.')
            if sub:
                out += ' ' + _kk_list(sub, '-тт.')
            return out
        if sub:
            return 'para. ' + ps[0] + ', '.join('(' + x + ')' for x in sub).replace(')(', '), (')
        return _en_list(ps, 'para.', 'paras.')
    m = re.fullmatch(r'пп\. (' + NUM + r'(?:(?:,\s*| и )' + NUM + r')*)', s)
    if m:
        sub = _nums(m.group(1))
        if sub is None:
            return None
        return _kk_list(sub, '-тт.') if lang == 'kk' else _en_list(sub, 'subpara.', 'subparas.')
    return None


def _annex(s, lang):
    """'Прил. 1, знак 2.4, табличка 7.1.1' / 'Прил. 2, разметка 1.1, 1.3' / 'Прил. 1, глава 3 (зона действия)'"""
    m = re.fullmatch(r'Прил\. (\d)(.*)', s)
    if not m:
        return None
    n, rest = m.group(1), m.group(2)
    out = ['%s-қосымша' % n if lang == 'kk' else 'Annex %s' % n]
    words = {
        'знак': ('белгісі', 'белгілері', 'sign', 'signs'),
        'знаки': ('белгісі', 'белгілері', 'sign', 'signs'),
        'разметка': ('таңба', 'таңбалар', 'marking', 'markings'),
        'разметки': ('таңба', 'таңбалар', 'marking', 'markings'),
        'табличка': ('тақтайша', 'тақтайшалар', 'plate', 'plates'),
        'таблички': ('тақтайша', 'тақтайшалар', 'plate', 'plates'),
    }
    rest = rest.strip()
    while rest:
        if not rest.startswith(','):
            # хвост вида ' (зона действия)' или ' и общие положения главы 3'
            t = rest.strip()
            if t in PAREN:
                out[-1] += ' ' + PAREN[t][0 if lang == 'kk' else 1]
                break
            m2 = re.fullmatch(r'и общие положения главы (\d+)', t)
            if m2:
                out.append(('%s-тараудың жалпы ережелері' % m2.group(1)) if lang == 'kk' else ('general provisions of Chapter %s' % m2.group(1)))
                break
            return None
        rest = rest[1:].strip()
        m2 = re.match(r'(знаки|знак|разметки|разметка|таблички|табличка) (' + NUM + r'(?:,\s*' + NUM + r')*)(?=,|$| \()', rest)
        if m2:
            w = words[m2.group(1)]
            nums = [x for x in re.split(r',\s*', m2.group(2))]
            many = len(nums) > 1 or '-' in m2.group(2)
            if lang == 'kk':
                out.append(', '.join(nums) + ' ' + (w[1] if many else w[0]))
            else:
                out.append((w[3] if many else w[2]) + ' ' + ', '.join(nums))
            rest = rest[m2.end():]
            continue
        m2 = re.match(r'глава (\d+)', rest)
        if m2:
            out.append(('%s-тарау' % m2.group(1)) if lang == 'kk' else ('Chapter %s' % m2.group(1)))
            rest = rest[m2.end():]
            continue
        return None
    return ', '.join(out)


PARTS = r'\d+(?:-\d+)?(?:,\s*\d+(?:-\d+)?)*'


def _koap(s, lang, default_doc=None):
    s = s.strip()
    m = re.fullmatch(r'КоАП ст\. (\d+(?:,\s*\d+)*)(?: ч\. (' + PARTS + r'))?', s)
    if m:
        arts, parts, doc, pt = m.group(1), m.group(2), 'КоАП', None
    else:
        m = re.fullmatch(r'ст\. (\d+(?:,\s*\d+)*)(?: ч\. (' + PARTS + r'))?(?: (КоАП РК|КоАП|Закона|Закона «О дорожном движении»))?(?: п\. (\d+))?', s)
        if not m:
            return None
        arts, parts, doc, pt = m.group(1), m.group(2), m.group(3), m.group(4)
    if doc is None:
        doc = default_doc
    if doc is None:
        return None
    arts = re.split(r',\s*', arts)
    if parts and len(arts) > 1:
        return None
    pl = re.split(r',\s*', parts) if parts else []
    if doc.startswith('КоАП'):
        if pt:
            return None
        if lang == 'kk':
            return 'ӘҚБтК ' + ', '.join(arts) + '-бап' + (', ' + ', '.join(pl) + '-бөлік' if pl else '')
        return 'CAO ' + ('art. ' if len(arts) == 1 else 'arts. ') + ', '.join(arts) + (', '.join('(' + x + ')' for x in pl) if pl else '')
    if pl:
        return None
    if lang == 'kk':
        return '«Жол жүрісі туралы» Заң, ' + ', '.join(arts) + '-бап' + (', ' + pt + '-т.' if pt else '')
    return 'Road Traffic Act, ' + ('art. ' if len(arts) == 1 else 'arts. ') + ', '.join(arts) + ('(' + pt + ')' if pt else '')


def _single(seg, lang):
    """'знак 2.5' / 'табличка 7.4.1' / 'разметка 1.1' без 'Прил.'"""
    m = re.fullmatch(r'(знаки|знак|разметки|разметка|таблички|табличка) (' + NUM + r'(?:,\s*' + NUM + r')*)', seg)
    if not m:
        return None
    r = _annex('Прил. 1, ' + seg, lang)
    if r is None:
        return None
    return r.split(', ', 1)[1]


def _foreign_doc(seg, lang):
    m = re.fullmatch(r'Highway Code UK, (.*)', seg)
    if not m:
        return None
    out = []
    for part in re.split(r',\s*(?=п\.|прил\.)', m.group(1)):
        m2 = re.fullmatch(r'п\. (\d+)', part)
        if m2:
            out.append(('%s-ереже' % m2.group(1)) if lang == 'kk' else ('rule %s' % m2.group(1)))
            continue
        m2 = re.fullmatch(r'п\. (\d+) \(рекомендация\)', part)
        if m2:
            out.append(('%s-ереже (ұсыным)' % m2.group(1)) if lang == 'kk' else ('rule %s (advice)' % m2.group(1)))
            continue
        m2 = re.fullmatch(r'прил\. (\d+)', part)
        if m2:
            out.append(('%s-қосымша' % m2.group(1)) if lang == 'kk' else ('Annex %s' % m2.group(1)))
            continue
        return None
    return 'Highway Code UK, ' + ', '.join(out)


def _segment(seg, lang, default_doc=None):
    seg = seg.strip()
    seg = re.sub(r'^Приложение (\d)', r'Прил. \1', seg)
    m = re.fullmatch(r'Закон «О дорожном движении» (ст\. .*)', seg)
    if m:
        seg = 'Закон «О дорожном движении», ' + m.group(1)
    if not seg:
        return None
    li = 0 if lang == 'kk' else 1
    if seg in PHRASES:
        return PHRASES[seg][li]
    if FOREIGN.fullmatch(seg):
        return seg
    # "п. 44 ПДД РК" / "п. 5 Правил"
    m = re.fullmatch(r'(.*?) (ПДД РК|Правил)', seg)
    if m and (m.group(1).startswith('п.') or m.group(1).startswith('пп.')):
        r = _points(m.group(1), lang)
        if r is None:
            return None
        return ('ЖЖҚ ' + r) if lang == 'kk' else (r + ' of the Rules')
    # "п. N Правил приема экзаменов" / "п. N Правил организации..."
    m = re.fullmatch(r'(п\. .*?) (Правил приема экзаменов|Правил организации труда и отдыха водителей)', seg)
    if m:
        r = _points(m.group(1), lang)
        if r is None:
            return None
        for ru, kk, en in DOCS:
            if ru == m.group(2):
                return (kk + ', ' + r) if lang == 'kk' else (en + ', ' + r)
    # "<док>, <ссылки>"
    for ru, kk, en in DOCS:
        if seg.startswith(ru + ', '):
            rest = seg[len(ru) + 2:]
            r = _points(rest, lang) or _koap(rest, lang)
            if r is None:
                # "Закон «О дорожном движении», ст. 73 п. 2"
                m = re.fullmatch(r'ст\. (\d+(?:,\s*\d+)*)(?: п\. (\d+))?', rest)
                if m and ru.startswith('Закон'):
                    art, pt = m.group(1), m.group(2)
                    if lang == 'kk':
                        return kk + ', ' + art + '-бап' + (', ' + pt + '-т.' if pt else '')
                    return en + ', art. ' + art + ('(' + pt + ')' if pt else '')
                return None
            return (kk if lang == 'kk' else en) + ', ' + r
    r = _points(seg, lang)
    if r is not None:
        return r
    # "п. 44, п. 45" / "п. 44, п. 45 пп. 3"
    if re.fullmatch(r'п\. .*(?:, п\. .*)+', seg):
        parts = re.split(r',\s*(?=п\. )', seg)
        rs = [_points(p, lang) for p in parts]
        if all(rs):
            return ', '.join(rs) if lang == 'kk' else '; '.join(rs)
        return None
    r = _annex(seg, lang)
    if r is not None:
        return r
    r = _koap(seg, lang, default_doc)
    if r is not None:
        return r
    r = _single(seg, lang)
    if r is not None:
        return r
    r = _foreign_doc(seg, lang)
    if r is not None:
        return r
    return None


def conv(ref, lang):
    """Перевод всей ссылки (сегменты через ';'). None, если что-то не распознано."""
    if lang == 'ru':
        return ref
    segs = ref.split(';')
    default_doc = 'КоАП' if re.search(r'КоАП( РК)?\s*$', segs[-1]) else None
    out = []
    for s in segs:
        r = _segment(s, lang, default_doc)
        if r is None:
            return None
        out.append(r)
    return '; '.join(out)


INLINE = re.compile(r'\((?:п\.|пп\.|Прил\.|ст\.|Перечень|ПДД|Закон|ERC|RC UK)[^()]{0,70}\)')


def conv_inline(paren, lang):
    """'(п. 44)' -> '(44-т.)' или None"""
    r = conv(paren[1:-1], lang)
    return None if r is None else '(' + r + ')'


if __name__ == '__main__':
    import json, glob, collections, sys
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    qs = []
    texts = []
    for f in sorted(glob.glob(base + '/content/m*.json')):
        m = json.load(open(f))
        qs += m['questions']
    for f in sorted(glob.glob(base + '/content/extra/m*-*.json')):
        qs += json.load(open(f))['questions']
    refs = collections.Counter(q['ref'] for q in qs)
    bad = collections.Counter()
    for r, c in refs.items():
        for lang in ('kk', 'en'):
            if conv(r, lang) is None:
                bad[r] += c
                break
    print('ref field: distinct', len(refs), 'unconverted distinct', len(bad), 'questions', sum(bad.values()))
    for r, c in bad.most_common(80):
        print(' ', c, r)
    for r in list(refs)[:25]:
        print(r, ' => ', conv(r, 'kk'), ' | ', conv(r, 'en'))
