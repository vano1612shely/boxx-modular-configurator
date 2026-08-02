import { LoadingManager, type Object3D } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js'

const TEXTURE = /\.(jpe?g|png|webp|tga|dds|bmp|gif|avif)$/i

function basename(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path
}

/** Metres per file unit. FBX UnitScaleFactor: 1 = cm, 100 = m, 2.54 = inch; FBXLoader never applies it. */
export function metresPerUnit(unitScaleFactor: unknown): number {
  if (typeof unitScaleFactor !== 'number' || !Number.isFinite(unitScaleFactor)) return 1
  if (unitScaleFactor <= 0) return 1
  return unitScaleFactor / 100
}

// FBXLoader writes unitScaleFactor on the root it builds, then returns the lone
// child instead, so the factor is usually only on an ancestor.
export function readUnitScale(object: Object3D | null): number {
  for (let at = object; at; at = at.parent) {
    const factor = (at.userData as { unitScaleFactor?: unknown } | undefined)?.unitScaleFactor
    if (typeof factor === 'number' && Number.isFinite(factor) && factor > 0) {
      return metresPerUnit(factor)
    }
  }
  return 1
}

export function buildTextureIndex(
  files: ReadonlyArray<{ path: string; url: string }>,
): Map<string, string> {
  const index = new Map<string, string>()

  for (const file of files) {
    const path = file.path.replace(/\\/g, '/').toLowerCase()
    // FBX stores absolute authoring paths, so the bare name is often the only match.
    index.set(path, file.url)
    if (!index.has(basename(path))) index.set(basename(path), file.url)
  }

  return index
}

export type ConversionResult = {
  data: ArrayBuffer
  name: string
  scale: number
}

export async function convertFbxToGlb(
  fbx: { path: string; data: ArrayBuffer },
  siblings: ReadonlyArray<{ path: string; file: Blob }>,
): Promise<ConversionResult> {
  const urls: string[] = []

  const textures = siblings
    .filter((entry) => TEXTURE.test(entry.path))
    .map((entry) => {
      const url = URL.createObjectURL(entry.file)
      urls.push(url)
      return { path: entry.path, url }
    })

  const index = buildTextureIndex(textures)

  try {
    const manager = new LoadingManager()
    manager.setURLModifier((url) => {
      const cleaned = url.replace(/\\/g, '/').toLowerCase()
      return index.get(cleaned) ?? index.get(basename(cleaned)) ?? url
    })
    // TGALoader is not registered by default; without it the loader drops .tga maps.
    manager.addHandler(/\.tga$/i, new TGALoader(manager))

    const object: Object3D = new FBXLoader(manager).parse(fbx.data, '')

    const scale = readUnitScale(object)
    if (scale !== 1) object.scale.multiplyScalar(scale)

    const exported = await new GLTFExporter().parseAsync(object, { binary: true })
    const data =
      exported instanceof ArrayBuffer
        ? exported
        : new TextEncoder().encode(JSON.stringify(exported)).buffer

    return {
      data: data as ArrayBuffer,
      name: basename(fbx.path).replace(/\.fbx$/i, '.glb'),
      scale,
    }
  } finally {
    for (const url of urls) URL.revokeObjectURL(url)
  }
}
