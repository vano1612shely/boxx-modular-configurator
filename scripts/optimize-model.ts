import { statSync, writeFileSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'

import { optimizeModelFile } from '../src/modules/media/lib/optimize-model'

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

async function main() {
  const [inputArg, outputArg] = process.argv.slice(2)

  if (!inputArg) {
    console.error('Usage: pnpm optimize:model <input.gltf|input.glb> [output.glb]')
    process.exit(1)
  }

  const input = resolve(inputArg)
  const output = outputArg
    ? resolve(outputArg)
    : resolve(input.replace(new RegExp(`${extname(input)}$`), '.optimized.glb'))

  console.log(`${basename(input)} — ${mb(statSync(input).size)}`)

  const started = Date.now()
  const { output: optimized, meta } = await optimizeModelFile(input)
  const seconds = ((Date.now() - started) / 1000).toFixed(1)

  writeFileSync(output, optimized)

  // A .gltf's own size is only its JSON, so a percentage against it is meaningless.
  const packed = extname(input).toLowerCase() === '.gltf'
  const saved = 1 - meta.sizeAfter / meta.sizeBefore
  console.log(
    `${basename(output)} — ${mb(meta.sizeAfter)} ` +
      `(${packed ? 'everything embedded' : `${(saved * 100).toFixed(0)}% smaller`}, ${seconds}s)`,
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
