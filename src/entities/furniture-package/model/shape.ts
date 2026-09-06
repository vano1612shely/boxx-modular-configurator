/**
 * What a package actually occupies, as vertical spans over a grid of floor cells.
 *
 * A footprint says a desk fills a 1.6 × 0.8 rectangle, which is true of the
 * space it stands in and false of the space it *fills*: nearly all of that
 * rectangle is air between the legs, under a top at 71 cm. This is the same
 * rectangle divided into cells, each carrying the height ranges the model
 * really reaches in that column — so a chair can be asked whether it fits under
 * the top rather than whether it overlaps the rectangle.
 *
 * Several ranges per cell, not one. A desk with a modesty panel low down and a
 * top high up collapses, under a single lowest-to-highest range, to solid from
 * the panel to the top — and then refuses a seat at 45 cm, which is exactly the
 * complaint this exists to answer, one level further in.
 *
 * The frame is the load-bearing detail, and it is the frame `useCentredPackage`
 * puts the model in: x and z are offsets from the centre of the footprint, on
 * the package's own axes, before any placement rotation; y is metres above the
 * floor it stands on, left exactly as the glb has it — a model authored sunk
 * three centimetres collides sunk, because that is what is on screen. Metres
 * throughout, like `PackageFootprint`.
 */
export const MAX_SPANS = 4

export type PackageShape = {
  /** Side of one cell, metres. */
  cell: number
  nx: number
  nz: number
  /** Local x/z of the low corner of cell (0, 0). */
  x0: number
  z0: number
  /** `nx * nz * MAX_SPANS * 2` floats — [lo, hi] pairs, `count` of them per cell. */
  spans: Float32Array
  count: Uint8Array
  /**
   * The same field widened by one cell in every direction.
   *
   * Read only by the side that is *looked up*, never by the side being walked.
   * That asymmetry is what makes sampling one point per cell safe rather than
   * approximately safe — see `shapesCollide`.
   */
  dilated: Float32Array
  dilatedCount: Uint8Array
}

/**
 * Two heights count as clear of each other under this, in metres.
 *
 * Two millimetres: the grids are quantised and the read side is widened by a
 * whole cell, so a shared surface — a seat resting exactly on a rug — arrives
 * with its numbers a hair's breadth apart rather than equal, and without this
 * it reads as a clash.
 */
const EPS_Y = 0.002

type Posed = {
  shape: PackageShape
  x: number
  z: number
  rotationYDeg: number
}

/** Whether the [lo, hi] runs stored at `ai` in `a` reach any of those at `bi` in `bSpans`. */
function spansMeet(
  a: PackageShape,
  ai: number,
  bi: number,
  bSpans: Float32Array,
  bCount: Uint8Array,
): boolean {
  const an = a.count[ai]
  const bn = bCount[bi]

  for (let p = 0; p < an; p++) {
    const lo = a.spans[(ai * MAX_SPANS + p) * 2]
    const hi = a.spans[(ai * MAX_SPANS + p) * 2 + 1]

    for (let q = 0; q < bn; q++) {
      const blo = bSpans[(bi * MAX_SPANS + q) * 2]
      const bhi = bSpans[(bi * MAX_SPANS + q) * 2 + 1]
      if (hi > blo + EPS_Y && bhi > lo + EPS_Y) return true
    }
  }

  return false
}

/**
 * Whether two placed packages share any of the same air.
 *
 * The cells of one are dropped, one point each, into the field of the other.
 * Which one is walked is not a matter of taste: it has to be the one with the
 * *smaller* cell, and then the lookup has to go through the other's widened
 * field. That pairing is what makes a single sample per cell sound. If the two
 * really do overlap, some occupied cell of the walked shape has its square
 * cutting the other's solid, so that cell's centre lies within half a cell of a
 * solid point on each axis — and the field it lands in has been widened by a
 * whole cell of the larger grid, which is at least that half. Walking the
 * larger one instead would step over the gap and miss it.
 *
 * Both packages stand in the same room, so their floors are the same height and
 * the stored heights compare directly. Rooms are what the obstacle lists are
 * grouped by, so there is no pair here for which that is not true.
 *
 * Yaw costs two sines and two cosines for the whole pair rather than one per
 * cell: turning a package does not touch its grid, it only moves where each
 * cell centre lands.
 */
export function shapesCollide(first: Posed, second: Posed): boolean {
  // The finer grid walks; the coarser one is read through its widened copy.
  const [p, q] = first.shape.cell <= second.shape.cell ? [first, second] : [second, first]

  const pr = (p.rotationYDeg * Math.PI) / 180
  const qr = (q.rotationYDeg * Math.PI) / 180
  const cp = Math.cos(pr)
  const sp = Math.sin(pr)
  const cq = Math.cos(qr)
  const sq = Math.sin(qr)

  const ps = p.shape
  const qs = q.shape

  for (let j = 0; j < ps.nz; j++) {
    for (let i = 0; i < ps.nx; i++) {
      const pi = j * ps.nx + i
      if (ps.count[pi] === 0) continue

      // Cell centre, out to the world through p's yaw, then back in through q's.
      const lx = ps.x0 + (i + 0.5) * ps.cell
      const lz = ps.z0 + (j + 0.5) * ps.cell
      const dx = p.x + (cp * lx + sp * lz) - q.x
      const dz = p.z + (-sp * lx + cp * lz) - q.z
      const qx = dx * cq - dz * sq
      const qz = dx * sq + dz * cq

      // One cell of slack past the edge, then clamped back on to it. The
      // widened field stops at the grid it was built in, so without this the
      // outermost half-cell of a package — its whole outside face, which is
      // exactly where two pieces meet — is read as if nothing had widened it.
      const gi = Math.floor((qx - qs.x0) / qs.cell)
      if (gi < -1 || gi > qs.nx) continue
      const gj = Math.floor((qz - qs.z0) / qs.cell)
      if (gj < -1 || gj > qs.nz) continue

      const qi =
        Math.min(qs.nz - 1, Math.max(0, gj)) * qs.nx + Math.min(qs.nx - 1, Math.max(0, gi))
      if (qs.dilatedCount[qi] === 0) continue

      if (spansMeet(ps, pi, qi, qs.dilated, qs.dilatedCount)) return true
    }
  }

  return false
}
