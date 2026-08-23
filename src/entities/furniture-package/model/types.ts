import type { RoomType } from '@/modules/shared/room-types'

export type PackageFootprint = {
  width: number
  depth: number
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
}
