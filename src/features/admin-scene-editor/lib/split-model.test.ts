import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D } from 'three'
import { describe, expect, it } from 'vitest'

import { splitModelPieces } from './split-model'

/** A unit cube standing with its base on y, centred on (x, z). */
function box(name: string, x: number, y: number, z: number, size = 1): Mesh {
  const mesh = new Mesh(new BoxGeometry(size, size, size), new MeshBasicMaterial())
  mesh.name = name
  mesh.position.set(x, y + size / 2, z)
  return mesh
}

function sceneOf(...children: Object3D[]): Object3D {
  const scene = new Group()
  for (const child of children) scene.add(child)
  return scene
}

describe('splitModelPieces', () => {
  it('gives one piece per object, named as the modeller named it', () => {
    const pieces = splitModelPieces(
      sceneOf(box('Dorm_Fridge_01', -1, 0, 0), box('Microwave_003', 1, 0, 0)),
    )

    expect(pieces.map((piece) => piece.name)).toEqual(['Dorm_Fridge_01', 'Microwave_003'])
    expect(pieces.map((piece) => piece.nodePath)).toEqual(['0', '1'])
  })

  it('keeps a model that is one object whole', () => {
    expect(splitModelPieces(sceneOf(box('Worktop', 0, 0, 0)))).toEqual([])
  })

  it('offsets across the floor from the middle of the whole model', () => {
    const pieces = splitModelPieces(sceneOf(box('left', -2, 0, 0), box('right', 2, 0, 0)))

    expect(pieces[0].offset[0]).toBeCloseTo(-2)
    expect(pieces[1].offset[0]).toBeCloseTo(2)
    expect(pieces[0].offset[2]).toBeCloseTo(0)
  })

  it('measures height from the model underside, so a worktop microwave stays up', () => {
    // A fridge on the floor and a microwave 0.9 m up, as a kitchen is authored.
    const pieces = splitModelPieces(sceneOf(box('fridge', 0, 0, 0), box('microwave', 2, 0.9, 0)))

    expect(pieces[0].offset[1]).toBeCloseTo(0)
    expect(pieces[1].offset[1]).toBeCloseTo(0.9)
  })

  it('ignores objects with nothing to draw', () => {
    const empty = new Object3D()
    empty.name = 'Helper'

    const pieces = splitModelPieces(sceneOf(box('fridge', 0, 0, 0), empty, box('bin', 2, 0, 0)))

    expect(pieces.map((piece) => piece.name)).toEqual(['fridge', 'bin'])
    // The path is the child's real index, so an ignored root does not shift it.
    expect(pieces.map((piece) => piece.nodePath)).toEqual(['0', '2'])
  })

  it('leaves a model whole when only one of its roots can be drawn', () => {
    const empty = new Object3D()
    expect(splitModelPieces(sceneOf(box('only', 0, 0, 0), empty))).toEqual([])
  })

  it('names an unnamed object by its place in the file', () => {
    const anonymous = box('', 2, 0, 0)
    const pieces = splitModelPieces(sceneOf(box('fridge', 0, 0, 0), anonymous))

    expect(pieces[1].name).toBe('Part 2')
  })

  it('takes a piece whole however deep it goes', () => {
    const unit = new Group()
    unit.name = 'Sink_Unit'
    unit.add(box('basin', 0, 0.9, 0), box('cupboard', 0, 0, 0))

    const pieces = splitModelPieces(sceneOf(unit, box('fridge', 3, 0, 0)))

    expect(pieces).toHaveLength(2)
    expect(pieces[0].name).toBe('Sink_Unit')
    // Its own base, not the basin's: the unit is placed as one thing.
    expect(pieces[0].offset[1]).toBeCloseTo(0)
  })
})
