import type { RoomShellConfig, RoomVertex, WallSide } from '../model/types'
import { WALL_SIDES } from '../model/types'
import { pointInPolygon } from './polygon'

/** Hysteresis band, in meters, so a wall cannot strobe on the plane itself. */
const RESTORE_MARGIN = 0.05

const MAX_HIDDEN = 3

export type RoomVisibility = {
  hiddenSides: WallSide[]
  ceilingHidden: boolean
}

/** Both ends of every edge count: a vertex owns only the edge that starts at it. */
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

/** @param previous last frame's hidden set, which the hysteresis band needs. */
export function resolveRoomVisibility(
  polygon: RoomVertex[],
  shell: RoomShellConfig,
  camera: { x: number; y: number; z: number },
  previous: readonly WallSide[] = [],
): RoomVisibility {
  if (polygon.length < 3) return { hiddenSides: [], ceilingHidden: false }

  const ceilingHidden = camera.y > shell.floorY + shell.wallHeight + shell.ceilingThickness

  // An L-shaped room can put the camera past one arm's wall plane while still
  // inside the room; that wall must not vanish.
  if (pointInPolygon(camera, polygon)) return { hiddenSides: [], ceilingHidden }

  const present = new Set(polygon.map((vertex) => vertex.side))
  const beyond: Array<{ side: WallSide; depth: number }> = []

  for (const side of WALL_SIDES) {
    if (!present.has(side)) continue

    const axis = shell.sideAxes[side]
    if (!axis || (axis.x === 0 && axis.z === 0)) continue

    const inner = planeAlong(polygon, side, axis)
    if (inner === null) continue

    // The outline is the wall's inner face; the outer face is a thickness further out.
    const plane = inner + shell.wallThickness
    const depth = camera.x * axis.x + camera.z * axis.z - plane
    const threshold = previous.includes(side) ? -RESTORE_MARGIN : 0

    if (depth > threshold) beyond.push({ side, depth })
  }

  beyond.sort((a, b) => b.depth - a.depth)

  return { hiddenSides: beyond.slice(0, MAX_HIDDEN).map((entry) => entry.side), ceilingHidden }
}
