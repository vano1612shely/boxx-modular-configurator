import { Group, Mesh, PerspectiveCamera, PointLight, SpotLight } from 'three'
import { describe, expect, it } from 'vitest'

import { stripNonVisual } from './strip-non-visual'

describe('stripNonVisual', () => {
  it('takes out the lights an FBX brought with it', () => {
    const root = new Group()
    const mesh = new Mesh()
    root.add(mesh, new PointLight(), new SpotLight())

    expect(stripNonVisual(root)).toBe(2)
    expect(root.children).toEqual([mesh])
  })

  it('takes out cameras too', () => {
    const root = new Group()
    root.add(new PerspectiveCamera())

    expect(stripNonVisual(root)).toBe(1)
    expect(root.children).toHaveLength(0)
  })

  // Authoring scenes nest: the lamp is rarely a child of the root itself.
  it('reaches lights buried in the hierarchy', () => {
    const root = new Group()
    const rig = new Group()
    const arm = new Group()
    arm.add(new SpotLight())
    rig.add(arm)
    root.add(rig)

    expect(stripNonVisual(root)).toBe(1)
    expect(rig.children).toEqual([arm])
    expect(arm.children).toHaveLength(0)
  })

  it('leaves a model that never had any alone', () => {
    const root = new Group()
    const mesh = new Mesh()
    root.add(mesh)

    expect(stripNonVisual(root)).toBe(0)
    expect(root.children).toEqual([mesh])
  })

  // A light's shadow map is a render target; dropping the object without
  // disposing it leaves the texture on the GPU for the life of the page.
  it('disposes what it removes', () => {
    const root = new Group()
    const light = new SpotLight()
    let disposed = false
    light.dispose = () => {
      disposed = true
    }
    root.add(light)

    stripNonVisual(root)
    expect(disposed).toBe(true)
  })
})
