/**
 * Crunches a .glb before it is uploaded.
 *
 * This used to happen on the server, inside the upload request. That worked
 * only while models were small: the pipeline re-encodes every texture and
 * recompresses all the geometry, which on a large model is minutes of CPU and
 * hundreds of megabytes of memory — neither of which a serverless function
 * has. Uploads now go from the browser straight to the bucket and never reach
 * our code, so the crunching moved here, where it can take as long as it needs.
 *
 * Usage:
 *   pnpm optimize:model <input.glb> [output.glb]
 *
 * With no output path it writes <input>.optimized.glb and leaves the original
 * alone — overwriting the only copy of an asset because a flag was forgotten is
 * not a thing this should be able to do.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'

import { optimizeGlb } from '../src/modules/media/lib/optimize-model'

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

async function main() {
  const [inputArg, outputArg] = process.argv.slice(2)

  if (!inputArg) {
    console.error('Usage: pnpm optimize:model <input.glb> [output.glb]')
    process.exit(1)
  }

  const input = resolve(inputArg)
  const output = outputArg
    ? resolve(outputArg)
    : resolve(input.replace(new RegExp(`${extname(input)}$`), '.optimized.glb'))

  const source = readFileSync(input)
  console.log(`${basename(input)} — ${mb(source.byteLength)}`)

  const started = Date.now()
  const { output: optimized, meta } = await optimizeGlb(source)
  const seconds = ((Date.now() - started) / 1000).toFixed(1)

  writeFileSync(output, optimized)

  const saved = 1 - meta.sizeAfter / meta.sizeBefore
  console.log(
    `${basename(output)} — ${mb(meta.sizeAfter)} (${(saved * 100).toFixed(0)}% smaller, ${seconds}s)`,
  )
  console.log(
    `  ${meta.triangles.toLocaleString()} triangles · ${meta.meshes} meshes · ` +
      `${meta.materials} materials · ${meta.textures} textures`,
  )
  console.log(
    `  bounds ${meta.bboxMin.map((n) => n.toFixed(2)).join(', ')} → ` +
      `${meta.bboxMax.map((n) => n.toFixed(2)).join(', ')}`,
  )
}

void main()
