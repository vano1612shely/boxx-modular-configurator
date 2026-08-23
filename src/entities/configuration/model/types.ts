export type PlacedPackage = {
  instanceId: string
  packageId: number
  roomKey: string
  /** Center position on the floor, model space (meters). */
  x: number
  z: number
  rotationYDeg: number
  /**
   * Arranged by the building rather than carried in — a fitted kitchen.
   *
   * Only the store reads it, and only to refuse: a pinned piece cannot be
   * picked up, turned or selected. It is deliberately not part of what a quote
   * stores, because on the way back in every placement is static anyway, and
   * what a pinned piece is made of is answered by the building it stands in.
   */
  pinned?: boolean
}

/** Where a piece is while it is still under the finger, before it is put down. */
export type DragPose = {
  instanceId: string
  x: number
  z: number
  rotationYDeg: number
}
