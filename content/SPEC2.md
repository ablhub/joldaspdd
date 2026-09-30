# SPEC2 - expanding the question bank to ~1850 questions with illustrations

You are one of several authors working in parallel on a free Kazakhstan driving-theory site (ПДД РК). Read this whole file first, then `content/SPEC.md` (accuracy + typography rules still apply), then look at `content/scene-examples.json` (working scene examples).

## 1. What "good" looks like (derived from analysing a real exam-style demo)
The real theory exam (спецЦОН) is 40 questions / 40 min / pass with 32+. Most exam questions are SITUATIONS with a picture, not recall. Patterns to reproduce (in our own words and our own drawings):
- The subject vehicle is identified by colour/type: «Водитель красного автомобиля...», «грузовой автомобиль», «мотоцикл», «автобус». In our scenes the subject has `me:true` (caption «Вы: красный автомобиль» is added automatically). Any colour may be `me`.
- Answer sets are EXHAUSTIVE combinations, so guessing by wording does not work:
  - «Кому уступить дорогу?» -> «Только грузовому», «Только зеленому легковому», «Обоим», «Никому» (with 3 others: «Всем», «Только автобусу», «Автобусу и легковому», ...).
  - «В какой последовательности проедут перекресток?» -> 3-4 permutations of the vehicles.
  - «По какой траектории можно продолжить движение?» -> trajectories drawn with labels А/Б/В (`paths`), answers «По А», «По Б», «По обеим», «Ни по одной».
  - «Кому разрешена стоянка/остановка?» -> «Синему», «Красному», «Обоим», «Никому».
- Key facts are often VISIBLE, not written: unpaved (dirt) road meeting a paved road, rural vs town surroundings, a distance shown by a dimension arrow («40 м»), a plate 7.13 showing where the main road turns, lane markings. Every fact needed to answer must be visible in the scene or stated in the text. Be fair: no trick that depends on invisible details.
- Distractor details are fine (a direction sign, a parked car), but they must not create ambiguity.
- Mirror pairs: the same layout asked twice with roles swapped (you on the secondary road, then you on the main road). Make ~20% of situational questions mirror pairs (consecutive ids).
- Our explanation must beat theirs: explain THIS scene in 1-3 sentences («Вы на второстепенной дороге, главная поворачивает налево, поэтому...»), then the rule, then `ref`.
- Watch the 2026 changes (competitor banks are outdated here): bus lane entry at a dashed line is NO LONGER allowed (п. 126, приказ МВД № 305 от 27.04.2026); nobody under 16 on the rear seat of a motorcycle/moped (п. 156 пп. 5); trucks 50 km/h in populated areas (п. 73, Nov 2025); e-scooters off sidewalks (Закон № 326-VIII, from 25.08.2026). Teach the CURRENT rule.

## 2. Files you write
- New questions for an existing module go to `content/extra/<mid>-<tag>.json` = `{"module":"m11","questions":[ ... ]}` (your task tells you the exact file name).
- New category modules (m21-m25) are full module files `content/mNN.json` with the SPEC.md module schema (lesson, keyFacts, mistakes, questions).
- You may edit ONLY the files your task names. If your task says you own `content/mNN.json`, you may add `scene`/`sign`/`type`/`cats` to its existing questions, fix errors you find, and extend its lesson if your new questions test rules the lesson does not explain (max 14 lesson blocks). Never renumber existing ids.

## 3. Question schema (extends SPEC.md)
```json
{"id":"m11-a001","type":"yield","cats":["C"],"q":"...","options":["...","..."],"answer":2,
 "explain":"...","ref":"п. 101","difficulty":2,
 "scene":{...}}            // or "sign":"2.4" for a single sign picture
```
- `id`: `<mid>-<tag><3 digits>` exactly as your task says (e.g. m09-n001...). Unique.
- `type` (required on new questions): yield | order | path | park | situation | sign | marking | signal | fact | fine | aid | safety | procedure.
- `cats` (optional): omit for questions that apply to every licence category. Use a subset of ["A","B","C","D","T"] only when the question is specific to: A = motorcycles/mopeds/quadricycles (A, A1, B1), B = cars (B, BE), C = trucks (C, C1, CE, C1E), D = buses (D, D1, DE, D1E), T = tram/trolleybus (Tb, Tm).
- 2-5 options (3-4 normally), exactly one correct, vary the correct index. No «все ответы верны».
- `difficulty`: aim for ~30% 1, ~45% 2, ~25% 3.
- Texts: Russian, plain, short. Hyphen only, never «—» or «–». Quotes «».

## 4. Scene schema (renderer: src/scene.js). Canvas 240x240, top-down view.
Common: `type` (cross | round | road | signal | signs), `area` ("town" = houses + sidewalks, "rural" = trees), `night`, `fog`, `labels`: [{x:0..1,y:0..1,text}], `anim`: steps for the explanation animation, e.g. [["truck","green"],["me"]] (cars in one step move together; only cars with `turn`/`arrow`/`exit` can move). REQUIRED for yield/order questions, must match the correct answer.
Vehicle fields: `id` (short, unique), `kind` (car | taxi | police | ambulance | fire | truck | bus | trolleybus | tram | moto | bike | scooter | tractor | car-trailer | truck-trailer | semi | bus-art), `color` (red | blue | white | green | yellow | black | orange | gray), `me`, `label` (letter on roof), `flash` (true = blue/red beacons, "orange"), `hazard`, `signal` ("left"|"right" blinker), `brake`, `focus` (dashed ring).

### cross (4-way; 3 arms = T-junction)
`arms` ["N","E","S","W"] (subset of 3 for a T). `lanesNS`, `lanesEW` 1|2 (lanes per direction). `surface` {"E":"dirt"}. `center` "dashed"|"solid"|"double"|"none", `centerByArm` {"S":"solid"}. `crosswalks` ["S"]. `stoplines` true|["S"] (default: arms with lights). `yieldlines` ["S"] (1.13 triangles). `laneArrows` {"S":[["right"],["straight","left"]]} (lane 1 = rightmost). `signs` {"S":["2.4","7.13"]} - signs for the driver approaching FROM that arm, drawn at the right corner. `main` ["N","E"] = arms forming the main road; REQUIRED when a 7.13 plate is used (the plate is then drawn automatically from each driver's view). `lights` {"S":"green"} or {"S":{"on":["red"],"flash":[],"arrows":{"right":"green"}}}. `cop` {face:"N|E|S|W", pose:"side|up|rightfwd|down"}. `tram` "NS"|"EW". `peds` [{arm:"E", pos:0..1, dir:"l2r|r2l"}]. `dims` [{arm, from, to, label:"20 м"}] (px along the arm). `obstacles` [{arm,lane,dist}].
Cars: `arm` (where the car comes FROM, it drives toward the centre), `lane` (1 = rightmost), `at` "stop"|"near"|"far"|"in"|"exit" (or `dist` px back from the stop position), `turn` "straight"|"left"|"right"|"u" (+ optional `toLane`), `paths` [{label:"А", turn:"left", toLane:1}, ...] for trajectory questions (drawn black with letters, no animation). `at:"exit"` = a car leaving along that arm. A tram uses `kind:"tram"` and moves on the rails (`tram` must be set).
Right-hand traffic: from S you drive north; right turn goes E, left goes W.

### round (roundabout)
`arms`, `signs` {"S":["4.3","2.4"]}, cars with `arm` + `at` + `turn` (exit: right=first, straight, left, u), or cars already on the ring: `ring`: angle in degrees clockwise from north (traffic circulates counter-clockwise) + optional `exit`:"N" to animate/arrow its exit.

### road (straight segment, bottom -> top is "up")
`up` 1-3 lanes going up, `down` 0-3 lanes going down (0 = one-way). `divider` "dashed"|"solid"|"double"|"1.11u" (broken on the up side: up traffic may cross)|"1.11d"|"warn" (1.6)|"yellow"|"none", or segments [{from:0,to:0.5,type:"dashed"},{from:0.5,to:1,type:"solid"}] (y 0 = bottom, 1 = top). `strip` true (dividing strip). `laneLines`. `edge` "shoulder"|"sidewalk"|"none". `edgeLine`. `surface` "dirt". `busLane` "u1" + `busLine` "solid"|"dashed" (letters «А» are drawn). `side` [{side:"left|right", y, kind:"road|yard", surface:"dirt", text}] side roads / driveways. `rail` {y, tracks:1|2, barrier:"up|down|none", lights:"flash|off|white|red", train:{from:"left|right", dist:"near|far", track:1}}. `marks` [{type:"crosswalk",y} | {type:"stopline",y,all} | {type:"yield",y} | {type:"yellow-edge",side,from,to,dashed} | {type:"zigzag",side,from,to} | {type:"arrows",lane,y,dirs} | {type:"hatch",from,to}]. `busstop` {side,y}. `dims` [{side,from,to,label}]. `parked` [vehicle + side, y, onWalk]. `peds` [{x:0..1 across road, y, dir, walk:"left|right"}]. `obstacles` [{lane,y}]. `signs` [{side, y, codes:[...]} or {over:"u1", y, codes}]. `lights` [{side,y,state}]. `cop` {x,y,face,pose}.
Cars: `lane` "u1".."u3" / "d1".."d3" (u1 = rightmost up lane, d1 = rightmost down lane i.e. leftmost on screen), `y` 0..1 (centre), `arrow` straight | left | right | u | overtake | bypass | change-left | change-right | stop-right | park-right | stop-left | reverse, `paths` [{label, arrow}], `side` (index into scene.side = car is on that side road/driveway, then arrow left|right|straight), `onShoulder` "left|right".

### signal (big traffic lights)
`items` [{kind:"car", on:["red","yellow"], flash:["green"], arrows:{"right":"green"}, shape:{"green":"left"}, label} | {kind:"ped", on:["green"], flash:["green"]} | {kind:"rev", symbol:"x|down|diag-left|diag-right"} | {kind:"rail", on:["red"], flash:["red"], white:true|false} | {kind:"tram", on:["up","base"]}]. Up to 4 items.

### signs (sign pictures, with plates)
`items` [["3.27","p:8.00-17.00"], ["3.24:60"]] - each inner array is one pole, top to bottom.

### Sign codes you may use
Catalog (content/signs.json): 1.1 1.2 1.3.1 1.5 1.6 1.7 1.8 1.11.1 1.12.1 1.13 1.14 1.15 1.16.1 1.18.1 1.19 1.20 1.21 1.23 1.30 2.1 2.2 2.3.1 2.3.2 2.4 2.5 2.6 2.7 3.1 3.2 3.3 3.4 3.13 3.18.1 3.18.2 3.19 3.20 3.21 3.24 3.25 3.27 3.28 3.29 3.31 4.1.1 4.1.2 4.1.3 4.1.4 4.1.5 4.2.1 4.3 4.5 4.6 4.7 5.1 5.5 5.7.1 5.11.1 5.12 5.15 5.16.1 5.19.1 5.22 5.23 5.24 5.38 5.39 6.1 6.3 6.4 7.1.1 7.2.1 7.13.
Dynamic (any value): "3.24:60", "3.25:60", "4.7:30", "4.8:30", "3.11:10 т", "3.12:6 т", "3.13:3.5 м", "3.14:2.5 м", "3.15:10 м", "3.16:30 м", "1.13:12%", "1.14:12%", "5.22:АЛМАТЫ", "5.23:АЛМАТЫ", "5.24:...", "5.25:...", and text plates "p:8.00-17.00", "p:Кроме такси", "p:150 м" (for plates 7.x with text use "p:" and describe the plate in the question text if needed). Do NOT invent other codes; the validator rejects them. If a sign you need is missing, describe it in words.

## 5. Your workflow (mandatory)
1. Research: fetch the current ПДД РК text for your topics (kazpdd.kz/ru/rules/<N>, prg.kz consolidated text via targeted WebFetch prompts, see SPEC.md). Build a coverage list of the points (пункты/подпункты) in your topic: every point that an exam could test must get at least one question.
2. Write questions in batches of ~20 into your file. After EACH batch:
   - `node tools/validate.js <your file>` - fix every error.
   - `python3 tools/preview.py <your file> preview/<your-tag> --per 6` and Read EVERY PNG it prints. Check that each picture matches its text: the right car is `me`, arrows point the way the text says, signs are on the approach they belong to, nothing overlaps confusingly, every vehicle named in options exists and is unambiguous (only one green car...). Fix and re-render.
3. At the end: run the validator once more on your file(s) and `node tools/validate.js --all` (warnings about duplicates of other files must be resolved by changing your question).

## 6. Final reply (short)
Files written, question count by type, share with scene/sign, anything unverified or conflicting between sources, rules you think the lesson still lacks.
