import type { RoomShellConfig, RoomVertex, WallSide } from '../model/types'
import { WALL_SIDES } from '../model/types'
import { pointInPolygon } from './polygon'

/**
 * Which walls step out of the way in dollhouse mode.
 *
 * The rule is the one a dollhouse actually obeys: a wall goes the moment you
 * can see its OUTSIDE. Not when it starts to cover the floor, not when it turns
 * far enough towards you — the instant the camera crosses the plane that wall
 * stands on, you are outside the room looking at its back, and a back is never
 * what you came to see. Cross it by a tenth of a degree and the wall is gone.
 *
 * Measuring against the wall's own plane rather than against the direction to
 * the room's centre is what makes that exact. A centre-relative test asks "is
 * this wall turned towards me", which is a different question with a different
 * answer everywhere except dead ahead — and its answer is what used to keep a
 * wall standing well past the point where you were plainly behind it.
 */

/**
 * How far back past a wall's plane the camera must come before it returns.
 *
 * Only exists to stop a wall strobing while the camera sits exactly on the
 * plane. Small enough to be imperceptible, which is the point: the threshold
 * itself is zero.
 */
const RESTORE_MARGIN = 0.05

/**
 * A closed outline cannot put the camera outside all of its walls, so this only
 * ever bites on a room shaped strangely enough that three of them qualify —
 * and leaving one standing is better than leaving none.
 */
const MAX_HIDDEN = 3

export type RoomVisibility = {
  hiddenSides: WallSide[]
  /** The ceiling lifts once the camera is above it, for the same reason. */
  ceilingHidden: boolean
}

/**
 * How far out along `axis` this side's outline reaches, or null if it has none.
 *
 * Both ends of every edge count: a vertex owns the edge that STARTS at it, so
 * the far end of a side's last edge belongs to the next side and would
 * otherwise be missed — which shortens the wall's plane by the length of its
 * final segment.
 */
function planeAlong(polygon: RoomVertex[], side: WallSide, axis: { x: number; z: number }) {
  let reach = -Infinity

  for (let i = 0; i < polygon.length; i++) {
    if (polygon[i].side !== side) continue
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    reach = Math.max(reach, a.x * axis.x + a.z * axis.z, b.x * axis.x + b.z * axis.z)
  }

  return Number.isFinite(reach) ? reach : null
}

/**
 * @param previous last frame's hidden set — the hysteresis band needs it.
 *
 * Facing is measured against the side's stored outward axis, not against
 * geometry: the length-weighted mean normal of a side with a deep recess
 * points at the opposite wall, which would hide it from exactly the wrong
 * angle. The admin already labelled which wall is which; trust that.
 */
export function resolveRoomVisibility(
  polygon: RoomVertex[],
  shell: RoomShellConfig,
  camera: { x: number; y: number; z: number },
  previous: readonly WallSide[] = [],
): RoomVisibility {
  if (polygon.length < 3) return { hiddenSides: [], ceilingHidden: false }

  // The top of the ceiling slab is its outside. Above that line you are looking
  // down on the roof of the room, so off it comes.
  const ceilingHidden = camera.y > shell.floorY + shell.wallHeight + shell.ceilingThickness

  // Inside the room, every wall is around you rather than between you and it.
  // Still needed despite the plane test: one arm of an L-shaped room can put
  // you beyond the plane of a wall in the other arm without ever leaving the
  // room, and that wall must not vanish from under you.
  if (pointInPolygon(camera, polygon)) return { hiddenSides: [], ceilingHidden }

  const present = new Set(polygon.map((vertex) => vertex.side))
  const beyond: Array<{ side: WallSide; depth: number }> = []

  for (const side of WALL_SIDES) {
    if (!present.has(side)) continue

    const axis = shell.sideAxes[side]
    if (!axis || (axis.x === 0 && axis.z === 0)) continue

    const inner = planeAlong(polygon, side, axis)
    if (inner === null) continue

    // The outline is the wall's INNER face; its outer face is a thickness
    // further out, and that is the surface you have to get behind.
    const plane = inner + shell.wallThickness
    const depth = camera.x * axis.x + camera.z * axis.z - plane
    const threshold = previous.includes(side) ? -RESTORE_MARGIN : 0

    if (depth > threshold) beyond.push({ side, depth })
  }

  // Deepest first, so if the cap ever bites it keeps the walls you are most
  // squarely behind.
  beyond.sort((a, b) => b.depth - a.depth)

  return { hiddenSides: beyond.slice(0, MAX_HIDDEN).map((entry) => entry.side), ceilingHidden }
}
