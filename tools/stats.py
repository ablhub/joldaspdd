#!/usr/bin/env python3
"""Answer-bias stats for question files.
Usage: python3 tools/stats.py <file.json> [...] [--list]
  longest = share of questions where the correct option is strictly the longest
  giveaway = share where the correct option is >= 1.25x longer than every other option
  --list prints ids of giveaway questions (fix these first: balance option lengths/detail)
Targets per file: longest <= 0.40, giveaway <= 0.10, correct index spread roughly even."""
import json, sys, collections

args = [a for a in sys.argv[1:] if not a.startswith('--')]
show = '--list' in sys.argv
for f in args:
    d = json.load(open(f, encoding='utf-8'))
    qs = d if isinstance(d, list) else d.get('questions', [])
    if not qs:
        print(f, 'no questions'); continue
    idx = collections.Counter(q['answer'] for q in qs)
    longest = 0; give = []
    for q in qs:
        L = [len(o) for o in q['options']]
        c = L[q['answer']]; others = [x for i, x in enumerate(L) if i != q['answer']]
        if others and c > max(others):
            longest += 1
            if c >= 1.25 * max(others):
                give.append(q['id'])
    n = len(qs)
    print(f"{f}: n={n} longest={longest/n:.2f} giveaway={len(give)/n:.2f} answer_index={dict(sorted(idx.items()))}")
    if show and give:
        print('  giveaway ids:', ' '.join(give))
