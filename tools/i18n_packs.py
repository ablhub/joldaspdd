"""Готовит пакеты для переводчиков: content/i18n/packs/<pack>.json

Скобочные ссылки на нормы заменяются метками ⟦n⟧ (перевод ссылок делает сборка),
поле ref переводится автоматически, если распознано (иначе попадает в пакет).
Usage: python3 tools/i18n_packs.py [--max 42000]
"""
import json, glob, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from i18n_refs import conv, INLINE

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = BASE + '/content/i18n/packs'
CYR = re.compile('[А-Яа-яЁё]')
MAXC = 42000
if '--max' in sys.argv:
    MAXC = int(sys.argv[sys.argv.index('--max') + 1])


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def modules():
    mods = {}
    for f in sorted(glob.glob(BASE + '/content/m*.json')):
        m = load(f)
        mods[m['id']] = m
    for f in sorted(glob.glob(BASE + '/content/extra/m*-*.json')):
        d = load(f)
        mods[d['module']]['questions'] += d['questions']
    return [mods[k] for k in sorted(mods, key=lambda k: mods[k]['order'])]


class Ph:
    """Замена скобочных ссылок на ⟦n⟧ в пределах пакета."""
    def __init__(self):
        self.map = {}

    def sub(self, s):
        def rep(m):
            ref = m.group(0)
            if conv(ref[1:-1], 'kk') is None or conv(ref[1:-1], 'en') is None:
                return ref  # свободный текст: переводит переводчик
            n = str(len(self.map) + 1)
            self.map[n] = ref
            return '⟦' + n + '⟧'
        return INLINE.sub(rep, s)


# строки схем, которые переводит переводчик (остальное сборка переводит сама)
SCENE_TEXT = [('labels', 'text'), ('side', 'text'), ('items', 'label')]


def scene_strings(sc):
    out = {}
    for arr, key in SCENE_TEXT:
        for i, it in enumerate(sc.get(arr) or []):
            if isinstance(it, dict) and isinstance(it.get(key), str) and CYR.search(it[key]):
                out['%s.%d.%s' % (arr, i, key)] = it[key]
    return out


def qpack(q, ph):
    o = {'id': q['id'], 'q': ph.sub(q['q']), 'options': [ph.sub(x) for x in q['options']], 'answer': q['answer'], 'explain': ph.sub(q['explain'])}
    if q.get('scene'):
        ss = scene_strings(q['scene'])
        if ss:
            o['scene'] = ss
    if conv(q['ref'], 'kk') is None or conv(q['ref'], 'en') is None:
        o['ref'] = q['ref']
    return o


def size(o):
    return len(json.dumps(o, ensure_ascii=False))


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(OUT + '/*.json'):
        os.remove(f)
    index = []
    for m in modules():
        # пакет теории: meta + lesson + keyFacts + mistakes
        ph = Ph()
        theory = {
            'pack': m['id'] + '-t', 'module': m['id'], 'kind': 'theory',
            'meta': {'title': m['title'], 'pdd': m['pdd'], 'summary': ph.sub(m['summary'])},
            'lesson': [], 'keyFacts': [ph.sub(x) for x in m['keyFacts']], 'mistakes': [ph.sub(x) for x in m['mistakes']],
        }
        for s in m['lesson']:
            o = {'h': ph.sub(s.get('h', ''))}
            if s.get('p'):
                o['p'] = [ph.sub(x) for x in s['p']]
            if s.get('list'):
                o['list'] = [ph.sub(x) for x in s['list']]
            if s.get('tip'):
                o['tip'] = ph.sub(s['tip'])
            theory['lesson'].append(o)
        # балансированная нарезка: теория + вопросы, куски около MAXC символов
        units = [('t', theory)] + [('q', q) for q in m['questions']]
        tmp = Ph()
        sizes = [size(theory)] + [size(qpack(q, tmp)) for q in m['questions']]
        total = sum(sizes)
        n = max(1, -(-total // MAXC))
        target = total / n
        packs, cur, acc, part = [], [], 0, 1
        groups = []
        for u, sz in zip(units, sizes):
            if cur and acc + sz / 2 > target and len(groups) < n - 1:
                groups.append(cur)
                cur, acc = [], 0
            cur.append(u)
            acc += sz
        if cur:
            groups.append(cur)
        for gi, g in enumerate(groups):
            ph = Ph()
            p = {'pack': '%s-%d' % (m['id'], gi + 1), 'module': m['id']}
            for kind, u in g:
                if kind == 't':
                    # пересобрать теорию с метками этого пакета
                    th = {'meta': {'title': m['title'], 'pdd': m['pdd'], 'summary': ph.sub(m['summary'])},
                          'lesson': [], 'keyFacts': [ph.sub(x) for x in m['keyFacts']], 'mistakes': [ph.sub(x) for x in m['mistakes']]}
                    for s0 in m['lesson']:
                        o = {'h': ph.sub(s0.get('h', ''))}
                        if s0.get('p'):
                            o['p'] = [ph.sub(x) for x in s0['p']]
                        if s0.get('list'):
                            o['list'] = [ph.sub(x) for x in s0['list']]
                        if s0.get('tip'):
                            o['tip'] = ph.sub(s0['tip'])
                        th['lesson'].append(o)
                    p.update(th)
                else:
                    p.setdefault('questions', []).append(qpack(u, ph))
            p['refs'] = ph.map
            packs.append(p)
        for p in packs:
            with open('%s/%s.json' % (OUT, p['pack']), 'w', encoding='utf-8') as f:
                json.dump(p, f, ensure_ascii=False, indent=1)
            index.append((p['pack'], size(p), len(p.get('questions', []))))
    # знаки: meaning + note (названия берутся из signs-names.json)
    signs = load(BASE + '/content/signs.json')
    codes = {s['code'] for s in signs}
    for s in load(BASE + '/content/extra/signs-extra.json'):
        if s['code'] not in codes:
            signs.append(s)
            codes.add(s['code'])
    ph = Ph()
    sp = {'pack': 'signs', 'kind': 'signs', 'signs': []}
    for s in signs:
        o = {'code': s['code'], 'name_ru': s['name'], 'meaning': ph.sub(s['meaning'])}
        if s.get('note'):
            o['note'] = ph.sub(s['note'])
        sp['signs'].append(o)
    sp['refs'] = ph.map
    # практика и категории: плоский список строк по путям
    for name in ('practice', 'categories'):
        d = load(BASE + '/content/%s.json' % name)
        flat = {}
        skip = {'id', 'code', 'url', 'cats', 'updated', 'group'}

        def walk(o, path):
            if isinstance(o, dict):
                for k, v in o.items():
                    if k in skip and not (name == 'practice' and k == 'group'):
                        continue
                    walk(v, path + [k])
            elif isinstance(o, list):
                for i, v in enumerate(o):
                    walk(v, path + [str(i)])
            elif isinstance(o, str) and CYR.search(o):
                flat['.'.join(path)] = o
        walk(d, [])
        ph = Ph()
        flat = {k: ph.sub(v) for k, v in flat.items()}
        # делим на два пакета, если большой
        items = list(flat.items())
        chunks, cur, acc = [], [], 0
        for k, v in items:
            if cur and acc + len(v) > MAXC:
                chunks.append(cur)
                cur, acc = [], 0
            cur.append((k, v))
            acc += len(v) + len(k)
        if cur:
            chunks.append(cur)
        for i, c in enumerate(chunks):
            used = set(re.findall(r'⟦(\d+)⟧', json.dumps(dict(c), ensure_ascii=False)))
            p = {'pack': '%s-%d' % (name, i + 1), 'kind': 'flat', 'source': name, 'strings': dict(c), 'refs': {k: v for k, v in ph.map.items() if k in used}}
            with open('%s/%s.json' % (OUT, p['pack']), 'w', encoding='utf-8') as f:
                json.dump(p, f, ensure_ascii=False, indent=1)
            index.append((p['pack'], size(p), 0))
    with open(OUT + '/signs.json', 'w', encoding='utf-8') as f:
        json.dump(sp, f, ensure_ascii=False, indent=1)
    index.append(('signs', size(sp), 0))
    with open(OUT + '/_index.json', 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=0)
    tot = sum(x[1] for x in index)
    print('packs', len(index), 'total chars', tot)
    for p, s, n in index:
        print('%-14s %7d %4s' % (p, s, n or ''))


if __name__ == '__main__':
    main()
