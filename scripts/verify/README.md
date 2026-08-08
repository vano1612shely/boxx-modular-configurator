# Looking at the 3D scene from a script

Neither of the obvious routes works for this project:

- **The in-app browser pane never fires `requestAnimationFrame`.** R3F therefore
  never renders, the Canvas stays 300×150, the glb is not even fetched, and
  screenshots time out. Anything WebGL is invisible there.
- **A visible Chrome window** works, but needs the machine's real desktop, so it
  cannot be driven from a headless session.

What does work is headless Chrome over CDP. `cdp.mjs` is the whole driver:
launch, attach, navigate, evaluate, screenshot.

```js
import { attach, launch, sleep } from './cdp.mjs'

await launch()
const page = await attach()
await page.goto('http://localhost:3000/configurator?building=boxxplex')
await page.screenshot('shot.png')
```

`launch()` reuses an instance that is already holding the debugging port, so a
run never silently attaches to a previous run's stale page.

## Reaching the camera

The interesting assertions are about the camera, and nothing puts it on
`window`. R3F keeps its state in a zustand store that belongs to a *second*
reconciler, whose fiber tree is not connected to the DOM's — so walking up from
the canvas element does not find it.

R3F does register that reconciler with the React DevTools hook. Installing a
stub of that hook **before any page script runs** captures it, and the r3f
root's `containerInfo` *is* the store:

```js
await page.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__renderers = new Map()
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      renderers: window.__renderers,
      inject(r) { const id = window.__renderers.size + 1; window.__renderers.set(id, r); return id },
      onCommitFiberRoot(id, root) { (window.__roots = window.__roots || new Map()).set(id, root) },
      onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDCE() {},
    }`,
})
```

Then, in the page:

```js
for (const [, root] of window.__roots ?? []) {
  const c = root.containerInfo
  if (c && typeof c.getState === 'function') {
    const s = c.getState()
    if (s && s.camera && s.gl) return s // s.controls is the CameraControls
  }
}
```

## Things that will waste an afternoon

- **`s.controls` goes null when the WebGL context is lost**, and entering a room
  loses it in headless Chrome — on a real GPU as well as under SwiftShader.
  Reproduces on paths nobody has touched, so treat it as an artefact of headless
  rather than a bug in the app; a normal browser is fine. Poll for the store
  instead of assuming it is there, and read a pose soon after the interaction.
- **Room markers are DOM elements over the canvas.** A click aimed at the
  projected centre of a room hits the `+` chip, not the floor. Walk in from a
  corner until `document.elementFromPoint` says `CANVAS`.
- **Damping is slow under SwiftShader.** The *commanded* angle
  (`controls._sphericalEnd`) is exact immediately; the current one is still
  travelling seconds later. Assert on the command, not the position.
- **`Input.dispatchMouseEvent` with `button: 'right'`** did not reach
  camera-controls' OFFSET action in testing — the drag arrived as a rotate. Set
  the focal offset directly and let a bare press trigger the rig's own
  correction instead.
- **Tailwind v4 writes `translate`, not `transform`.** `getComputedStyle(el).transform`
  reads `none` for `-translate-y-full`.
- Kill the browser at the end (`page.send('Browser.close')`), or the next run
  attaches to it.
