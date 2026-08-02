import type { Extent } from './room-framing'
import type { Vec3Tuple } from '../model/types'

export type RoofPlacement = {
  position: Vec3Tuple
  scale: number
}

/** One-shot initial placement; later admin edits are never recomputed from it. */
export function fitRoofToBuilding(building: Extent, roof: Extent): RoofPlacement {
  const buildingWidth = building.max[0] - building.min[0]
  const buildingDepth = building.max[2] - building.min[2]
  const roofWidth = roof.max[0] - roof.min[0]
  const roofDepth = roof.max[2] - roof.min[2]

  const ratios = [
    roofWidth > 1e-6 ? buildingWidth / roofWidth : null,
    roofDepth > 1e-6 ? buildingDepth / roofDepth : null,
  ].filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)

  const scale = ratios.length ? Math.min(...ratios) : 1

  // The model's own centre, which is not necessarily its origin.
  const centre: Vec3Tuple = [
    (roof.min[0] + roof.max[0]) / 2,
    roof.min[1],
    (roof.min[2] + roof.max[2]) / 2,
  ]

  return {
    position: [
      (building.min[0] + building.max[0]) / 2 - centre[0] * scale,
      building.max[1] - centre[1] * scale,
      (building.min[2] + building.max[2]) / 2 - centre[2] * scale,
    ],
    scale,
  }
}
