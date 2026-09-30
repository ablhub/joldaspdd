"""Проверка и сборка перевода пакета.

Переводчик пишет части в content/i18n/out/<lang>/<pack>/NN.json (любые имена, берутся по алфавиту).
Каждая часть - JSON-объект с любыми из ключей исходного пакета: meta, lesson, keyFacts, mistakes,
questions, signs, strings. Списки склеиваются по порядку частей, объекты объединяются.

Usage: python3 tools/i18n_check.py <kk|en> <pack>
Если ошибок нет, пишет content/i18n/<lang>/<pack>.json и печатает OK.
"""
import json, glob, os, re, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CYR = re.compile('[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]')
KKL = re.compile('[ӘәҒғҚқҢңӨөҰұҮүҺһІі]')
PH = re.compile(r'⟦(\d+)⟧')
NUMRE = re.compile(r'\d+(?:[.,]\d+)?')


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def merge_parts(parts):
    out = {}
    for p in parts:
        for k, v in p.items():
            if isinstance(v, list):
                out.setdefault(k, []).extend(v)
            elif isinstance(v, dict):
                out.setdefault(k, {}).update(v)
            else:
                out[k] = v
    return out


def nums(s):
    return [x.replace(',', '.') for x in NUMRE.findall(PH.sub('', s))]


class Checker:
    def __init__(self, lang):
        self.lang = lang
        self.err = []
        self.warn = []

    def s(self, where, src, tr):
        if not isinstance(tr, str):
            self.err.append('%s: ожидалась строка' % where)
            return
        if not tr.strip() and src.strip():
            self.err.append('%s: пустой перевод' % where)
            return
        if '—' in tr or '–' in tr:
            self.err.append('%s: длинное тире запрещено, используйте дефис "-"' % where)
        a, b = sorted(PH.findall(src)), sorted(PH.findall(tr))
        if a != b:
            self.err.append('%s: метки ⟦n⟧ не совпадают: в оригинале %s, в переводе %s' % (where, a, b))
        missing = [n for n in nums(src) if n not in nums(tr)]
        # числа-слова допустимы в переводе, но все числа оригинала должны остаться
        if missing:
            self.err.append('%s: пропали числа %s' % (where, missing))
        if self.lang == 'en':
            if CYR.search(PH.sub('', tr)):
                self.err.append('%s: кириллица в английском тексте: %r' % (where, tr[:80]))
        else:
            words = len(tr.split())
            if tr == src and len(src) > 14 and CYR.search(src):
                self.err.append('%s: строка не переведена' % where)
            elif words >= 4 and not KKL.search(tr) and CYR.search(tr):
                self.warn.append('%s: нет казахских букв, проверьте перевод: %r' % (where, tr[:80]))
        if len(src) > 40:
            r = len(tr) / max(1, len(src))
            if r < 0.45 or r > 2.3:
                self.warn.append('%s: подозрительная длина (x%.2f)' % (where, r))

    def lst(self, where, src, tr):
        if not isinstance(tr, list) or len(tr) != len(src):
            self.err.append('%s: ожидался список из %d строк' % (where, len(src)))
            return
        for i, (a, b) in enumerate(zip(src, tr)):
            self.s('%s[%d]' % (where, i), a, b)


def check(lang, pack):
    src = load('%s/content/i18n/packs/%s.json' % (BASE, pack))
    files = sorted(glob.glob('%s/content/i18n/out/%s/%s/*.json' % (BASE, lang, pack)))
    if not files:
        print('Нет частей перевода в content/i18n/out/%s/%s/' % (lang, pack))
        return 2
    parts = []
    c = Checker(lang)
    for f in files:
        try:
            parts.append(load(f))
        except Exception as e:
            c.err.append('%s: неверный JSON: %s' % (os.path.basename(f), e))
    if c.err:
        print('\n'.join('ERR ' + e for e in c.err))
        return 1
    tr = merge_parts(parts)
    if 'meta' in src:
        for k in ('title', 'pdd', 'summary'):
            c.s('meta.' + k, src['meta'][k], (tr.get('meta') or {}).get(k))
    if 'lesson' in src:
        tl = tr.get('lesson') or []
        if len(tl) != len(src['lesson']):
            c.err.append('lesson: ожидалось %d разделов, получено %d' % (len(src['lesson']), len(tl)))
        else:
            for i, (a, b) in enumerate(zip(src['lesson'], tl)):
                if set(a.keys()) != set(b.keys()):
                    c.err.append('lesson[%d]: ключи %s вместо %s' % (i, sorted(b.keys()), sorted(a.keys())))
                    continue
                c.s('lesson[%d].h' % i, a['h'], b['h'])
                for k in ('p', 'list'):
                    if k in a:
                        c.lst('lesson[%d].%s' % (i, k), a[k], b[k])
                if 'tip' in a:
                    c.s('lesson[%d].tip' % i, a['tip'], b['tip'])
    for k in ('keyFacts', 'mistakes'):
        if k in src:
            c.lst(k, src[k], tr.get(k))
    if 'questions' in src:
        tq = tr.get('questions') or []
        ids = [q.get('id') for q in tq]
        want = [q['id'] for q in src['questions']]
        if ids != want:
            miss = [x for x in want if x not in ids]
            extra = [x for x in ids if x not in want]
            c.err.append('questions: id не совпадают. нет: %s; лишние: %s; порядок должен быть как в пакете' % (miss[:10], extra[:10]))
        else:
            longest_src = longest_tr = 0
            for a, b in zip(src['questions'], tq):
                w = a['id']
                if b.get('answer') != a['answer']:
                    c.err.append('%s: answer должен остаться %d' % (w, a['answer']))
                c.s(w + '.q', a['q'], b.get('q'))
                c.lst(w + '.options', a['options'], b.get('options'))
                c.s(w + '.explain', a['explain'], b.get('explain'))
                if 'scene' in a:
                    bs = b.get('scene') or {}
                    if set(bs.keys()) != set(a['scene'].keys()):
                        c.err.append('%s.scene: ключи %s вместо %s' % (w, sorted(bs.keys()), sorted(a['scene'].keys())))
                    else:
                        for k, v in a['scene'].items():
                            c.s('%s.scene.%s' % (w, k), v, bs[k])
                elif b.get('scene'):
                    c.err.append('%s.scene: в оригинале нет подписей схемы' % w)
                if 'ref' in a:
                    c.s(w + '.ref', a['ref'], b.get('ref'))
                bo = b.get('options') or []
                if isinstance(bo, list) and len(bo) == len(a['options']):
                    def is_longest(opts, i):
                        L = [len(x) for x in opts]
                        mx = max(L)
                        others = [x for j, x in enumerate(L) if j != i]
                        return L[i] == mx and L[i] > 1.15 * max(others)
                    ls, lt = is_longest(a['options'], a['answer']), is_longest(bo, a['answer'])
                    longest_src += ls
                    longest_tr += lt
                    if lt and not ls:
                        c.warn.append('%s: правильный вариант стал заметно длиннее остальных; выровняйте длину вариантов' % w)
    if 'signs' in src:
        ts = tr.get('signs') or []
        if [x.get('code') for x in ts] != [x['code'] for x in src['signs']]:
            c.err.append('signs: коды не совпадают с пакетом')
        else:
            for a, b in zip(src['signs'], ts):
                c.s(a['code'] + '.meaning', a['meaning'], b.get('meaning'))
                if 'note' in a:
                    c.s(a['code'] + '.note', a['note'], b.get('note'))
    if 'strings' in src:
        ts = tr.get('strings') or {}
        miss = [k for k in src['strings'] if k not in ts]
        if miss:
            c.err.append('strings: нет ключей %s' % miss[:10])
        for k, v in src['strings'].items():
            if k in ts:
                c.s(k, v, ts[k])
    for e in c.err[:60]:
        print('ERR', e)
    if len(c.err) > 60:
        print('... и еще', len(c.err) - 60, 'ошибок')
    for w in c.warn[:40]:
        print('WARN', w)
    if c.err:
        print('ИТОГ: ошибок %d, предупреждений %d. Исправьте ошибки и запустите снова.' % (len(c.err), len(c.warn)))
        return 1
    tr['pack'] = pack
    os.makedirs('%s/content/i18n/%s' % (BASE, lang), exist_ok=True)
    with open('%s/content/i18n/%s/%s.json' % (BASE, lang, pack), 'w', encoding='utf-8') as f:
        json.dump(tr, f, ensure_ascii=False, indent=1)
    print('OK: %s/%s собран (предупреждений %d)' % (lang, pack, len(c.warn)))
    return 0


if __name__ == '__main__':
    sys.exit(check(sys.argv[1], sys.argv[2]))
