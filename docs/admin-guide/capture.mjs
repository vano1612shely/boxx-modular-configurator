/**
 * Captures the guide's screenshots from a running app.
 *
 *   node docs/admin-guide/capture.mjs              # every public recipe
 *   node docs/admin-guide/capture.mjs 03-quiz-step2
 *
 * Recipes live in shots.config.mjs, so a screen can be re-photographed exactly
 * as it was after the admin changes — which it will. Rings and numbers are drawn
 * into the live page by lib/annotate.js, so they land on the element rather than
 * on guessed pixel coordinates, and the numbers match the figure captions.
 *
 * Recipes marked `auth: true` need a signed-in session and are skipped here;
 * those are taken through the browser pane instead.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { isSignedIn, withPage } from './lib/chrome.mjs'
import { RECIPES } from './shots.config.mjs'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const IMG = path.join(ROOT, 'img')

const signedIn = isSignedIn()
const wanted = process.argv.slice(2)

const asked = RECIPES.filter((recipe) => wanted.length === 0 || wanted.includes(recipe.name))
const chosen = asked.filter((recipe) => !recipe.auth || signedIn)
const skipped = asked.length - chosen.length

if (skipped > 0) {
  console.log(`Skipping ${skipped} screen(s) behind the login — run login.mjs first.\n`)
}

if (chosen.length === 0) process.exit(0)

const annotate = await readFile(path.join(ROOT, 'lib', 'annotate.js'), 'utf8')
await mkdir(IMG, { recursive: true })

for (const recipe of chosen) {
  const file = path.join(IMG, `${recipe.name}.png`)

  await withPage(recipe.url, async (send) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width: recipe.width ?? 1280,
      height: recipe.height ?? 800,
      deviceScaleFactor: 2,
      mobile: false,
    })

    // The dev-server badge floats over every page and belongs in no figure.
    await send('Runtime.evaluate', {
      expression: `(() => {
        const style = document.createElement('style')
        style.textContent = 'nextjs-portal, [data-nextjs-toast] { display: none !important }'
        document.head.appendChild(style)
      })()`,
    })

    for (const step of recipe.steps ?? []) {
      if (step.wait) {
        await send('Runtime.evaluate', {
          expression: `new Promise((done) => setTimeout(done, ${step.wait}))`,
          awaitPromise: true,
        })
      }
      // A 3D scene has no elements to select by — a room is pixels on a canvas —
      // so those steps aim at a point instead.
      if (step.clickAt) {
        const [x, y] = step.clickAt
        for (const type of ['mousePressed', 'mouseReleased']) {
          await send('Input.dispatchMouseEvent', {
            type,
            x,
            y,
            button: 'left',
            clickCount: 1,
            buttons: type === 'mousePressed' ? 1 : 0,
          })
        }
      }
      if (step.click) {
        const { result } = await send('Runtime.evaluate', {
          expression: `${annotate};
            (() => {
              const node = ${JSON.stringify(step.click)}.startsWith('text=')
                ? [...document.querySelectorAll('button,a,label,[role=radio]')]
                    .find((n) => (n.textContent ?? '').trim() === ${JSON.stringify(step.click)}.slice(5))
                : document.querySelector(${JSON.stringify(step.click)})
              if (!node) return 'not found'
              node.click()
              return 'clicked'
            })()`,
        })
        if (result.value !== 'clicked') throw new Error(`${recipe.name}: click ${step.click} — ${result.value}`)
      }
    }

    // Settled first, annotated second: a ring measured before the layout stops
    // moving ends up beside the thing it is meant to circle.
    await send('Runtime.evaluate', {
      expression: `new Promise((done) => requestAnimationFrame(() => setTimeout(done, 250)))`,
      awaitPromise: true,
    })

    for (const [selector, label, options] of recipe.marks ?? []) {
      const { result } = await send('Runtime.evaluate', {
        expression: `${annotate}; window.__guide.mark(
          ${JSON.stringify(selector)},
          ${label === undefined ? 'undefined' : JSON.stringify(label)},
          ${JSON.stringify(options ?? {})})`,
      })
      if (result.value !== 'ok') console.warn(`  ! ${recipe.name}: ${result.value}`)
    }

    // A screen centred in a wide viewport is mostly background, and a figure
    // scaled to fit the page turns that background into wasted column width.
    // `clip` frames the thing being explained instead.
    let clip
    if (recipe.clip) {
      const { selector, pad = 32 } = recipe.clip
      const { result } = await send('Runtime.evaluate', {
        expression: `(() => {
          const node = document.querySelector(${JSON.stringify(selector)})
          if (!node) return null
          const b = node.getBoundingClientRect()
          return JSON.stringify({ x: b.left, y: b.top, width: b.width, height: b.height })
        })()`,
      })
      if (!result.value) throw new Error(`${recipe.name}: clip target ${selector} not found`)
      const box = JSON.parse(result.value)
      clip = {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width: box.width + pad * 2,
        height: box.height + pad * 2,
        // The emulated device is already retina; clip scale multiplies on top.
        scale: 1,
      }
    }

    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: Boolean(recipe.fullPage),
      ...(clip ? { clip } : {}),
    })
    await writeFile(file, Buffer.from(shot.data, 'base64'))
  }, { signedIn: Boolean(recipe.auth) })

  console.log(`  ✓ ${recipe.name}.png`)
}

console.log(`\n${chosen.length} captured → ${path.relative(process.cwd(), IMG)}`)
