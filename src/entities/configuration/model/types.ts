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
  /**
   * The pieces of one group put down together, or absent for ordinary furniture.
   *
   * A group is bought as one thing: taking away any piece of it takes away all
   * of them, and the quote counts it once. Minted per placement rather than
   * taken from the catalogue, because a room may hold two of the same group and
   * removing one must not remove the other.
   */
  groupId?: string
  /**
   * Which piece of its package's group this is, by the piece's own key.
   *
   * This, with `packageId`, is the whole of what says which model to draw. Kept
   * rather than a resolved URL so a saved order picks up whatever the piece was
   * changed to since, exactly as an ordinary placement does.
   */
  memberKey?: string
}

/** Where a piece is while it is still under the finger, before it is put down. */
export type DragPose = {
  instanceId: string
  x: number
  z: number
  rotationYDeg: number
}
