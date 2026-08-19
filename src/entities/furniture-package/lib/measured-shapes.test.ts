import { describe, expect, it } from 'vitest'
import { Box3, BoxGeometry, Group, Mesh, Vector3 } from 'three'

import { shapesCollide, type PackageShape } from '../model/shape'
import { measureShape } from './measured-shapes'

/** A box of this size with its base at `y` and its middle over (`x`, `z`). */
function box(
  name: string,
  size: [number, number, number],
  at: [number, number, number],
): Mesh {
  const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2]))
  mesh.name = name
  mesh.position.set(at[0], at[1] + size[1] / 2, at[2])
  return mesh
}

function group(name: string, parts: Mesh[]): Group {
  const g = new Group()
  g.name = name
  for (const part of parts) g.add(part)
  return g
}

/**
 * The same thing `useCentredPackage` hands the measurer: the model recentred on
 * its own footprint, still standing on the floor it was authored on.
 */
function measured(model: Group): { shape: PackageShape; footprint: { width: number; depth: number } } {
  model.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(model)
  const size = bounds.getSize(new Vector3())
  const centre = bounds.getCenter(new Vector3())

  model.position.x -= centre.x
  model.position.z -= centre.z
  model.updateMatrixWorld(true)

  const footprint = { width: size.x, depth: size.z }
  const shape = measureShape(model, footprint)
  if (!shape) throw new Error('the fixture measured to nothing')

  return { shape, footprint }
}

/** A desk: a top at 71 cm on four legs, with nothing at all in between. */
function table() {
  return group('Table', [
    box('Top', [1.6, 0.04, 0.8], [0, 0.71, 0]),
    box('Leg_A', [0.06, 0.71, 0.06], [-0.77, 0, -0.37]),
    box('Leg_B', [0.06, 0.71, 0.06], [0.77, 0, -0.37]),
    box('Leg_C', [0.06, 0.71, 0.06], [-0.77, 0, 0.37]),
    box('Leg_D', [0.06, 0.71, 0.06], [0.77, 0, 0.37]),
  ])
}

/** A chair: a seat at 45 cm on four legs, with a back rising to 90 cm on +z. */
function chair() {
  return group('Chair', [
    box('Seat', [0.45, 0.03, 0.45], [0, 0.42, 0]),
    box('Back', [0.45, 0.45, 0.05], [0, 0.45, 0.2]),
    box('Leg_A', [0.04, 0.42, 0.04], [-0.2, 0, -0.2]),
    box('Leg_B', [0.04, 0.42, 0.04], [0.2, 0, -0.2]),
    box('Leg_C', [0.04, 0.42, 0.04], [-0.2, 0, 0.2]),
    box('Leg_D', [0.04, 0.42, 0.04], [0.2, 0, 0.2]),
  ])
}

const TABLE = measured(table())
const CHAIR = measured(chair())

/** Whether the chair standing here is in the table's way. The table sits at the origin. */
function chairAt(x: number, z: number, rotationYDeg = 0, tableRotationYDeg = 0): boolean {
  return shapesCollide(
    { shape: CHAIR.shape, x, z, rotationYDeg },
    { shape: TABLE.shape, x: 0, z: 0, rotationYDeg: tableRotationYDeg },
  )
}

describe('measureShape', () => {
  it('finds the space under a table top', () => {
    // A column in the middle of the table, well clear of every leg: the lowest
    // thing in it is the underside of the top, not the floor.
    const { shape } = TABLE
    const i = Math.floor(shape.nx / 2)
    const j = Math.floor(shape.nz / 2)
    const cell = j * shape.nx + i

    expect(shape.count[cell]).toBeGreaterThan(0)
    expect(shape.spans[cell * 4 * 2]).toBeGreaterThan(0.6)
  })

  it('finds a leg standing on the floor', () => {
    const { shape } = TABLE
    // The corner cell, which is where a leg is.
    const cell = 0 * shape.nx + 0

    expect(shape.count[cell]).toBeGreaterThan(0)
    expect(shape.spans[cell * 4 * 2]).toBeLessThan(0.05)
  })

  /**
   * Nothing on screen may stand in air the collision test calls empty.
   *
   * Asserted against the widened field, because that is the one the test
   * actually consults — the raw grid is sampled at four points per cell, so a
   * leg clipping the corner of a cell by a centimetre is not in it, and a cell
   * the geometry barely enters is exactly where that is harmless. Widening is
   * what turns "sampled" back into "covered", and it is not a detail of the
   * build: it is half the argument that one sample per cell is sound at all.
   */
  it('covers every corner of every part it was measured from', () => {
    const model = table()
    const { shape } = measured(model)

    const corners: Vector3[] = []
    model.updateMatrixWorld(true)
    model.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const bounds = new Box3().setFromObject(mesh)
      // A hair inside its own edges: a point exactly on the boundary belongs to
      // whichever cell rounding hands it to, and the part does not reach into
      // the neighbouring one.
      const inset = 1e-3
      for (const x of [bounds.min.x + inset, bounds.max.x - inset]) {
        for (const z of [bounds.min.z + inset, bounds.max.z - inset]) {
          corners.push(new Vector3(x, (bounds.min.y + bounds.max.y) / 2, z))
        }
      }
    })

    for (const corner of corners) {
      const i = Math.min(shape.nx - 1, Math.max(0, Math.floor((corner.x - shape.x0) / shape.cell)))
      const j = Math.min(shape.nz - 1, Math.max(0, Math.floor((corner.z - shape.z0) / shape.cell)))
      const cell = j * shape.nx + i

      let covered = false
      for (let k = 0; k < shape.dilatedCount[cell]; k++) {
        const lo = shape.dilated[(cell * 4 + k) * 2]
        const hi = shape.dilated[(cell * 4 + k) * 2 + 1]
        if (corner.y >= lo - 1e-6 && corner.y <= hi + 1e-6) covered = true
      }

      expect(covered).toBe(true)
    }
  })

  // A model carrying a hidden helper mesh would otherwise be solid exactly where
  // the visitor can see straight through it.
  it('ignores geometry that is not drawn', () => {
    const model = table()
    const blocker = box('Hidden', [1.6, 0.7, 0.8], [0, 0, 0])
    blocker.visible = false
    model.add(blocker)

    const { shape } = measured(model)
    const cell = Math.floor(shape.nz / 2) * shape.nx + Math.floor(shape.nx / 2)

    expect(shape.spans[cell * 4 * 2]).toBeGreaterThan(0.6)
  })
})

describe('a chair and a table', () => {
  // The complaint this whole thing exists for.
  it('slides the chair under the table until its back meets the top', () => {
    expect(chairAt(0, 0.6)).toBe(false)
    expect(chairAt(0, 0.4)).toBe(false)
    expect(chairAt(0, 0.3)).toBe(false)
    expect(chairAt(0, 0.05)).toBe(true)
    expect(chairAt(0, 0)).toBe(true)
  })

  // Which is the whole difference from the footprint rule: the rectangles
  // overlap deeply at the pose that is now allowed.
  it('allows a pose the footprint rectangles forbid', () => {
    const overlapInZ = 0.4 + 0.225 - 0.3
    expect(overlapInZ).toBeGreaterThan(0.3)
    expect(chairAt(0, 0.3)).toBe(false)
  })

  it('knows which way the back is facing', () => {
    // Turned around, the back leads instead of trailing, and meets the top sooner.
    expect(chairAt(0, 0.3, 180)).toBe(true)
  })

  it('will not stand the chair on a table leg', () => {
    expect(chairAt(0.77, 0.37)).toBe(true)
  })

  it('tucks under a table that is itself turned', () => {
    // The table across the room's other axis; the chair comes at its long side.
    expect(chairAt(0.3, 0, 90, 90)).toBe(false)
    expect(chairAt(0, 0, 90, 90)).toBe(true)
  })

  it('will not slide a wardrobe under it', () => {
    const wardrobe = measured(group('Wardrobe', [box('Body', [0.6, 2.1, 0.6], [0, 0, 0])]))

    expect(
      shapesCollide(
        { shape: wardrobe.shape, x: 0, z: 0.3, rotationYDeg: 0 },
        { shape: TABLE.shape, x: 0, z: 0, rotationYDeg: 0 },
      ),
    ).toBe(true)
  })

  // Two packages that share a floor share the space just above it, and this is
  // honest about that: a chair's legs and a rug's pile are in the same
  // centimetre. Nothing in the catalogue is laid on the floor today, and the
  // answer if something ever is will be to let it be stood on deliberately
  // rather than to loosen the test for everything.
  it('counts a chair standing on a floor mat as being in its way', () => {
    const mat = measured(group('Mat', [box('Pile', [3, 0.01, 2], [0, 0, 0])]))

    expect(
      shapesCollide(
        { shape: CHAIR.shape, x: 0, z: 0, rotationYDeg: 0 },
        { shape: mat.shape, x: 0, z: 0, rotationYDeg: 0 },
      ),
    ).toBe(true)
  })
})

/**
 * How furniture is really put together, and both ways of getting it wrong.
 *
 * A carcass sits exactly on its plinth and a cornice exactly on the carcass, so
 * a line dropped down the middle meets two surfaces at each join. Counting
 * surfaces in twos reads each join as leaving the solid and going back into it,
 * and the whole middle of the wardrobe comes back hollow — a desk would then be
 * drawn straight through it. Parts that overlap rather than touch break the
 * same counting the other way round.
 */
describe('parts that touch, and parts that overlap', () => {
  function columnOf(shape: PackageShape) {
    const cell = Math.floor(shape.nz / 2) * shape.nx + Math.floor(shape.nx / 2)
    const out: Array<[number, number]> = []
    for (let k = 0; k < shape.count[cell]; k++) {
      out.push([shape.spans[(cell * 4 + k) * 2], shape.spans[(cell * 4 + k) * 2 + 1]])
    }
    return out
  }

  /** Whether the column is solid at this height. */
  function solidAt(shape: PackageShape, y: number) {
    return columnOf(shape).some(([lo, hi]) => y >= lo && y <= hi)
  }

  it('keeps the body of a wardrobe stacked out of three parts', () => {
    const wardrobe = measured(
      group('Wardrobe', [
        box('Plinth', [1, 0.1, 0.6], [0, 0, 0]),
        box('Carcass', [1, 1.8, 0.6], [0, 0.1, 0]),
        box('Cornice', [1, 0.1, 0.6], [0, 1.9, 0]),
      ]),
    )

    expect(solidAt(wardrobe.shape, 1.0)).toBe(true)
    expect(solidAt(wardrobe.shape, 0.5)).toBe(true)
    expect(solidAt(wardrobe.shape, 1.95)).toBe(true)
  })

  it('keeps the body of one whose parts overlap instead', () => {
    const post = measured(
      group('Post', [
        box('Lower', [0.4, 0.5, 0.4], [0, 0, 0]),
        box('Upper', [0.4, 0.5, 0.4], [0, 0.3, 0]),
      ]),
    )

    expect(solidAt(post.shape, 0.4)).toBe(true)
    expect(columnOf(post.shape)).toHaveLength(1)
  })

  // The join between a leg and the top it holds up is the same shape as the
  // wardrobe's, and it is in every desk in the catalogue.
  it('keeps a leg that ends exactly where the top begins', () => {
    const { shape } = TABLE
    const corner = 0

    let lowest = Infinity
    for (let k = 0; k < shape.count[corner]; k++) {
      lowest = Math.min(lowest, shape.spans[(corner * 4 + k) * 2])
    }

    expect(lowest).toBeLessThan(0.05)
    expect(
      shapesCollide(
        { shape: TABLE.shape, x: 0, z: 0, rotationYDeg: 0 },
        {
          shape: measured(group('Block', [box('Block', [0.1, 0.4, 0.1], [0, 0, 0])])).shape,
          // Standing where a leg is, at knee height.
          x: -0.77,
          z: -0.37,
          rotationYDeg: 0,
        },
      ),
    ).toBe(true)
  })
})

/**
 * One height range per column is not enough.
 *
 * A bench with a stretcher low between its legs and a seat on top has two solid
 * bands in the same column with clear air between them. Collapsed to a single
 * lowest-to-highest range it reads as solid all the way up, and refuses a tray
 * that plainly slides in — which is the same mistake as the table, one level
 * further down.
 */
describe('a column with two solid bands', () => {
  const bench = measured(
    group('Bench', [
      box('Top', [1.2, 0.05, 0.4], [0, 0.7, 0]),
      box('Stretcher', [1.0, 0.06, 0.06], [0, 0.1, 0]),
      box('Leg_A', [0.06, 0.7, 0.4], [-0.57, 0, 0]),
      box('Leg_B', [0.06, 0.7, 0.4], [0.57, 0, 0]),
    ]),
  )

  const tray = measured(group('Tray', [box('Tray', [0.3, 0.04, 0.3], [0, 0.35, 0])]))

  it('records both bands and the air between them', () => {
    const { shape } = bench
    const cell = Math.floor(shape.nz / 2) * shape.nx + Math.floor(shape.nx / 2)

    expect(shape.count[cell]).toBeGreaterThan(1)
  })

  it('slides a tray between them', () => {
    expect(
      shapesCollide(
        { shape: tray.shape, x: 0, z: 0, rotationYDeg: 0 },
        { shape: bench.shape, x: 0, z: 0, rotationYDeg: 0 },
      ),
    ).toBe(false)
  })

  it('still refuses one that sits on the stretcher', () => {
    const onIt = measured(group('Tray', [box('Tray', [0.3, 0.04, 0.3], [0, 0.12, 0])]))

    expect(
      shapesCollide(
        { shape: onIt.shape, x: 0, z: 0, rotationYDeg: 0 },
        { shape: bench.shape, x: 0, z: 0, rotationYDeg: 0 },
      ),
    ).toBe(true)
  })
})
