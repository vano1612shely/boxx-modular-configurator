export type PlacedPackage = {
  instanceId: string
  packageId: number
  roomKey: string
  /** Center position on the floor, model space (meters). */
  x: number
  z: number
  rotationYDeg: number
}

/** Where a piece is while it is still under the finger, before it is put down. */
export type DragPose = {
  instanceId: string
  x: number
  z: number
  rotationYDeg: number
}
