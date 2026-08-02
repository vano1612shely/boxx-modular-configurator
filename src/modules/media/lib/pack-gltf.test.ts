import { describe, expect, it } from 'vitest'

import { findModelEntry, resolveGltfResources, type FolderFile } from './pack-gltf'

const file = (path: string, byte = 1): FolderFile => ({ path, data: new Uint8Array([byte]) })

const GLTF = JSON.stringify({
  asset: { version: '2.0' },
  buffers: [{ uri: 'scene.bin', byteLength: 1 }],
  images: [{ uri: 'textures/wall_in_baseColor.jpeg' }, { uri: 'textures/floor_baseColor.jpeg' }],
})

describe('findModelEntry', () => {
  it('finds the model the rest of the folder belongs to', () => {
    const entry = findModelEntry([
      file('scene/textures/wall.jpeg'),
      file('scene/scene.gltf'),
      file('scene/scene.bin'),
    ])

    expect(entry.path).toBe('scene/scene.gltf')
  })

  it('refuses a folder holding two models rather than guess', () => {
    expect(() => findModelEntry([file('a/one.gltf'), file('b/two.glb')])).toThrow(
      /holds 2 models — one\.gltf, two\.glb/,
    )
  })

  it('says so when there is no model at all', () => {
    expect(() => findModelEntry([file('textures/wall.jpeg')])).toThrow(/No \.gltf or \.glb/)
  })
})

describe('resolveGltfResources', () => {
  it('matches every file the glTF asks for', () => {
    const { resources, missing } = resolveGltfResources('scene.gltf', GLTF, [
      file('scene.gltf'),
      file('scene.bin', 2),
      file('textures/wall_in_baseColor.jpeg', 3),
      file('textures/floor_baseColor.jpeg', 4),
    ])

    expect(missing).toEqual([])
    expect(Object.keys(resources).sort()).toEqual([
      'scene.bin',
      'textures/floor_baseColor.jpeg',
      'textures/wall_in_baseColor.jpeg',
    ])
    expect(resources['scene.bin'][0]).toBe(2)
  })

  it('resolves relative to the model, not to the folder that was picked', () => {
    const { resources, missing } = resolveGltfResources('export/v3/scene.gltf', GLTF, [
      file('export/v3/scene.gltf'),
      file('export/v3/scene.bin'),
      file('export/v3/textures/wall_in_baseColor.jpeg'),
      file('export/v3/textures/floor_baseColor.jpeg'),
      file('export/scene.bin', 9),
    ])

    expect(missing).toEqual([])
    expect(resources['scene.bin'][0]).toBe(1)
  })

  it('matches a percent-encoded URI against the real filename', () => {
    const json = JSON.stringify({
      asset: { version: '2.0' },
      images: [{ uri: 'textures/wall%20in.jpeg' }],
    })

    const { resources, missing } = resolveGltfResources('scene.gltf', json, [
      file('scene.gltf'),
      file('textures/wall in.jpeg', 7),
    ])

    expect(missing).toEqual([])
    expect(resources['textures/wall%20in.jpeg'][0]).toBe(7)
  })

  it('reads Windows separators as the paths they mean', () => {
    const { missing } = resolveGltfResources('scene\\scene.gltf', GLTF, [
      file('scene\\scene.gltf'),
      file('scene\\scene.bin'),
      file('scene\\textures\\wall_in_baseColor.jpeg'),
      file('scene\\textures\\floor_baseColor.jpeg'),
    ])

    expect(missing).toEqual([])
  })

  it('names what is missing, decoded, so it can be looked for', () => {
    const { missing } = resolveGltfResources('scene.gltf', GLTF, [
      file('scene.gltf'),
      file('scene.bin'),
    ])

    expect(missing).toEqual(['textures/wall_in_baseColor.jpeg', 'textures/floor_baseColor.jpeg'])
  })

  it('ignores data URIs, which are already inside the file', () => {
    const json = JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ uri: 'data:application/octet-stream;base64,AAAA' }],
    })

    const { resources, missing } = resolveGltfResources('scene.gltf', json, [file('scene.gltf')])

    expect(missing).toEqual([])
    expect(Object.keys(resources)).toEqual([])
  })
})
