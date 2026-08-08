---
name: scene-perf-backlog
description: "Що вже зроблено з оптимізації клієнтської 3D-сцени і що лишилось, із заміряними числами — читати, коли Іван скаже «оптимізацій замало»"
metadata: 
  node_type: memory
  type: project
  originSessionId: fc30eb57-0a60-4c92-9b91-47639edd83ac
  modified: 2026-08-03T12:58:40.987Z
---

Стан на 2026-08-03, гілка `multi-floor-support`, коміт `86dbb20`. Іван подивився — стало
краще, KTX2 вирішили поки не робити. Він напише, коли перевірить на телефоні.

## Зроблено — НЕ переробляти

ContactShadows `frames={1}` і сховано через `<group visible>` замість розмонтування (drei
створює render-таргети в memo без cleanup — був витік на кожен вхід у кімнату) ·
`shadowMap.autoUpdate = false` + `ShadowUpdates.tsx` ·
`transmission = 0` на матеріалах у `BuildingModel` ·
обводка виділення будується лише для вибраного предмета ·
`RoomHotspots` не розмонтовуються (кожен drei `Html` при монтуванні робить
`scene.updateMatrixWorld()` по всьому графу) ·
`ModelThumbnailFactory` піднято з `<Show>` у `PackagePanel` (знищував другий WebGL-контекст
на кожен вихід із кімнати) · сусіди меблів через `obstaclesByRoom` ·
прелоади в `useEffect` · `dpr` 1.5 і без MSAA на `pointer: coarse` · `gl={{ alpha: false }}`.

**Хибна гіпотеза, яку не повторювати:** зміна набору світла НЕ спричиняє перекомпіляцію
щоразу. `WebGLRenderer.js:2190` — програми лежать у `Map` на матеріалі за ключем і
перевикористовуються; компіляція одноразова. Я через це дарма переписав `SceneLighting` на
фіксований набір і відкотив.

## Лишилось, за спаданням віддачі

**1. `overview-clipping.ts` ставить `DoubleSide` на 40 із 42 матеріалів і пише
`gl_FragDepth`.** `gl_FragDepth` вимикає early-Z на всіх мобільних tile-based GPU — на
315k трикутників це, найімовірніше, домінуюча ціна на телефоні. Обидва потрібні лише щоб
фарбувати зрізані backfaces пласким `CUT_FACE`. Лікування: allowlist «ріжучих» матеріалів
(стіни/плити) з `BuildingModel`, решті — не чіпати `side` і не писати глибину. **Ризик:
міняє вигляд зрізу поверху** — перевіряти візуально на кожному поверсі.

**2. KTX2/Basis.** 20×2048² + 2×1024² у RGBA8 з мipами ≈ **459 МБ** відеопам'яті на саму
будівлю; мобільний Safari забирає контекст значно раніше. Найімовірніша причина жорстких
падінь на телефонах, і в цифрі «11.2 МБ» вона не видна.
Перевірено 2026-08-03: `toktx` на PATH **немає**, тож `@gltf-transform/functions` його не
викличе; треба або `gltfpack -tc` (самодостатній npm-пакет), або поставити KTX-Software і
**додати кодувальник у Dockerfile**, інакше завантаження моделей на проді зламається.
Рантайм: `three/examples/jsm/libs/basis/{basis_transcoder.js,.wasm}` є в node_modules —
скопіювати в `public/`, і в кожен `useGLTF(url, false, true, loader => loader.setKTX2Loader(...))`.
Потрібен перезалив усіх моделей.

**3. Дві lossless alpha-мапи = 4.24 МБ із 11.23 МБ (37.7% файлу).**
`floor_Restroom_specularf0`: RGB 7 КБ, alpha 2 194 КБ. `adskMatdoor_interior_specularf0`:
RGB 7 КБ, alpha 2 049 КБ. Це `KHR_materials_specular` specularTexture, glTF читає з них
лише канал A. Інші 17 specular-матеріалів обходяться скаляром — це артефакт експорту з
Revit. Правити в `src/modules/media/lib/optimize-model.ts` (`run()`): або прибрати
specular-текстури зовсім, або протягнути `alphaQuality` у sharp — `textureCompress` передає
лише `{quality, effort, lossless, nearLossless}`. **11.2 МБ → ~7 МБ.** Потрібен перезалив.

**4. 57% трикутників — це фітинги, і всі кидають тінь.** HVAC-дифузори 89 520 + розетки
47 392 + хром 44 260 = 181 172 із 315 777. `BuildingModel` ставить `castShadow` на всі меші.
Зняти тінь із цих матеріалів — удвічі дешевший shadow-pass. У пайплайні немає ні
`simplify()`, ні LOD.

**5. `frameloop="demand"` + `invalidate()`.** Правильний кінцевий стан для телефона, але
треба перебрати всі `useFrame`: `BuildingModel`, `RoomShell`, `PlacedPackages` (два).

**6. nginx без http2** (`deploy/nginx.conf`, `listen 80`) — 11.2 МБ glb ділить 6 з'єднань
HTTP/1.1 з десятком неважливих ассетів. Потрібен TLS.

**7. Роут `/configurator` не код-спліт** — three + drei + camera-controls + maath у
початковому бандлі, жодного `next/dynamic`.

Модель, на якій усе міряно: `models/test 2 storey.glb`, 11 775 432 Б — 334 вузли, 61 меш,
42 матеріали, 22 текстури, 315 777 трикутників, зображення 78% файлу.
Пов'язане: [[env-quirks-3d-configurator]], [[project-3d-configurator-state]].
