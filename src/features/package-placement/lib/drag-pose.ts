import type { DragPose, PlacedPackage } from '@/entities/configuration'

export type FramePose = {
  x: number
  z: number
  rotationYDeg: number
  /** True while the piece is under the finger, where it is placed rather than eased. */
  snap: boolean
}

/**
 * Where the frame loop should put a piece this frame, or null to leave it alone.
 *
 * The live pose of a drag is kept out of `placed` — it changes on every pointer
 * move, and `placed` is the configuration, which half the screen reads. So the
 * loop has two sources: the prop React last rendered, and the store's live pose.
 * They fall out of step at both ends of a drag, and in both of them the prop is
 * the pose from *before* it:
 *
 *   · between pressing and the first move, no live pose exists yet;
 *   · between letting go and React re-rendering, the store has already been
 *     committed and cleared. The release is handled in a window listener React
 *     does not own, so its update is not flushed with the event and a frame or
 *     two runs in between.
 *
 * Writing the prop in either case throws the piece back to where the drag
 * started for those frames — a visible flick at the end of every drag. Writing
 * nothing is right for both: the piece already stands at the pose the store has
 * just committed.
 */
export function framePose(
  placement: PlacedPackage,
  isDragging: boolean,
  live: DragPose | null,
): FramePose | null {
  if (!isDragging) {
    return { x: placement.x, z: placement.z, rotationYDeg: placement.rotationYDeg, snap: false }
  }

  if (live?.instanceId !== placement.instanceId) return null

  return { x: live.x, z: live.z, rotationYDeg: live.rotationYDeg, snap: true }
}
