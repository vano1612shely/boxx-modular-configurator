import type { RoomType } from '@/modules/shared/room-types'

export type PackageFootprint = {
  width: number
  depth: number
}

export type FurniturePackageEntity = {
  id: number
  title: string
  family: 'office' | 'conference' | 'kitchen' | 'seating' | 'other'
  tier: 'core' | 'plus'
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
