---
name: env-quirks-3d-configurator
description: "Особливості середовища розробки на цій Windows-машині (браузер, curl, pnpm, Payload)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3a0addd5-7836-458e-a818-4557207456c5
  modified: 2026-07-23T13:55:53.702Z
---

Особливості середовища проєкту [[project-3d-configurator-state]]:

- Вбудований Browser pane НЕ фаєрить requestAnimationFrame (фоновий тротлінг) — R3F/three там не рендеряться і скріншоти таймаутяться. Для перевірки 3D використовувати Claude in Chrome (реальний Chrome), там усе працює.
- Windows curl у Git Bash не відкриває POSIX-шляхи `/c/...` у `-F file=@...` — для multipart потрібен шлях `C:/...` (симптом: HTTP 000).
- `create-payload-app` падає з TTY-помилкою у неінтерактивному шеллі — темплейт брати через degit (`payloadcms/payload/templates/blank`), але темплейт з HEAD має `workspace:*` версії та API новіші за published (напр. `generatePayloadViewport`, `payload build` не існують у 3.86 — build script має бути `next build`).
- pnpm 11: build-дозволи в `pnpm-workspace.yaml` (`allowBuilds:`), поле `pnpm.onlyBuiltDependencies` у package.json ігнорується.
- Порт 3000 зайнятий стороннім node-процесом — dev-сервер працює через autoPort (у сесії був 57693).
- У drei `useGLTF(url, false, true)` — meshopt-декодер локальний; draco вимкнено щоб не тягнути CDN.
- Камера-драг конфлікт: при drag об'єктів у R3F треба `event.nativeEvent.stopImmediatePropagation()` бо CameraControls слухає той самий canvas.
- camera-controls: точний top-view (polar = 0) — вироджена поза; перехід з неї у side view вішає main thread (нескінченна нормалізація кутів). Завжди лишати нахил ≥2-3°.
- @react-three/postprocessing 3.0.4 + three 0.185: EffectComposer віддає прозорий кадр (несумісність) — обводку робити inverted-hull клоном (BackSide-матеріал, scale 1.035).
- Скріншоти вкладки з WebGL у Claude-in-Chrome періодично віддають stale/порожній кадр — перед кліком по 3D-оверлеях робити свіжий скріншот і чекати 2-3с після HMR.
- Скріншоти Claude-in-Chrome масштабовані до ширини 1568px, а вікно реально ширше (було 1920) — для синтетичних PointerEvent координати зі скріншота множити на `innerWidth/1568` (≈1.2245). Реальні `computer`-кліки масштабуються самі; це стосується лише dispatchEvent з javascript_tool.
- Якщо вікно Chrome згорнуте/перекрите: `document.hidden === true`, rAF зупинений, R3F Canvas не ініціалізується (canvas лишається 300×150, glb навіть не фетчиться), скріншоти таймаутяться, а довгі evaluate можуть висіти (Energy Saver freeze). Відновити вікно: PowerShell `ShowWindowAsync(hwnd, 9)`; нова вкладка `tabs_create_mcp` відкривається активною.
- Синтетичні pointer-події для R3F-драгів не можна диспатчити всі в одному синхронному таску — React батчить setState і drag-стан не встигає закомітитись; між подіями потрібні `await sleep(20-30ms)`.
- javascript_tool (Claude-in-Chrome) на async-виразах з довгими await часто повертає `{}` замість результату — результат класти у `window.__x` і читати другим синхронним викликом.
- Коли вікно Chrome користувача приховане, WebGL можна верифікувати headless: `chrome.exe --headless=new --remote-debugging-port=9333 --enable-unsafe-swiftshader` + CDP через node 22 global WebSocket (готовий harness: scratchpad/cdp.mjs + repro-*.mjs — навігація, evaluate, скріншоти, консоль; rAF і glb там працюють).
- React 19 StrictMode (Next dev) викликає useMemo-фабрики ДВІЧІ і зберігає результат ПЕРШОГО виклику; side-effects (patch матеріалів, onBeforeCompile) від другого виклику перезаписують перший → контролери/uniforms розсинхронізуються. Будь-яка "patch scene" функція (applyZoneClipping) мусить бути ідемпотентною (кеш у root.userData).
- Кнопки-рядки у flex-колонці з maxHeight стискаються в нуль (form-елементи без auto min-content захисту) — обовʼязково `flexShrink: 0`.
- Дебаг автопланувальника стін на реальних даних: у адмін-редакторі `window.__editorNodes` віддає flatten-список нод (шляхи + світові AABB, включно з віртуальними частинами розрізів). Рецепт: дампнути через CDP (scratchpad/dump-nodes.mjs) → прогнати чистий planRoomWalls у ноді (scratchpad/replay-plan.ts, `npx tsx` з АБСОЛЮТНИМ шляхом імпорту — відносні з-поза кореня не резолвляться).
