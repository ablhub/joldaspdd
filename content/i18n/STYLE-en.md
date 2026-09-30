# Translating into English: rules for the translator

"Joldas" (Жолдас) is a free course that prepares learner drivers for the Kazakhstan driving theory test. The official test is available in Kazakh, Russian and English. You translate the course material from Russian into English for learners who take the test in English: foreigners living in Kazakhstan, students, expats.

## Language and style

1. Clear, plain, precise British English (licence, manoeuvre, tyre, colour, kerb, centre). Short sentences are welcome; no slang.
2. Address the learner as "you".
3. Use the terms in `glossary.md` and the sign names in `signs-names.json` exactly: carriageway, shoulder, traffic lane, give way, priority, overtaking, passing (for Russian "опережение"), stopping (остановка), parking (стоянка), level crossing, built-up area, residential zone, adjacent area, route vehicle, motor vehicle, traffic controller, road markings, plate. Do not swap an official term for a synonym.
4. Keep the meaning exact: these are safety rules. Keep every condition and exception ("only", "except", "at least", "no more than", "if"), every number and unit. Do not add advice of your own and do not simplify away meaning.
5. Numbers stay as digits. Units: km/h, m, km, t, kg, min, h. Convert the Russian decimal comma to a point: 3,5 m -> 3.5 m.
6. Sign codes (2.4), marking codes (1.1), categories (A, B, BE, C1E, Tb, Tm) and numbers stay unchanged.
7. Sign names in curly quotes: the “Give way” sign, the “No overtaking” sign. Inside JSON strings use curly quotes “ ” or ‘ ’, never the straight double quote, so that the JSON stays valid.
8. Em and en dashes (— and –) are forbidden. Use a hyphen "-" (with spaces for a dash-like pause: " - "), or a comma, colon or new sentence.
9. No Cyrillic letters anywhere in the English text. Diagram path letters map as А -> A, Б -> B, В -> C, Г -> D, Д -> E (the diagrams will show A, B, C). The learner-driver sign with the letter У is called the “Learner vehicle” sign. Town names use official Latin spelling (Almaty, Astana, Shymkent, Kostanay, Karaganda, Aktobe, Pavlodar).
10. Fines: МРП -> MCI (monthly calculation index), тенге -> tenge. спецЦОН -> specialised PSC (Public Service Centre).
11. The brand «Жолдас» is written Joldas.

## Placeholders and service fields

1. The markers ⟦1⟧, ⟦2⟧ ... stand for references to clauses of the Rules; the software translates them. Each marker must appear in the translation exactly once, normally at the end of the sentence before the full stop, as in the source. Do not replace a marker with your own reference.
2. References in brackets without a marker, e.g. «(ред. Закона РК № 326-VIII)», are translated together with the text (section 7 of the glossary): "(as amended by Law No. 326-VIII)".
3. The `ref` field (present only for some questions) is translated with the formats of glossary section 7: «п. 44» -> "para. 44", «п. 2 пп. 9» -> "para. 2(9)", «Прил. 1, знак 2.4» -> "Annex 1, sign 2.4", «ст. 590 ч. 1 КоАП РК» -> "CAO art. 590(1)".
4. The `pdd` field in `meta`: «Раздел 1 ПДД РК» -> "Chapter 1 of the Rules", «Разделы 3, 4 и 14 ПДД РК» -> "Chapters 3, 4 and 14 of the Rules", «Приложение 1 к ПДД РК» -> "Annex 1 to the Rules".
5. Never change `id`, `answer` or sign codes. Never reorder answer options: the correct option must stay at index `answer`.

## Answer options

1. Translate all options with equal care and in the same grammatical form.
2. The correct option must not stand out by length or detail. If after translation it is clearly longer than the others, shorten it or slightly expand the wrong ones without changing the meaning.
3. Wrong options must stay plausible.

## Diagram labels (`scene`)

Short (1-3 words), lower case as in the source: «двор» -> "yard", «ящик» -> "box", «затор» -> "traffic jam", «над вашей полосой» -> "above your lane".

## How to deliver

1. Read `content/i18n/glossary.md`, `content/i18n/signs-names.json` and your pack `content/i18n/packs/<pack>.json`.
2. Write the translation in parts: `content/i18n/out/en/<pack>/01.json`, `02.json`, ... (15-20 questions or one theory block per part). Each part is a JSON object with the same keys as the pack: `{"meta": {...}, "lesson": [...], "keyFacts": [...], "mistakes": [...]}` for theory, `{"questions": [...]}` for questions, `{"signs": [...]}` or `{"strings": {...}}` for other packs. For questions keep `id` and `answer`, translate `q`, `options`, `explain`, the values of `scene` (keep the keys) and `ref` if present. Do not copy the `refs` map.
3. The JSON must be valid.
4. Run `python3 /home/claude/pdd/tools/i18n_check.py en <pack>`. Fix every ERR line, review WARN lines (especially about the length of the correct option), and run again until you get OK.
5. Do not change any other project files.
6. Finish with a short reply: the check result (OK), the number of questions, and up to 5 bullet points about doubtful terms, if any.

## If the work was already started

If `content/i18n/out/en/<pack>/` already holds parts from an interrupted attempt, do not start over: check them (valid JSON, correct keys, ids consecutive from the start of the pack), keep the good ones and continue from the next question in new parts with higher numbers. To save resources, write large parts (20-25 questions) and do not re-read files unnecessarily.
