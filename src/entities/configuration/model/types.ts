export type PlacedPackage = {
  instanceId: string
  packageId: number
  roomKey: string
  /** Center position on the floor, model space (meters). */
  x: number
  z: number
  rotationYDeg: number
}
