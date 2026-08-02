import { describe, expect, it } from 'vitest'

import { Group, Object3D } from 'three'

import { buildTextureIndex, metresPerUnit, readUnitScale } from './fbx-to-glb'

describe('metresPerUnit', () => {
  it('shrinks a model authored in centimetres', () => {
    expect(metresPerUnit(1)).toBeCloseTo(0.01, 9)
  })

  it('leaves a model already in metres alone', () => {
    expect(metresPerUnit(100)).toBe(1)
  })

  it('converts inches', () => {
    expect(metresPerUnit(2.54)).toBeCloseTo(0.0254, 9)
  })

  it('changes nothing when the file does not say', () => {
    expect(metresPerUnit(undefined)).toBe(1)
    expect(metresPerUnit(0)).toBe(1)
    expect(metresPerUnit(-5)).toBe(1)
    expect(metresPerUnit(Number.NaN)).toBe(1)
    expect(metresPerUnit('100')).toBe(1)
  })
})

describe('readUnitScale', () => {
  it('reads the factor off the object it was given', () => {
    const object = new Group()
    object.userData.unitScaleFactor = 1

    expect(readUnitScale(object)).toBeCloseTo(0.01, 9)
  })

  it('finds it on the root the loader threw away', () => {
    const discardedRoot = new Group()
    discardedRoot.userData.unitScaleFactor = 1
    const returned = new Group()
    discardedRoot.add(returned)

    expect(readUnitScale(returned)).toBeCloseTo(0.01, 9)
  })

  it('takes the nearest answer when more than one ancestor has said', () => {
    const outer = new Group()
    outer.userData.unitScaleFactor = 1
    const inner = new Group()
    inner.userData.unitScaleFactor = 100
    outer.add(inner)
    const leaf = new Object3D()
    inner.add(leaf)

    expect(readUnitScale(leaf)).toBe(1)
  })

  it('leaves a model alone when nothing in the chain says', () => {
    expect(readUnitScale(new Group())).toBe(1)
    expect(readUnitScale(null)).toBe(1)
  })
})

describe('buildTextureIndex', () => {
  const entry = (path: string) => ({ path, url: `blob:${path}` })

  it('finds a texture by the absolute path the FBX was authored with', () => {
    const index = buildTextureIndex([entry('textures/wall.jpg')])

    expect(index.get('wall.jpg')).toBe('blob:textures/wall.jpg')
  })

  it('matches whatever case the exporter wrote', () => {
    const index = buildTextureIndex([entry('Textures/Wall.TGA')])

    expect(index.get('wall.tga')).toBe('blob:Textures/Wall.TGA')
    expect(index.get('textures/wall.tga')).toBe('blob:Textures/Wall.TGA')
  })

  it('keeps the full path distinct when two folders hold the same name', () => {
    const index = buildTextureIndex([entry('a/wall.jpg'), entry('b/wall.jpg')])

    expect(index.get('a/wall.jpg')).toBe('blob:a/wall.jpg')
    expect(index.get('b/wall.jpg')).toBe('blob:b/wall.jpg')
    expect(index.get('wall.jpg')).toBe('blob:a/wall.jpg')
  })

  it('reads Windows separators as the paths they mean', () => {
    const index = buildTextureIndex([entry('textures\\wall.jpg')])

    expect(index.get('textures/wall.jpg')).toBe('blob:textures\\wall.jpg')
  })
})
