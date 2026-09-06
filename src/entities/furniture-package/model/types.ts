import type { RoomType } from '@/modules/shared/room-types'

export type PackageFootprint = {
  width: number
  depth: number
}

/**
 * One model inside a group, where the arranger left it.
 *
 * `x` and `z` are metres from the group's own middle, and `rotationYDeg` turns
 * the piece about its own centre — the same frame the arranger draws in, so what
 * an admin sees there is what the room gets.
 */
export type PackageMember = {
  /**
   * The array row's own id.
   *
   * Payload keeps it across saves, which is what lets a placement name a piece:
   * a saved order reopened months later has to find the same chair, and an index
   * into the list would move the moment somebody adds a second table.
   */
  key: string
  name: string | null
  modelUrl: string
  x: number
  z: number
  rotationYDeg: number
  /**
   * The piece's own floor rectangle, read off its model when the catalogue was
   * built.
   *
   * Only ever a starting figure: once the glb is on screen the measured one
   * takes over, exactly as it does for a whole package. It matters for the frame
   * before that, when a piece with no size of its own would otherwise borrow the
   * whole group's — a chair claiming the table's floor.
   */
  footprint: PackageFootprint
}

export type FurniturePackageEntity = {
  id: number
  title: string
  /** The grade shown on the card, as named in the catalogue. Null if unset. */
  tier: string | null
  /**
   * The whole package as one model, or null for a fitted one.
   *
   * A fitted package has no single model to carry in: its parts stand where the
   * building says they stand, so the geometry lives on the room. Nothing else
   * may be offered without one — there would be nothing to put in the room.
   */
  modelUrl: string | null
  /** Arranged in the building rather than dragged in, and not movable once placed. */
  fitted: boolean
  thumbnailUrl: string | null
  price: number | null
  description: string | null
  footprint: PackageFootprint
  /** Where it may be offered. Empty means anywhere. */
  compatibleRoomTypes: RoomType[]
  /** Where it is offered first. A subset of the above in practice, not enforced. */
  recommendedFor: RoomType[]
  /**
   * The pieces this is made of, empty for an ordinary package.
   *
   * A group is added and taken away whole and costs one price, but once it is in
   * the room each piece stands on its own and moves like any other furniture.
   * That is why the pieces are listed here rather than merged into one model:
   * one model could not be pulled apart afterwards.
   */
  members: PackageMember[]
}
