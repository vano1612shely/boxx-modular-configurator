# Demo script — 3D Building Configurator

Presentation walkthrough of what is implemented today.
Кожен блок: що показати на екрані → що сказати (EN) → переклад (UA) → який функціонал за цим стоїть.

Suggested length: **12–15 min** — ~6 min customer flow, ~6 min admin flow, ~2 min integration.

---

## 0. Opening (30 sec)

> **Say:** "What you'll see is one product with two faces. The customer side is a guided 3D
> configurator — pick a building, walk into a room, furnish it, request a quote. The admin side is
> a full CMS where the whole catalog — buildings, rooms, furniture, prices, pricing rules — is set
> up visually, with no developer and no redeploy. Everything I show is running against the real
> database."

> **UA:** «Це один продукт з двома сторонами. Клієнтська — покроковий 3D-конфігуратор: обрати
> будівлю, зайти в кімнату, вмеблювати, залишити заявку. Адмінська — повноцінна CMS, де весь
> каталог (будівлі, кімнати, меблі, ціни, правила підбору) налаштовується візуально, без
> розробника і без передеплою. Все, що показую, працює на реальній базі.»

---

# PART A — Customer flow / Клієнтський флоу

## A1. Entry: two questions (or a deep link)

**Show:** `/configurator` — the intake form. Then show the same thing via URL:
`/configurator?building=boxxplex&offices=8&restrooms=1`

> **Say:** "The customer answers two questions — how many offices, how many restrooms — and the
> system picks the closest fitting standard model. If they arrive from your website, the answers
> come in the link instead and this screen is skipped entirely. If they ask for more than the
> largest standard size, they don't get a broken configuration — they're routed to a custom-quote
> screen."

> **UA:** «Клієнт відповідає на два питання — скільки офісів і скільки санвузлів — і система
> підбирає найближчу відповідну стандартну модель. Якщо він приходить з вашого сайту, відповіді
> передаються прямо в посиланні, і цей екран пропускається. Якщо просить більше за найбільшу
> стандартну конфігурацію — він не отримує зламану сцену, його ведуть на екран індивідуального
> прорахунку.»

**Implemented:**
- Intake form: product line + unit count + restroom count.
- Rules engine (unit-tested): resolves input → the closest model; restrooms become mandatory at an
  admin-set threshold, a second restroom set at a higher one.
- Deep-link parameters `building` / `offices` / `units` / `restrooms` for iframe embedding, with
  backward compatibility for old `restrooms=true` links.
- Over-capacity screen → "request a custom quote" instead of a dead end.

---

## A2. The building — first look

**Show:** the loaded building. Point at the header plaque (name, unit count, dimensions, sq ft).

> **Say:** "The building loads with the camera exactly where the admin framed it, and the room
> labels are the invitation — one click and you're inside. Loading is progressive: the shell first,
> the roof separately, furniture models only when they're actually needed."

> **UA:** «Будівля завантажується з камерою рівно там, де її поставив адміністратор, а мітки кімнат
> — це запрошення: один клік і ти всередині. Завантаження поетапне: спочатку коробка, дах окремо,
> моделі меблів — лише коли вони реально потрібні.»

**Implemented:**
- Per-building default camera, orbit/zoom/angle limits authored in the admin.
- Room hotspots with the room's real name.
- Loading overlay tied to the model actually being in the scene (not just downloaded).
- Lazy loading: building glb on entry, roof on its own boundary, package glb only on add.
- Error boundary around the canvas — a broken texture can't blank the page.

---

## A3. Ways of looking at it

**Show:** the bottom bar — Overview / Top view / Side views (front, right, back, left) / Ceiling.

> **Say:** "Four ways of reading the same building: the dollhouse view, a top-down plan, the four
> elevations, and a ceiling-and-roof toggle so you can look straight down into the layout. This is
> the part that replaces the PDF floor plan."

> **UA:** «Чотири способи подивитись на одну й ту саму будівлю: об'ємний вигляд, вид зверху, чотири
> фасади і перемикач даху/стелі, щоб зазирнути всередину планування. Саме це замінює PDF з
> планом.»

**Implemented:**
- View modes: dollhouse / top / side ×4, animated camera transitions.
- Ceiling & roof toggle — works both for roof geometry marked inside the building model and for a
  roof supplied as a separate model.
- Camera limits keep the customer from flying under the floor or into orbit.

---

## A4. Stepping into a room

**Show:** click a room label. Header becomes a breadcrumb with "Back to building".

> **Say:** "This is the key technical decision. We don't cut the room out of the building model —
> we generate it: floor, walls, ceiling, door and window openings, all from the numbers the admin
> set. That means real interior finishes, real daylight through the windows, real 3D doors — and it
> works for any building model you upload later, without touching the file."

> **UA:** «Це ключове технічне рішення. Ми не вирізаємо кімнату з моделі будівлі — ми її
> генеруємо: підлога, стіни, стеля, дверні та віконні прорізи — все з параметрів, які задав
> адміністратор. Завдяки цьому маємо справжні внутрішні оздоблення, справжнє денне світло з вікон і
> справжні 3D-двері — і це працює для будь-якої нової моделі без правок самого файлу.»

**Implemented:**
- Generated room shell (synthetic room) with textured floor / walls / ceiling.
- Doors & windows: cut openings + optional real 3D door/window models fitted into them.
- Daylight simulation from a compass sun direction — windows on the sunny side cast light patches.
- Per-room camera preset: the visitor lands where the admin framed it.
- Multi-level buildings: each room carries its own floor level.
- Smooth veiled transition so the room is built off-screen, not in front of the customer.

---

## A5. Furnishing the room

**Show:** the catalogue (rail on desktop, sheet on mobile). Add a package. Show a "Too large for
this room" item.

> **Say:** "Only what belongs in this kind of room is offered — an office set isn't shown in a
> restroom. Anything that physically doesn't fit is greyed out and says so before the customer
> tries. Pictures are generated from the 3D models themselves, so a new package looks right in the
> catalogue the moment it's added, with no photoshoot."

> **UA:** «Пропонується лише те, що підходить саме цьому типу кімнати — офісний комплект не
> показується в санвузлі. Те, що фізично не влазить, — неактивне і одразу пояснює чому. Картинки
> генеруються з самих 3D-моделей, тож новий комплект виглядає в каталозі коректно одразу після
> додавання, без фотосесії.»

**Implemented:**
- Catalogue filtered by room type, product line and region.
- Fit check against the room outline before the item can be added.
- Auto thumbnails rendered from the model when no photo is uploaded.
- Auto-placement: the package lands in a free spot, walking outward from the room centre.
- Prices per package; list of what is already in this room, with one-tap remove.
- Responsive: desktop rail / mobile bottom sheet, safe-area aware.

---

## A6. Arranging it

**Show:** drag a package to a wall, rotate with the slider, drag it into another one (red outline),
select an item and press "Move to".

> **Say:** "Drag and it snaps to walls as you approach them, but never leaves the room. Rotation is
> a slider that clicks into right angles. Push one piece into another and the outline goes red and
> it won't be dropped there — the layout the customer sends you is always a physically valid one.
> And 'Move to' puts the camera at eye height in front of the selected piece."

> **UA:** «Тягнеш — і об'єкт притягується до стін, але ніколи не виходить за межі кімнати.
> Обертання — слайдер із фіксацією на прямих кутах. Насунеш один предмет на інший — контур
> червоніє, і поставити його там не вийде. Тобто планування, яке клієнт вам надсилає, завжди
> фізично коректне. А кнопка "Move to" ставить камеру на рівні очей перед обраним предметом.»

**Implemented:**
- Drag with progressive wall snapping and clamping to the room polygon.
- Collision detection between packages; invalid drop reverts to the last valid pose.
- Rotation slider with 90° detents, collision-aware.
- Select / remove toolbar floating over the item.
- Footprints measured from the model automatically (overridable per package in the admin).

---

## A7. Requesting a quote

**Show:** the quote button → summary + contact form → success state. Then open the quote in the
admin.

> **Say:** "The summary is built from what's actually in the building — every package, its room, its
> position and the total. The customer fills in contact details, and the request lands in three
> places at once: your admin panel, your CRM via a webhook, and the host page if the configurator is
> embedded in an iframe."

> **UA:** «Підсумок формується з того, що реально стоїть у будівлі — кожен комплект, його кімната,
> позиція і загальна сума. Клієнт заповнює контакти, і заявка потрапляє одразу в три місця: вашу
> адмінку, вашу CRM через webhook і на сторінку-хост, якщо конфігуратор вбудований в iframe.»

**Implemented:**
- Quote summary with per-package prices and total.
- Validated contact form (name + email required).
- Stored in the **Quotes** collection with the full configuration JSON.
- Webhook POST with custom headers (e.g. an API key); per-quote status `new` / `forwarded` /
  `webhook-failed`.
- `postMessage` to the embedding page for iframe integrations.

---

# PART B — Admin flow / Адмінський флоу

## B1. The admin panel

**Show:** `/admin` — the nav: Media, Catalog, Sales.

> **Say:** "One panel, three groups: the media library, the catalog, and sales. Nothing here needs a
> developer — a new building or a new furniture package is live the moment it's saved. No build, no
> deploy."

> **UA:** «Одна панель, три групи: медіатека, каталог і продажі. Тут ніде не потрібен розробник —
> нова будівля чи новий комплект меблів працює одразу після збереження. Без білду, без деплою.»

---

## B2. Uploading a 3D model

**Show:** Media → 3D Models → upload a folder (or a `.glb`). Show the preview and the meta line.

> **Say:** "You can drop in a plain `.glb`, or a whole exported folder — the gltf with its bin file
> and its textures folder — and we assemble it. FBX is converted in the browser before it's even
> sent. Then it's optimized automatically: geometry welded and de-duplicated, textures converted to
> WebP and capped at 2048, mesh compression applied. You see before/after size, triangle count and
> the model in a live viewer right in the form."

> **UA:** «Можна завантажити звичайний `.glb`, або цілу експортовану папку — gltf разом із bin і
> текстурами — ми зберемо це в один файл. FBX конвертується прямо в браузері ще до відправки. Далі
> модель оптимізується автоматично: злиття і дедуплікація геометрії, текстури в WebP до 2048,
> стиснення мешів. У формі одразу видно розмір до/після, кількість трикутників і саму модель у
> живому 3D-переглядачі.»

**Implemented:**
- Upload of `.glb`, self-contained `.gltf`, multi-file glTF folders, and `.fbx` (browser-side
  conversion to glb).
- Automatic optimization pipeline (dedup, prune, weld, WebP textures ≤2048px, meshopt).
- Recorded metadata: triangles, meshes, materials, textures, bounding box, size before/after.
- Inline 3D preview on models, building models and furniture packages.
- Direct-to-storage uploads, so large files don't go through the app server.

---

## B3. Product line and its rules

**Show:** Catalog → Product Lines → a line with `restroomsRequiredAt`, `secondRestroomSetAt`,
`maxUnits`.

> **Say:** "This is where the sales logic lives. Restrooms become mandatory from this many units, a
> second set from this many, and above this number we stop offering a standard model and route the
> lead to your team. Business rules, edited by your sales people, not hard-coded."

> **UA:** «Тут живе комерційна логіка. Санвузли стають обов'язковими з такої-то кількості юнітів,
> другий комплект — з такої-то, а вище цього числа ми перестаємо пропонувати стандартну модель і
> ведемо клієнта до вашої команди. Це бізнес-правила, які редагують продажники, а не захардкожений
> код.»

---

## B4. A building model + the Scene Editor (building level)

**Show:** Catalog → Building Models → open one → **Scene Editor** tab.

> **Say:** "This is the heart of the admin side — a visual editor over the uploaded model. Switch to
> the 2D plan, draw a room by clicking its outline on the floor, and it becomes a room the customer
> can enter. Rooms on a second storey get their own floor level. The roof is handled either way: mark
> which objects of the model are roof, or place a separate roof model with a gizmo. And the outliner
> lets you hide anything in the file you don't want on screen — without editing the file."

> **UA:** «Це серце адмінки — візуальний редактор поверх завантаженої моделі. Перемикаєшся у 2D-план,
> обводиш кімнату кліками по підлозі — і вона стає кімнатою, в яку може зайти клієнт. Кімнати другого
> поверху отримують свій рівень підлоги. Дах підтримується у двох варіантах: або позначаєш, які
> об'єкти моделі є дахом, або ставиш окрему модель даху за допомогою гізмо. А в списку об'єктів можна
> сховати будь-що з файлу, не редагуючи сам файл.»

**Implemented:**
- 2D plan / 3D toggle, room drawing by clicking the floor, editable vertices (move / insert / delete).
- Floor levels for multi-storey buildings.
- Roof: volumes selected from model objects **or** a separate roof model with move/rotate/scale/fit.
- Model outliner with hide/show, multi-select, right-click actions ("new room from object").
- Default camera "set from current view" + orbit/zoom/angle limits.
- Undo, and everything saved as one document.

---

## B5. Scene Editor (room level)

**Show:** enter a room in the editor → openings toolbar, surfaces, daylight, room camera.

> **Say:** "Inside a room you set what the customer will actually see: place doors and windows on
> the walls, assign real 3D door and window models, apply floor, wall and ceiling textures with the
> tiling in real metres, set which compass direction the sun is on, and finally frame the camera and
> capture it — that's where the visitor lands when they step in."

> **UA:** «Всередині кімнати задається все, що побачить клієнт: розставляєш двері та вікна по
> стінах, призначаєш реальні 3D-моделі дверей і вікон, накладаєш текстури підлоги, стін і стелі з
> розміром плитки в реальних метрах, вказуєш, з якого боку сонце, і наостанок кадруєш камеру та
> зберігаєш її — саме там опиниться відвідувач, коли зайде.»

**Implemented:**
- Door/window placement per wall, with width, height, sill; drag along the wall.
- 3D door/window models with fit modes (fill the opening / keep proportions / author's size),
  yaw and depth offset.
- Textures per surface (interior wall / floor / ceiling) with real-world tile size.
- Room dimensions, wall height/thickness, floor and ceiling thickness.
- Sun direction per room → daylight and sun patches through the windows.
- Room type (drives which furniture is offered) and per-room camera preset.

---

## B6. Furniture packages

**Show:** Catalog → Furniture Packages → a package with model, price, footprint, compatibility.

> **Say:** "A package is a model, a price and a set of compatibility rules — which room types, which
> product lines, which regions. The floor footprint used for the fit and collision checks is
> measured from the model automatically on save; you only override it if you want a bigger clearance."

> **UA:** «Комплект — це модель, ціна і правила сумісності: які типи кімнат, які продуктові лінійки,
> які регіони. Габарит на підлозі, за яким рахуються вміщення і колізії, вимірюється з моделі
> автоматично при збереженні; перевизначати його треба лише коли хочеш більший запас.»

---

## B7. Quotes and delivery

**Show:** Sales → Quotes (the one just submitted) → Sales → Integration Settings.

> **Say:** "Every request is here with the customer's contact details and the full configuration —
> every package, in which room, at which coordinates. And here you point it at your CRM: a webhook
> URL, any headers you need, and the iframe messaging settings. Status tells you whether the
> hand-off actually went through."

> **UA:** «Кожна заявка тут — з контактами клієнта і повною конфігурацією: кожен комплект, у якій
> кімнаті, з якими координатами. А тут це спрямовується у вашу CRM: URL вебхука, будь-які потрібні
> заголовки і налаштування повідомлень для iframe. Статус показує, чи передача реально пройшла.»

---

# PART C — Integration / Інтеграція (2 min)

> **Say:** "Integration is one iframe tag. Pre-fill it from your own site's forms through the URL,
> and receive the finished configuration back either as a webhook to your CRM or as a browser event
> on the host page. Uploads are served from CDN storage, so it stays fast wherever your customers
> are."

> **UA:** «Інтеграція — це один тег iframe. Передзаповнюєте його з форм власного сайту через URL, а
> готову конфігурацію отримуєте назад або вебхуком у CRM, або браузерною подією на сторінці-хості.
> Файли віддаються з CDN-сховища, тож швидко працює незалежно від того, де ваші клієнти.»

```html
<iframe
  src="https://your-domain.com/configurator?building=boxxplex&offices=8&restrooms=1"
  style="width:100%;height:100dvh;border:0"
  allow="fullscreen"
></iframe>
```

---

## Closing

> **Say:** "To sum up: the customer gets a guided 3D experience that ends in a qualified, physically
> valid lead. Your team gets a catalog they own end to end — upload a model, draw the rooms, set the
> prices and rules, and it's live. Nothing in the flow you've just seen requires a developer."

> **UA:** «Підсумок: клієнт отримує керований 3D-досвід, який завершується кваліфікованою і фізично
> коректною заявкою. Ваша команда отримує каталог, яким володіє повністю — завантажив модель,
> обвів кімнати, задав ціни і правила, і воно вже в бою. Нічого з того, що ви щойно бачили, не
> потребує розробника.»

---

## Quick answers to likely questions / Швидкі відповіді

| Question | Answer |
|---|---|
| Can we add a new building ourselves? | Yes — upload the model, draw the rooms in the Scene Editor, save. Live immediately. / Так — завантажити модель, обвести кімнати в Scene Editor, зберегти. Одразу в бою. |
| Does it work on phones? | Yes — the whole customer flow is responsive (bottom sheet catalogue, icon-only controls). / Так, весь клієнтський флоу адаптивний. |
| What model formats? | `.glb`, self-contained `.gltf`, glTF folders, `.fbx` (converted on upload). / `.glb`, самодостатній `.gltf`, папки glTF, `.fbx`. |
| Multi-storey? | Yes — rooms carry their own floor level. / Так — кожна кімната має власний рівень підлоги. |
| Where does the lead go? | Admin panel + webhook to your CRM + postMessage to the host page. / Адмінка + вебхук у CRM + postMessage на сторінку-хост. |
| Multiple markets? | Regions on lines, models and packages control what is offered where. / Регіони на лінійках, моделях і комплектах керують тим, що і де пропонується. |
