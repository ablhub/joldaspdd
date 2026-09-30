"""Перевод строк интерфейса (src/app.js, src/scene.js) при сборке kk/en.

Русские строковые литералы остаются в коде. При сборке kk/en build.py вызывает
translate_js(code, lang, strict): каждый литерал с кириллицей заменяется переводом
из src/i18n/<lang>.json ({"русский литерал": "перевод"}). Ключи объектов с кириллицей
(например ключи GLABEL) не переводятся. Фразы с числами и именами в коде записаны
шаблонами tpl('Вопрос {i} из {n}', {...}): переводится сам шаблон, {i} и {n} остаются.

Usage:
  python3 tools/i18n_ui.py extract          пишет src/i18n/ui-ru.json - задание переводчикам
  python3 tools/i18n_ui.py check <kk|en>    проверяет словарь src/i18n/<lang>.json
  python3 tools/i18n_ui.py pseudo           пишет src/i18n/_pseudo.json ([строка]) и проверяет
                                            translate_js на склеенном коде (node --check)

src/i18n/ui-ru.json - список {"ru": строка, "ctx": ["app.js:NNN: фрагмент кода"], ...}:
  "plural": ["1" | "2-4" | "5+"] - строка стоит в plural(n, a, b, c) как форма для чисел 1, 2-4 или 5+;
      kk всегда берет форму "1" (после числа - единственное число), en - "1" для n = 1 и "5+" иначе;
  "keep": true - буква-символ в разметке (например «А» на полосе для автобусов), перевод = оригинал.
Словарь src/i18n/<lang>.json: {"строка из ui-ru.json": "перевод", ...}. Плейсхолдеры {name},
HTML-теги и атрибуты (кроме текста aria-label/title/placeholder/alt), прямые кавычки " и пробелы
по краям строки сохраняются; длинное тире запрещено.
"""
import json, os, re, subprocess, sys, tempfile
from collections import Counter

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'src')
I18N = os.path.join(SRC, 'i18n')
FILES = ['app.js', 'scene.js', 'anim.js']          # порядок в ui-ru.json
BUILD_ORDER = ['scene.js', 'anim.js', 'app.js']    # порядок склейки в build.py

CYR = re.compile('[\u0400-\u04ff]')
DASHES = ('\u2014', '\u2013')   # длинное и среднее тире
PH = re.compile(r'\{(\w+)\}')
TEXT_ATTRS = ('aria-label', 'title', 'placeholder', 'alt')

# ---------------------------------------------------------------- токенизатор JS

class JSSyntaxError(ValueError):
    pass


class Tok:
    __slots__ = ('kind', 'start', 'end', 'text', 'value', 'quote')

    def __init__(self, kind, start, end, text, value=None, quote=None):
        self.kind, self.start, self.end, self.text, self.value, self.quote = kind, start, end, text, value, quote

    def __repr__(self):
        return 'Tok(%s,%d,%r)' % (self.kind, self.start, self.text[:40])


REGEX_AFTER_WORDS = {'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
                     'throw', 'case', 'do', 'else', 'yield', 'await'}
PUNCT3 = ('>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=')
PUNCT2 = ('=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=',
          '%=', '&=', '|=', '^=', '<<', '>>', '**')
NUM_RE = re.compile(r'0[xX][0-9a-fA-F_]+n?|0[bB][01_]+n?|0[oO][0-7_]+n?|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?n?')
IDENT_RE = re.compile(r'[A-Za-z_$\u00a0-\uffff][\w$\u00a0-\uffff]*')

_ESC = {'n': '\n', 't': '\t', 'r': '\r', 'b': '\b', 'f': '\f', 'v': '\v'}


def decode_js(raw):
    """Содержимое строкового литерала без кавычек -> значение строки."""
    out, i, n = [], 0, len(raw)
    while i < n:
        c = raw[i]
        if c != '\\':
            out.append(c)
            i += 1
            continue
        d = raw[i + 1] if i + 1 < n else ''
        if d in _ESC:
            out.append(_ESC[d]); i += 2
        elif d == '0' and not raw[i + 2:i + 3].isdigit():
            out.append('\0'); i += 2
        elif d == 'x':
            out.append(chr(int(raw[i + 2:i + 4], 16))); i += 4
        elif d == 'u':
            if raw[i + 2:i + 3] == '{':
                k = raw.index('}', i)
                out.append(chr(int(raw[i + 3:k], 16))); i = k + 1
            else:
                out.append(chr(int(raw[i + 2:i + 6], 16))); i += 6
        elif d == '\r':
            i += 3 if raw[i + 2:i + 3] == '\n' else 2       # продолжение строки
        elif d in ('\n', '\u2028', '\u2029'):
            i += 2
        else:
            out.append(d); i += 2
    s = ''.join(out)
    try:
        return s.encode('utf-16', 'surrogatepass').decode('utf-16')   # суррогатные пары: \uD83D\uDE00 -> один символ
    except UnicodeError:
        return s


def encode_js(s, quote):
    """Значение -> строковый литерал с той же кавычкой; безопасно для вставки в <script>."""
    out = []
    for ch in s:
        if ch == '\\':
            out.append('\\\\')
        elif ch == quote:
            out.append('\\' + quote)
        elif ch == '\n':
            out.append('\\n')
        elif ch == '\r':
            out.append('\\r')
        elif ch == '\u2028':
            out.append('\\u2028')
        elif ch == '\u2029':
            out.append('\\u2029')
        else:
            out.append(ch)
    r = ''.join(out)
    r = re.sub(r'(?i)</(script)', r'<\\/\1', r).replace('<!--', '<\\!--')
    return quote + r + quote


def tokenize(code):
    """Значимые токены JS (без пробелов и комментариев): str, tpl, regex, num, name, punct.
    Регулярное выражение отличается от деления по предыдущему значимому токену."""
    toks = []
    i, n = 0, len(code)
    braces = []   # '{' - обычная скобка, '${' - выражение внутри шаблонной строки

    def regex_allowed():
        if not toks:
            return True
        t = toks[-1]
        if t.kind == 'punct':
            return t.text not in (')', ']', '++', '--')
        if t.kind == 'name':
            return t.text in REGEX_AFTER_WORDS
        return False

    def scan_template(j):
        """j - позиция после ` или после } закрывающей ${...}; вернуть (конец, открыто ли ${)."""
        while j < n:
            c = code[j]
            if c == '\\':
                j += 2
            elif c == '`':
                return j + 1, False
            elif c == '$' and code[j + 1:j + 2] == '{':
                return j + 2, True
            else:
                j += 1
        raise JSSyntaxError('незакрытая шаблонная строка')

    while i < n:
        c = code[i]
        if c in ' \t\r\n\ufeff\u00a0\u2028\u2029':
            i += 1
            continue
        if c == '/' and code[i + 1:i + 2] == '/':
            j = code.find('\n', i)
            i = n if j < 0 else j
            continue
        if c == '/' and code[i + 1:i + 2] == '*':
            j = code.find('*/', i + 2)
            if j < 0:
                raise JSSyntaxError('незакрытый комментарий в позиции %d' % i)
            i = j + 2
            continue
        if c in '\'"':
            j = i + 1
            while True:
                if j >= n:
                    raise JSSyntaxError('незакрытая строка в позиции %d' % i)
                d = code[j]
                if d == '\\':
                    j += 3 if code[j + 1:j + 3] == '\r\n' else 2
                elif d == c:
                    break
                elif d == '\n':
                    raise JSSyntaxError('перевод строки внутри строки в позиции %d' % i)
                else:
                    j += 1
            raw = code[i + 1:j]
            toks.append(Tok('str', i, j + 1, code[i:j + 1], decode_js(raw), c))
            i = j + 1
            continue
        if c == '`':
            j, opened = scan_template(i + 1)
            toks.append(Tok('tpl', i, j, code[i:j]))
            if opened:
                braces.append('${')
            i = j
            continue
        if c == '}' and braces and braces[-1] == '${':
            braces.pop()
            j, opened = scan_template(i + 1)
            toks.append(Tok('tpl', i, j, code[i:j]))
            if opened:
                braces.append('${')
            i = j
            continue
        if c == '/' and regex_allowed():
            j, in_class = i + 1, False
            while True:
                if j >= n or code[j] == '\n':
                    raise JSSyntaxError('незакрытое регулярное выражение в позиции %d' % i)
                d = code[j]
                if d == '\\':
                    j += 2
                    continue
                if d == '[':
                    in_class = True
                elif d == ']':
                    in_class = False
                elif d == '/' and not in_class:
                    break
                j += 1
            j += 1
            while j < n and (code[j].isalnum() or code[j] in '_$'):
                j += 1
            toks.append(Tok('regex', i, j, code[i:j]))
            i = j
            continue
        if c.isdigit() or (c == '.' and code[i + 1:i + 2].isdigit()):
            m = NUM_RE.match(code, i)
            toks.append(Tok('num', i, m.end(), m.group()))
            i = m.end()
            continue
        m = IDENT_RE.match(code, i)
        if m:
            toks.append(Tok('name', i, m.end(), m.group()))
            i = m.end()
            continue
        for p in PUNCT3 + PUNCT2:
            if code.startswith(p, i):
                break
        else:
            p = c
        if p == '{':
            braces.append('{')
        elif p == '}' and braces:
            braces.pop()
        toks.append(Tok('punct', i, i + len(p), p))
        i += len(p)
    if braces:
        raise JSSyntaxError('незакрытые фигурные скобки: %d' % len(braces))
    return toks


def is_key(toks, k):
    """Литерал - ключ объекта: перед ним '{' или ',', после него ':'."""
    return (k > 0 and toks[k - 1].kind == 'punct' and toks[k - 1].text in ('{', ',')
            and k + 1 < len(toks) and toks[k + 1].kind == 'punct' and toks[k + 1].text == ':')


def literals(code):
    """Литералы с кириллицей, которые нужно переводить: список токенов str.
    Возвращает (переводимые, ключи объектов, шаблонные строки с кириллицей)."""
    toks = tokenize(code)
    out, keys, tpls = [], [], []
    for k, t in enumerate(toks):
        if t.kind == 'str' and CYR.search(t.value):
            (keys if is_key(toks, k) else out).append(t)
        elif t.kind == 'tpl' and CYR.search(t.text):
            tpls.append(t)
    return out, keys, tpls


def is_keep(s):
    """Разметка с одиночной буквой-символом (например '>А</text>' - буква «А» на полосе для
    автобусов): переводится сама в себя. Кириллица в строке - ровно одна заглавная буква, не
    часть слова. Предлоги вроде ' и ', ' с ' и текст в aria-label/title переводятся."""
    cyr = CYR.findall(s)
    if len(cyr) != 1 or not cyr[0].isupper():
        return False
    i = s.index(cyr[0])
    return not (s[i - 1:i].isalpha() or s[i + 1:i + 2].isalpha())


# ---------------------------------------------------------------- проверки перевода

def skeleton(s):
    """Разметка строки: теги (значения текстовых атрибутов заменены на *), а вне тегов -
    кавычки, угловые скобки и имена атрибутов 'name='. Сравнивается как мультимножество."""
    items = []

    def tag(m):
        t = m.group(0)
        t = re.sub(r'\b(%s)\s*=\s*"[^"]*"' % '|'.join(TEXT_ATTRS), r'\1="*"', t)
        t = re.sub(r"\b(%s)\s*=\s*'[^']*'" % '|'.join(TEXT_ATTRS), r"\1='*'", t)
        items.append('tag ' + t)
        return ' '
    rest = re.sub(r'<[^<>]*>', tag, s)
    for m in re.finditer(r'[A-Za-z][\w:-]*(?==)|["<>]', rest):
        items.append(m.group(0))
    return Counter(items)


def problems(ru, tr, lang):
    """Ошибки перевода одной строки (список), предупреждения (список)."""
    err, warn = [], []
    if not isinstance(tr, str):
        return ['перевод должен быть строкой'], warn
    if any(d in tr for d in DASHES):
        err.append('длинное тире запрещено, используйте дефис "-"')
    a, b = set(PH.findall(ru)), set(PH.findall(tr))
    if a != b:
        err.append('плейсхолдеры не совпадают: в оригинале %s, в переводе %s' % (sorted(a), sorted(b)))
    sa, sb = skeleton(ru), skeleton(tr)
    if sa != sb:
        miss, extra = sa - sb, sb - sa
        err.append('разметка не совпадает:%s%s' % (
            (' нет в переводе %s' % sorted(miss.elements())) if miss else '',
            (' лишнее в переводе %s' % sorted(extra.elements())) if extra else ''))
    keep = is_keep(ru)
    if keep and tr != ru:
        warn.append('keep: ожидается перевод в себя')
    if lang == 'en' and not keep and CYR.search(tr):
        err.append('кириллица в английском переводе')
    if not tr.strip() and ru.strip():
        warn.append('пустой перевод')
    if (ru[:1].isspace(), ru[-1:].isspace()) != (tr[:1].isspace(), tr[-1:].isspace()):
        warn.append('пробелы в начале или в конце отличаются от оригинала (строка склеивается с соседними)')
    if lang == 'kk' and not keep and tr == ru and len(CYR.findall(ru)) > 12:
        warn.append('перевод совпадает с оригиналом')
    return err, warn


# ---------------------------------------------------------------- перевод при сборке

def dict_path(lang):
    return os.path.join(I18N, lang + '.json')


def load_table(lang):
    p = dict_path(lang)
    if not os.path.exists(p):
        return None
    with open(p, encoding='utf-8') as f:
        d = json.load(f)
    if not isinstance(d, dict):
        raise ValueError('%s: ожидался объект {"русский литерал": "перевод"}' % p)
    return d


def apply_table(code, table, lang):
    """Заменить литералы кода переводами из table. Возвращает (код, пропуски, ошибки)."""
    lits, _keys, tpls = literals(code)
    missing, bad, parts, pos = [], [], [], 0
    for t in lits:
        ru = t.value
        tr = table.get(ru) if table else None
        if tr is None:
            if is_keep(ru):
                continue
            if ru not in missing:
                missing.append(ru)
            continue
        err, _warn = problems(ru, tr, lang)
        if err:
            if all(b[0] != ru for b in bad):
                bad.append((ru, err))
            continue
        if tr == ru:
            continue
        parts.append(code[pos:t.start])
        parts.append(encode_js(tr, t.quote))
        pos = t.end
    parts.append(code[pos:])
    for t in tpls:
        bad.append((t.text[:80], ['шаблонная строка `...` с кириллицей не переводится: используйте обычный литерал и tpl()']))
    return ''.join(parts), missing, bad


def translate_js(code, lang, strict=True):
    """Перевести строки интерфейса в склеенном JS (scene.js + anim.js + app.js).

    lang: kk | en (словарь src/i18n/<lang>.json); для ru код возвращается как есть.
    strict=True: нет перевода или перевод с ошибкой -> ValueError со списком строк.
    strict=False: такие строки остаются русскими, список печатается в stderr.
    Пропуски последнего вызова: translate_js.missing = LAST_MISSING (непереведенные строки) и
    translate_js.bad = LAST_BAD (строки с ошибками перевода: [(строка, [ошибки])])."""
    global LAST_MISSING, LAST_BAD
    LAST_MISSING, LAST_BAD = [], []
    translate_js.missing, translate_js.bad = LAST_MISSING, LAST_BAD
    if lang == 'ru':
        return code
    table = load_table(lang)
    no_table = table is None
    if no_table:
        if strict:
            raise ValueError('i18n_ui: нет словаря интерфейса %s' % dict_path(lang))
        table = {}
    out, missing, bad = apply_table(code, table, lang)
    LAST_MISSING, LAST_BAD = missing, bad
    translate_js.missing, translate_js.bad = missing, bad
    if missing or bad:
        head = 'i18n_ui %s: без перевода %d строк интерфейса, с ошибками перевода %d' % (lang, len(missing), len(bad))
        if no_table:
            head += ' (нет словаря %s)' % os.path.relpath(dict_path(lang), BASE)
        limit = 40 if strict else (0 if no_table else 10)
        lines = [head] + ['  нет перевода: %r' % s[:100] for s in missing[:limit]]
        if len(missing) > limit and limit:
            lines.append('  ... и еще %d (python3 tools/i18n_ui.py check %s)' % (len(missing) - limit, lang))
        lines += ['  ошибка: %r: %s' % (s[:80], '; '.join(e)) for s, e in bad[:40]]
        if strict:
            raise ValueError('\n'.join(lines))
        print('\n'.join(lines), file=sys.stderr)
    return out


LAST_MISSING = []
LAST_BAD = []
translate_js.missing = LAST_MISSING
translate_js.bad = LAST_BAD


# ---------------------------------------------------------------- extract / check / pseudo

def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


def context(code, t, fname):
    ls = code.rfind('\n', 0, t.start) + 1
    le = code.find('\n', t.end)
    le = len(code) if le < 0 else le
    line = code.count('\n', 0, t.start) + 1
    a, b = t.start - ls, t.end - ls
    text = code[ls:le]
    lit = text[a:b]
    if len(lit) > 110:
        lit = lit[:70] + ' ... ' + lit[-30:]
    room = max(0, 160 - len(lit))
    pre_n = min(a, room // 2)
    post_n = min(len(text) - b, room - pre_n)
    pre_n = min(a, room - post_n)
    frag = text[a - pre_n:a] + lit + text[b:b + post_n]
    return '%s:%d: %s' % (fname, line, frag.strip())


PLURAL_FORMS = ('1', '2-4', '5+')   # формы plural(n, a, b, c): a - 1, 21...; b - 2-4, 22-24...; c - 5-20, 25...


def plural_forms(toks):
    """{позиция литерала: форма} для литералов - аргументов plural(n, 'a', 'b', 'c')."""
    out = {}
    for k, t in enumerate(toks):
        if not (t.kind == 'name' and t.text == 'plural' and k + 1 < len(toks) and toks[k + 1].text == '('):
            continue
        if k > 0 and toks[k - 1].text == 'function':
            continue
        args, cur, depth, j = [], [], 0, k + 2
        while j < len(toks):
            x = toks[j]
            if x.kind == 'punct' and x.text in '([{':
                depth += 1
            elif x.kind == 'punct' and x.text in ')]}':
                if depth == 0:
                    break
                depth -= 1
            if x.kind == 'punct' and x.text == ',' and depth == 0:
                args.append(cur); cur = []
            else:
                cur.append(x)
            j += 1
        args.append(cur)
        for i, a in enumerate(args[1:4]):
            if len(a) == 1 and a[0].kind == 'str':
                out[a[0].start] = PLURAL_FORMS[i]
    return out


def collect(with_forms=False):
    """[(строка, [контексты])] по первому появлению, без дублей; with_forms: + {строка: формы plural}."""
    seen, order, forms = {}, [], {}
    for name in FILES:
        code = read(name)
        lits, _keys, tpls = literals(code)
        pf = plural_forms(tokenize(code))
        for t in tpls:
            print('ВНИМАНИЕ: %s: шаблонная строка с кириллицей не переводится: %r' % (name, t.text[:60]), file=sys.stderr)
        for t in lits:
            if t.value not in seen:
                seen[t.value] = []
                order.append(t.value)
            seen[t.value].append(context(code, t, name))
            if t.start in pf:
                f = forms.setdefault(t.value, [])
                if pf[t.start] not in f:
                    f.append(pf[t.start])
    items = [(s, seen[s]) for s in order]
    return (items, forms) if with_forms else items


def extract():
    """src/i18n/ui-ru.json: [{"ru": строка, "ctx": [где и как склеивается], "plural": [формы], "keep": true}].
    plural - строка стоит в plural(n, a, b, c) как форма для чисел 1 (a), 2-4 (b) или 5+ (c).
    Сборка kk берет всегда форму a (после числа существительное в единственном числе),
    en - a для 1 и c для остальных чисел; форма b в kk и en не используется."""
    items, forms = collect(with_forms=True)
    out = []
    for s, ctx in items:
        e = {'ru': s, 'ctx': ctx[:6]}
        if s in forms:
            e['plural'] = sorted(forms[s], key=PLURAL_FORMS.index)
        if is_keep(s):
            e['keep'] = True
        out.append(e)
    os.makedirs(I18N, exist_ok=True)
    p = os.path.join(I18N, 'ui-ru.json')
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    total = sum(len(c) for _, c in items)
    keys = sum(len(literals(read(n))[1]) for n in FILES)
    print('%s: %d ключей (литералов с кириллицей в коде: %d, из них ключей объектов не переводится: %d), keep: %d, шаблонов с {плейсхолдерами}: %d'
          % (os.path.relpath(p, BASE), len(out), total + keys, keys, sum(1 for e in out if e.get('keep')),
             sum(1 for e in out if PH.search(e['ru']))))
    return out


def check(lang):
    items = collect()
    ru = [s for s, _ in items]
    table = load_table(lang)
    if table is None:
        print('Нет словаря %s' % dict_path(lang))
        return 1
    errs, warns = [], []
    for k, v in table.items():
        if not isinstance(v, str):
            errs.append((k, ['перевод должен быть строкой']))
    known = set(ru)
    missing = [s for s in ru if s not in table and not is_keep(s)]
    keep_missing = [s for s in ru if s not in table and is_keep(s)]
    extra = [k for k in table if k not in known]
    for s in ru:
        if s in table and isinstance(table[s], str):
            e, w = problems(s, table[s], lang)
            if e:
                errs.append((s, e))
            if w:
                warns.append((s, w))
    # ui-ru.json должен соответствовать коду
    p = os.path.join(I18N, 'ui-ru.json')
    if os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            listed = [e['ru'] for e in json.load(f)]
        if listed != ru:
            warns.append(('src/i18n/ui-ru.json', ['устарел: запустите python3 tools/i18n_ui.py extract']))
    for s in missing:
        print('MISS %r' % s)
    for s, e in errs:
        print('ERR  %r: %s' % (s[:100], '; '.join(e)))
    for s, w in warns:
        print('WARN %r: %s' % (s[:100], '; '.join(w)))
    for k in extra:
        print('EXTRA %r (такой строки нет в коде)' % k[:100])
    print('%s: строк в коде %d, переведено %d, нет перевода %d (keep без перевода: %d, подставится оригинал), лишних %d, ошибок %d, предупреждений %d'
          % (lang, len(ru), len(ru) - len(missing) - len(keep_missing), len(missing), len(keep_missing), len(extra), len(errs), len(warns)))
    ok = not missing and not errs
    print('OK' if ok else 'FAIL')
    return 0 if ok else 1


def pseudo():
    """_pseudo.json: каждое значение - исходная строка в квадратных скобках (keep - как есть);
    перевод склеенного кода должен парситься node --check и не содержать русских литералов вне скобок."""
    items = collect()
    table = {s: (s if is_keep(s) else '[' + s + ']') for s, _ in items}
    os.makedirs(I18N, exist_ok=True)
    with open(dict_path('_pseudo'), 'w', encoding='utf-8') as f:
        json.dump(table, f, ensure_ascii=False, indent=1)
        f.write('\n')
    code = '\n'.join(read(nm) for nm in BUILD_ORDER)
    out = translate_js(code, '_pseudo', strict=True)
    fails = []
    lits, _keys, _t = literals(out)
    for t in lits:
        v = t.value
        if not (v.startswith('[') and v.endswith(']')) and not is_keep(v):
            fails.append('русский литерал вне скобок: %r' % v[:80])
    fd, tmp = tempfile.mkstemp(suffix='.js')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(out)
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    if r.returncode != 0:
        fails.append('node --check: ' + (r.stderr or r.stdout)[:500])
    if '</script' in out.lower():
        fails.append('в коде есть </script')
    n_tr = len(lits)
    print('pseudo: словарь %d строк, литералов в переведенном коде %d, node --check %s'
          % (len(table), n_tr, 'OK' if r.returncode == 0 else 'FAIL'))
    for f_ in fails[:30]:
        print('FAIL', f_)
    print('OK' if not fails else 'FAIL')
    return 0 if not fails else 1


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'extract':
        extract()
    elif cmd == 'check' and len(sys.argv) > 2:
        sys.exit(check(sys.argv[2]))
    elif cmd == 'pseudo':
        sys.exit(pseudo())
    else:
        print(__doc__)
        sys.exit(2)
