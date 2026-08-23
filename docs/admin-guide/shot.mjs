/**
 * Photographs the assembled guide for design review.
 *
 *   node docs/admin-guide/shot.mjs [firstPage] [lastPage]
 *
 * The viewport is the printed text column exactly — A4 less the 18 mm side
 * margins — so what these images show is what the PDF sets, minus the page
 * breaks. One PNG per screenful, written to ./.build/shots.
 */

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { withPage } from './lib/chrome.mjs'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const BUILD = path.join(ROOT, '.build')
const SHOTS = path.join(BUILD, 'shots')

// A4 is 210 mm wide and the stylesheet reserves 18 mm each side; at 96 dpi the
// remaining column is this many pixels. Height is one A4 text block at the same
// scale, so each image is about one printed page.
const WIDTH = Math.round((210 / 25.4) * 96)
const HEIGHT = Math.round((297 / 25.4) * 96)

const first = Number(process.argv[2] ?? 1)
const last = Number(process.argv[3] ?? 0)

await rm(SHOTS, { recursive: true, force: true })
await mkdir(SHOTS, { recursive: true })

const url = pathToFileURL(path.join(BUILD, 'guide.html')).href

const written = await withPage(url, async (send) => {
  await send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 2,
    mobile: false,
  })

  const { result } = await send('Runtime.evaluate', {
    expression: 'document.documentElement.scrollHeight',
  })
  const total = Math.ceil(result.value / HEIGHT)
  const stop = last > 0 ? Math.min(last, total) : total

  const files = []
  for (let index = first; index <= stop; index += 1) {
    await send('Runtime.evaluate', {
      expression: `window.scrollTo(0, ${(index - 1) * HEIGHT})`,
    })
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    const file = path.join(SHOTS, `${String(index).padStart(2, '0')}.png`)
    await writeFile(file, Buffer.from(shot.data, 'base64'))
    files.push(file)
  }

  return { files, total }
})

console.log(`${written.files.length} of ${written.total} screenfuls → ${path.relative(process.cwd(), SHOTS)}`)
for (const file of await readdir(SHOTS)) console.log(`  ${file}`)
