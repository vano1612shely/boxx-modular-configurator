import type CameraControls from 'camera-controls'
import { Vector3 } from 'three'

const POSITION_SCRATCH = new Vector3()
const TARGET_SCRATCH = new Vector3()
const OFFSET_SCRATCH = new Vector3()

/**
 * Stop every channel of an in-flight move at exactly the pose on screen.
 *
 * camera-controls halts only the channels the gesture it is starting owns
 * (`startDragging`), so a grab during a view flight steers the angles while the
 * target, the distance and the offset carry on travelling underneath it.
 *
 * It has to be `setLookAt`, not `moveTo` + `rotateTo` + `distance`: those two
 * are clamping setters. `moveTo` routes the target through
 * `_encloseToBoundary`, and `setBoundary` clamps only `_targetEnd`, never
 * `_target` — so mid-flight into a room the current target is still outside the
 * freshly shrunk box and asking to stay put is answered with a point on the box
 * face, copied straight into `_target` because the transition is off. The
 * camera is recomposed from the target every frame, so it teleports by the same
 * vector in one frame. `rotateTo` has the same shape of problem on the polar
 * angle: it clamps phi to the current range, which a flight out of the top view
 * is legitimately below. `setLookAt` writes `_targetEnd` and `_sphericalEnd`
 * with no clamp of any kind, pinning target, azimuth, polar and radius
 * atomically at the pose the eye is looking at.
 */
export function pinPose(controls: CameraControls): void {
  // Neither reading includes the focal offset; `update()` adds that separately.
  const position = controls.getPosition(POSITION_SCRATCH, false)
  const target = controls.getTarget(TARGET_SCRATCH, false)
  void controls.setLookAt(
    position.x,
    position.y,
    position.z,
    target.x,
    target.y,
    target.z,
    false,
  )

  const offset = controls.getFocalOffset(OFFSET_SCRATCH, false)
  void controls.setFocalOffset(offset.x, offset.y, offset.z, false)
}
