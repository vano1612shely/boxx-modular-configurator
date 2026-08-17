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
  modelUrl: string
  thumbnailUrl: string | null
  price: number | null
  description: string | null
  footprint: PackageFootprint
  /** Where it may be offered. Empty means anywhere. */
  compatibleRoomTypes: RoomType[]
  /** Where it is offered first. A subset of the above in practice, not enforced. */
  recommendedFor: RoomType[]
}
