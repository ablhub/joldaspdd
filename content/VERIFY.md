# VERIFY - independent check of the question bank

You are an independent reviewer for a free Kazakhstan driving-theory site (ПДД РК). Other authors wrote the questions; your job is to find and FIX errors in the files your task names. Learners will study from this and then sit the real exam at спецЦОН, so a wrong "correct answer" is the worst possible defect.

Read first: `content/SPEC.md` (accuracy + typography rules), `content/SPEC2.md` (question and scene schema, renderer features). Tools: `node tools/validate.js <file>`, `python3 tools/preview.py <file> <outdir> [--ids a,b] [--per 6]` (then Read the PNGs), `python3 tools/stats.py <file> --list`.

## Source of truth
Current ПДД РК = Приказ МВД РК от 30.06.2023 № 534 with amendments up to приказ № 305 от 27.04.2026. Local mirror of the official text (31.08.2026), plain text, one file per chapter/appendix:
`<рабочий каталог>/pddtext/` - pravila-glava-1..26, znaki-glava-1..7 (Appendix 1), razmetka-glava-1..2 (Appendix 2), perechen-* (Перечень неисправностей), dopusk.txt (Основные положения по допуску), koap-statya-590..629 (КоАП, штрафы; МРП 2026 = 4 325 ₸). Paragraph numbers are glued to the text: grep `^126` for п. 126. Use the web only for things outside this text (first aid guidelines, exam procedure) and prefer official sources. Do not trust kazpdd.kz for rule texts or fines: it is outdated in several places.

## Check EVERY question in your files (base module file and its extra file)
1. Correct answer: the marked option is right under the CURRENT text; exactly one option is defensible; every distractor is clearly wrong for a careful reader (no «almost right» options, no two correct ones, no trick depending on an invisible detail).
2. `ref`: the пункт/подпункт/sign/marking number really contains the rule (continuous numbering «п. 99», «п. 2 пп. 19», «Прил. 1, знак 3.27», «Прил. 2, разметка 1.1», «КоАП ст. 597 ч. 1»).
3. `explain`: factually right, consistent with the answer and the scene, 1-3 sentences, explains THIS situation and then the rule. Numbers (speeds, distances, ages, fines) match the text.
4. Scene (if any): open the previews and look at each one. The `me` vehicle is the one the text talks about; every vehicle named in the question/options exists and is unambiguous (one green car, not two); arrows/turns match the text; signs are on the approach they belong to; `main` matches the 7.13 plates; light states match; the scene does not contradict the text (e.g. text says «вне населенного пункта» but `area:"town"`). For yield/order questions `anim` must match the correct answer: vehicles that go first are in the first step, those that wait move later. If the renderer cannot draw a situation correctly, remove the `scene` and state the needed facts in the text instead - a wrong picture is worse than none.
5. `cats`: omit when the rule applies to all drivers; `["A"]` motorcycles/mopeds/quadricycles, `["B"]` cars and car trailers, `["C"]` trucks, `["D"]` buses, `["T"]` tram/trolleybus - only if the question is specific to that group. A question with cats must make sense for every category in that group.
6. Answer-length bias (important for exam realism): run `python3 tools/stats.py <file> --list`. Where the correct option is noticeably longer or more detailed than the others, rewrite the options so a learner cannot guess by length: make distractors equally specific and plausible (same structure, concrete but wrong numbers/conditions) or trim the correct option to the essential rule. Targets per file: longest <= 0.40, giveaway <= 0.10. Also keep the correct index spread over positions (reorder options if one position dominates; update `answer`, and if the scene/anim or explanation mentions option letters, keep them consistent).
7. Duplicates: remove or rewrite questions that test the same fact with the same situation as another question in your files (mirror pairs with swapped roles are intended - keep those).
8. Language: natural Russian, short sentences, no typos; hyphen only (never «—» or «–»); quotes «»; no English or placeholder text.

## How to fix
- Edit the JSON in place (a short python read-modify-write is safest). Keep `id` values; never renumber. If a question cannot be made correct and fair, delete it and list it in your reply.
- Keep option count 3-4 and exactly one correct.
- After each batch of fixes: `node tools/validate.js <file>` must pass. At the end also run `node tools/validate.js --all` and `python3 tools/stats.py <your files>`.
- Do not edit files that are not in your task. If you find a conflict with another module, describe it in your reply (question ids + the correct rule).

## Final reply (short)
Per file: questions checked, answers corrected (ids), refs corrected (count), scenes fixed/removed (ids), options rebalanced (count), deleted (ids), final stats line. Then: open doubts that need a human decision (with the rule text you read).
