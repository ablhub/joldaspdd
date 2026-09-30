# Content spec - free ПДД РК prep site (Kazakhstan, category B focus)

Audience: learners 16-30 preparing for the theory exam at спецЦОН (40 questions, 40 minutes, pass = at least 32 correct, max 8 errors) and for the practical exam on the automated autodrom. Language: Russian, plain and friendly, short sentences.

## Output: one JSON file per module in /home/claude/pdd/content/<id>.json

```json
{
  "id": "m07",
  "order": 7,
  "title": "Скорость движения",
  "pdd": "Раздел 10 ПДД РК",
  "icon": "speed",
  "summary": "1-2 sentences: what the learner will know after this module",
  "minutes": 12,
  "lesson": [
    {"h": "Subheading", "p": ["paragraph", "paragraph"], "list": ["bullet", "bullet"], "tip": "optional one-line exam tip"}
  ],
  "keyFacts": ["Short fact with the number and reference (п. 10.2)"],
  "mistakes": ["Typical learner mistake and the correct rule"],
  "questions": [
    {"id": "m07-01", "q": "Question text", "options": ["A", "B", "C", "D"], "answer": 2,
     "explain": "1-3 sentences: why the answer is correct, with the rule", "ref": "п. 10.3", "difficulty": 1}
  ]
}
```

- `icon` - one of: book, user, walk, light, siren, arrows, lanes, speed, overtake, parking, cross, train, highway, home, bus, lamp, tow, school, cargo, bike, aid, law, sign, marking, car, wheel.
- `lesson` - 4-10 blocks. Explain the rules in your own words, with the "why" behind them, so a beginner understands. Every block can have p and/or list; tip is optional.
- `keyFacts` - 5-12 items, the numbers and must-remember rules, each ending with the reference in brackets.
- `mistakes` - 3-6 items.
- `questions` - as many as asked in your task. 3 or 4 options, exactly one correct, `answer` is the 0-based index. Vary the correct index across questions (not always 0 or 1). Plausible distractors. No "все ответы верны"/"оба ответа" tricks. `difficulty` 1 (easy) - 3 (hard, situational). Prefer situational questions ("Вы едете..., что вы должны сделать?") over pure recall.

## Accuracy rules (critical - this is safety content)

1. Source of truth is the CURRENT text of ПДД РК: Приказ МВД РК от 30.06.2023 № 534 with all amendments up to приказ № 305 от 27.04.2026 (in force 12.07.2026). Numbering is continuous (п. 1 ... п. 2xx, with subpoints «п. 2 пп. 19»), not the old «13.9» style. A local mirror of the official Adilet text (state 31.08.2026) is on disk - read it first, it is faster and more reliable than the web:
   - plain text: <рабочий каталог>/pddtext/ (pravila-glava-N-*.txt = chapters 1-26, znaki-glava-N-*.txt = Appendix 1 signs, razmetka-*.txt = Appendix 2 markings, perechen-*.txt = Перечень неисправностей, dopusk.txt = Основные положения по допуску, koap-statya-*.txt = КоАП articles 590-629). Paragraph numbers are glued to the text («126На дорогах...»), so grep for «^126».
   - HTML mirror: <рабочий каталог>/pdd-kz/ (same content).
   Known stale web sources: kazpdd.kz/ru/rules/* is outdated for п. 126, 138, 19, 43, fines and categories (rules/28). Never trust a web page over the mirror.
2. Every number, distance, speed, priority rule and definition must be traceable to a specific пункт you actually read. Put it in `ref` (e.g. "п. 99", "п. 2 пп. 19", "Прил. 1, знак 3.27"). If you cannot verify a fact, leave it out. Never guess. If two sources conflict, use the one that reflects the 2025 amendments and mention the conflict in your final reply.
3. Write in your own words. Do NOT copy question wording from exam banks, apps or competitor sites (their compilations are copyrighted). Paraphrasing or briefly quoting the ПДД text itself is fine (it is an official normative act).
4. Typography: never use the long dash "—" or the en dash "–" anywhere. Use a normal hyphen "-" only. Use «» for quotes inside text so JSON stays clean.
5. Validate every file you write: `python3 -c "import json;json.load(open('<path>'))"` and check that every `answer` index is within options.

## Final reply to the orchestrator
Keep it short: files written, question count per file, and a list of any facts you could not verify or source conflicts you found.
