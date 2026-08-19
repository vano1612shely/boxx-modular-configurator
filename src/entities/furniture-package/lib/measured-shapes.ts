import { Vector3, type BufferGeometry, type Mesh, type Object3D } from 'three'

import { MAX_SPANS, type PackageShape } from '../model/shape'
import type { PackageFootprint } from '../model/types'

/**
 * How many cells a package's grid is allowed. Past this the cell grows rather
 * than the grid, so a deck-sized package comes out coarse instead of enormous.
 */
const MAX_CELLS = 12_000

/**
 * How fine the grid wants to be, in metres.
 *
 * A fixed size, not a fraction of the package. What has to be resolved is the
 * *parts*, and a table leg is seven centimetres whether it holds up a bedside
 * table or a boardroom one — scaling the cell with the package measured the big
 * ones most coarsely, which is backwards. Three centimetres resolves a leg, and
 * since the read side is widened by a whole cell it is also the margin every
 * answer carries: at nine, that margin alone was wider than the gap a chair
 * needs to clear the edge of a desk, and nothing could be tucked anywhere.
 */
const TARGET_CELL = 0.03

/** A model past this is not furniture, and is left to the footprint rule. */
const MAX_TRIANGLES = 200_000

function cellSizeFor(footprint: PackageFootprint): number {
  // Coarser only where the budget insists, which is only for something the size
  // of a deck.
  return Math.max(TARGET_CELL, Math.sqrt((footprint.width * footprint.depth) / MAX_CELLS))
}

/**
 * Records that this column reaches from `lo` to `hi`.
 *
 * Runs already touching the new one are absorbed into it, so a leg stamped
 * triangle by triangle ends as one span rather than a hundred. Past the budget
 * the nearest existing run is stretched to swallow it — the one lossy path
 * here, and it loses by claiming more solid than there is, which is the
 * direction that costs a centimetre rather than a chair through a desk.
 */
function insertSpan(spans: Float32Array, count: Uint8Array, cellIndex: number, lo: number, hi: number) {
  const base = cellIndex * MAX_SPANS * 2
  let n = count[cellIndex]

  let low = lo
  let high = hi
  let write = 0

  for (let k = 0; k < n; k++) {
    const klo = spans[base + k * 2]
    const khi = spans[base + k * 2 + 1]

    if (khi >= low && klo <= high) {
      // Touching or overlapping: fold it into the run being inserted.
      if (klo < low) low = klo
      if (khi > high) high = khi
      continue
    }

    spans[base + write * 2] = klo
    spans[base + write * 2 + 1] = khi
    write++
  }

  n = write

  if (n < MAX_SPANS) {
    spans[base + n * 2] = low
    spans[base + n * 2 + 1] = high
    count[cellIndex] = n + 1
    return
  }

  // Full. Stretch whichever run sits nearest rather than dropping this one.
  let best = 0
  let bestGap = Infinity
  for (let k = 0; k < n; k++) {
    const klo = spans[base + k * 2]
    const khi = spans[base + k * 2 + 1]
    const gap = low > khi ? low - khi : klo > high ? klo - high : 0
    if (gap < bestGap) {
      bestGap = gap
      best = k
    }
  }

  if (low < spans[base + best * 2]) spans[base + best * 2] = low
  if (high > spans[base + best * 2 + 1]) spans[base + best * 2 + 1] = high
  count[cellIndex] = n
}

/** Every triangle of a geometry, in the frame the object sits in. */
function forEachTriangle(
  root: Object3D,
  onTriangle: (a: Vector3, b: Vector3, c: Vector3) => void,
  budget: { left: number },
): boolean {
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  let ok = true

  // `traverseVisible`, not `traverse`: the shape has to describe what is drawn.
  // A model carrying a hidden helper mesh would otherwise be solid where the
  // visitor can see straight through it.
  root.traverseVisible((object) => {
    if (!ok) return

    const mesh = object as Mesh
    if (!mesh.isMesh) return

    const geometry = mesh.geometry as BufferGeometry | undefined
    const position = geometry?.getAttribute('position')
    if (!position) return

    const index = geometry?.getIndex() ?? null
    const count = index ? index.count : position.count

    if (budget.left < count / 3) {
      ok = false
      return
    }
    budget.left -= count / 3

    for (let i = 0; i < count; i += 3) {
      const ia = index ? index.getX(i) : i
      const ib = index ? index.getX(i + 1) : i + 1
      const ic = index ? index.getX(i + 2) : i + 2

      // Through the accessor, never the raw array: positions in this library
      // arrive meshopt-quantised, and the accessor is what denormalises them.
      a.fromBufferAttribute(position, ia).applyMatrix4(mesh.matrixWorld)
      b.fromBufferAttribute(position, ib).applyMatrix4(mesh.matrixWorld)
      c.fromBufferAttribute(position, ic).applyMatrix4(mesh.matrixWorld)

      onTriangle(a, b, c)
    }
  })

  return ok
}

/** Widens the field by one cell each way, so a single sample per cell is sound. */
function dilate(shape: {
  nx: number
  nz: number
  spans: Float32Array
  count: Uint8Array
}): { dilated: Float32Array; dilatedCount: Uint8Array } {
  const { nx, nz, spans, count } = shape
  const dilated = new Float32Array(nx * nz * MAX_SPANS * 2)
  const dilatedCount = new Uint8Array(nx * nz)

  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const target = j * nx + i

      for (let dj = -1; dj <= 1; dj++) {
        const sj = j + dj
        if (sj < 0 || sj >= nz) continue

        for (let di = -1; di <= 1; di++) {
          const si = i + di
          if (si < 0 || si >= nx) continue

          const source = sj * nx + si
          const n = count[source]
          for (let k = 0; k < n; k++) {
            insertSpan(
              dilated,
              dilatedCount,
              target,
              spans[(source * MAX_SPANS + k) * 2],
              spans[(source * MAX_SPANS + k) * 2 + 1],
            )
          }
        }
      }
    }
  }

  return { dilated, dilatedCount }
}

/** Heights nearer than this are the same height, met by two surfaces at once. */
const SAME_HEIGHT = 1e-6

/**
 * The volume a package occupies, measured off the model that is on screen.
 *
 * A mesh is a skin, and what the collision test needs is what is *inside* it.
 * So each column of the grid is treated as a vertical line dropped through the
 * model, and every triangle it passes through is a surface met — going in where
 * the triangle faces down, coming out where it faces up. Counting those in and
 * out is what says where the solid is: a column between a desk's legs meets the
 * underside of the top and then its surface, and comes back solid from 0.71 to
 * 0.75 and nowhere else. Everything below is air a chair can be pushed into,
 * which is the whole point.
 *
 * Counted rather than paired off in twos, and the difference matters twice over.
 * Furniture is modelled as parts that touch — a leg ending exactly where a top
 * begins, a carcass sitting on its plinth — and there the line meets two
 * surfaces at one height; pairing in twos reads that as leaving the solid and
 * entering it again, and everything above the join comes back hollow. Parts that
 * overlap rather than touch break it the other way: pairing turns the shared
 * volume into a band of air in the middle of a wardrobe. A depth count is right
 * in both, because it is asking how many solids the line is inside rather than
 * how many surfaces it has passed.
 *
 * Stamping each triangle's own height range instead would have recorded the
 * skin rather than the solid — a box would arrive as two flat sheets with a
 * hole between them, and furniture would slide through the middle of things.
 *
 * A line that ends up still inside something has been told something impossible:
 * the skin is not closed along it, which is common enough in furniture exported
 * for looks. The whole column then falls back to the height range of everything
 * that passed overhead — the old whole-box answer, one column wide. Too solid
 * rather than too hollow, and too solid only costs reach.
 *
 * Null for a model with nothing drawn in it, or one far too detailed to walk;
 * callers fall back to the footprint rectangle, which is where they were before
 * any of this existed.
 *
 * `object` must already be in the frame the placement uses — centred on its
 * footprint, standing on y = 0 — which is what `useCentredPackage` hands over.
 */
export function measureShape(object: Object3D, footprint: PackageFootprint): PackageShape | null {
  const cell = cellSizeFor(footprint)
  const nx = Math.max(1, Math.ceil(footprint.width / cell))
  const nz = Math.max(1, Math.ceil(footprint.depth / cell))
  const x0 = -(nx * cell) / 2
  const z0 = -(nz * cell) / 2

  // Four lines per cell rather than one down its middle. A table leg is barely
  // wider than a cell and never centred in it: sampled only at the centre it is
  // missed entirely, and the column comes back holding nothing but the top —
  // hollow all the way to the floor, right where the leg is.
  const crossings: Array<number[] | undefined> = new Array(nx * nz * 4)
  /** +1 where the line goes into a solid, -1 where it comes out, beside each height. */
  const directions: Array<number[] | undefined> = new Array(nx * nz * 4)
  /** Height range of anything that passed over this column at all. */
  const touchedLo = new Float32Array(nx * nz).fill(Infinity)
  const touchedHi = new Float32Array(nx * nz).fill(-Infinity)
  /** Columns holding something too narrow for the lines to be trusted to find. */
  const tooThin = new Uint8Array(nx * nz)
  let touched = 0

  const quarter = cell / 4
  const offsets = [
    [-quarter, -quarter],
    [quarter, -quarter],
    [-quarter, quarter],
    [quarter, quarter],
  ] as const

  object.updateMatrixWorld(true)

  const walked = forEachTriangle(
    object,
    (a, b, c) => {
      const minX = Math.min(a.x, b.x, c.x)
      const maxX = Math.max(a.x, b.x, c.x)
      const minZ = Math.min(a.z, b.z, c.z)
      const maxZ = Math.max(a.z, b.z, c.z)
      const lo = Math.min(a.y, b.y, c.y)
      const hi = Math.max(a.y, b.y, c.y)

      const i0 = Math.max(0, Math.floor((minX - x0) / cell))
      const i1 = Math.min(nx - 1, Math.floor((maxX - x0) / cell))
      const j0 = Math.max(0, Math.floor((minZ - z0) / cell))
      const j1 = Math.min(nz - 1, Math.floor((maxZ - z0) / cell))
      if (i1 < i0 || j1 < j0) return

      // Barycentric setup for the flattened triangle, once per triangle rather
      // than once per cell it covers.
      const v0x = c.x - a.x
      const v0z = c.z - a.z
      const v1x = b.x - a.x
      const v1z = b.z - a.z
      // Which is also the y of this triangle's normal, so its sign says whether
      // a line rising through it is going into the solid or coming back out.
      const denom = v0x * v1z - v1x * v0z
      // Seen edge-on: it encloses no column, so nothing crosses it.
      const flat = Math.abs(denom) < 1e-12
      const step = denom < 0 ? 1 : -1

      // Narrower in plan than the gap between the lines, so they may all miss
      // it — a 12 mm back panel under a desk top the lines answer for cleanly.
      // Flagged so the column falls back to the conservative answer instead.
      //
      // Only of faces a rising line could meet at all. Every upright face is
      // paper-thin seen from above by definition, and treating those as narrow
      // would call the sides of everything unmeasurable.
      const slim = !flat && (maxX - minX < cell / 2 || maxZ - minZ < cell / 2)

      for (let j = j0; j <= j1; j++) {
        const pz = z0 + (j + 0.5) * cell

        for (let i = i0; i <= i1; i++) {
          const index = j * nx + i

          if (lo < touchedLo[index]) touchedLo[index] = lo
          if (hi > touchedHi[index]) touchedHi[index] = hi
          if (slim) tooThin[index] = 1
          touched++

          if (flat) continue

          const cx = x0 + (i + 0.5) * cell

          for (let s = 0; s < 4; s++) {
            const qx = cx + offsets[s][0] - a.x
            const qz = pz + offsets[s][1] - a.z
            const u = (qx * v1z - v1x * qz) / denom
            const v = (v0x * qz - qx * v0z) / denom
            if (u < 0 || v < 0 || u + v > 1) continue

            const y = a.y + (c.y - a.y) * u + (b.y - a.y) * v
            const at = index * 4 + s
            const list = crossings[at]
            if (list) {
              list.push(y)
              directions[at]!.push(step)
            } else {
              crossings[at] = [y]
              directions[at] = [step]
            }
          }
        }
      }
    },
    { left: MAX_TRIANGLES },
  )

  if (!walked || touched === 0) return null

  const spans = new Float32Array(nx * nz * MAX_SPANS * 2)
  const count = new Uint8Array(nx * nz)

  for (let index = 0; index < nx * nz; index++) {
    if (touchedLo[index] === Infinity) continue

    let answered = false
    let trustworthy = !tooThin[index]

    for (let s = 0; s < 4; s++) {
      const at = index * 4 + s
      const list = crossings[at]
      if (!list || list.length < 2) continue

      const step = directions[at]!
      const order = list.map((_, k) => k).sort((p, q) => list[p] - list[q])

      let depth = 0
      let enteredAt = 0

      for (let k = 0; k < order.length; ) {
        const y = list[order[k]]

        // Everything met at one height counts together, or a leg ending exactly
        // where a top begins would read as a moment outside the solid.
        let delta = 0
        while (k < order.length && list[order[k]] - y <= SAME_HEIGHT) {
          delta += step[order[k]]
          k++
        }

        const was = depth
        depth += delta
        if (was <= 0 && depth > 0) enteredAt = y
        else if (was > 0 && depth <= 0) insertSpan(spans, count, index, enteredAt, y)
      }

      // Still inside something at the top of the model: the skin is open along
      // this line, so nothing it says can be relied on.
      if (depth !== 0) trustworthy = false
      else answered = true
    }

    // Either nothing closed, or something here is too narrow for four lines to
    // be sure of. Back to the height of whatever went overhead — the old
    // whole-box answer, one column wide.
    if (!answered || !trustworthy) {
      insertSpan(spans, count, index, touchedLo[index], touchedHi[index])
    }
  }

  return { cell, nx, nz, x0, z0, spans, count, ...dilate({ nx, nz, spans, count }) }
}

/**
 * Shapes by the model they were measured from, and packages by that model.
 *
 * Keyed on the URL rather than on the package: the measuring walks every
 * triangle in the glb, and the component that does it is mounted once per piece
 * of furniture standing in the room. Keyed per package that is a room's worth of
 * the same work; keyed per model it is once.
 */
const byUrl = new Map<string, PackageShape | null>()
const byPackage = new Map<number, string>()

/** Whether this model has already been measured — including "measured, no use". */
export function hasShape(modelUrl: string): boolean {
  return byUrl.has(modelUrl)
}

export function setMeasuredShape(packageId: number, modelUrl: string, shape: PackageShape | null) {
  byUrl.set(modelUrl, shape)
  byPackage.set(packageId, modelUrl)
}

/** Points a package at a model somebody else has already measured. */
export function linkPackageShape(packageId: number, modelUrl: string) {
  byPackage.set(packageId, modelUrl)
}

/**
 * The shape of a package, or null while its model is still on its way.
 *
 * Null is not a failure to handle separately: it is the answer that puts the
 * caller back on the footprint rectangle, which is the rule everything used
 * before shapes existed.
 */
export function shapeOf(packageId: number): PackageShape | null {
  const url = byPackage.get(packageId)
  return url ? (byUrl.get(url) ?? null) : null
}
