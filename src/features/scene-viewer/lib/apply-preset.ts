import type CameraControls from 'camera-controls'
import { Spherical } from 'three'

import type { CameraPreset } from '@/entities/building'

import { shortestTurn } from './shortest-turn'

const SPHERICAL_SCRATCH = new Spherical()

/**
 * Fly to a pose, the short way round and inside the current limits.
 *
 * `setLookAt` writes the destination straight off the position vector: the
 * azimuth comes back from `Spherical.setFromVector3` in (−π, π] whatever the
 * camera has accumulated, and `update()` walks it there with a plain scalar
 * damp that does not wrap — so a view a few degrees away can be reached by a
 * near-full revolution. The polar angle is not clamped at all, unlike
 * `rotateTo`, which every user drag goes through, so a side preset can land
 * past the ceiling and the first drag then jerks it back.
 *
 * Re-issuing the angles through `rotateTo` and the distance through `dollyTo`
 * fixes both with the library's own clamps: neither touches the target
 * `setLookAt` has already set.
 */
export function applyPreset(
  controls: CameraControls,
  preset: CameraPreset,
  transition: boolean,
): void {
  const [px, py, pz] = preset.position
  const [tx, ty, tz] = preset.target

  // camera-controls accumulates azimuth and never normalizes it itself;
  // without this, setLookAt unwinds every accumulated turn.
  controls.normalizeRotations()
  // setLookAt leaves the focal offset alone, so a view picked after panning
  // would arrive with the pan still applied and sit off-centre.
  void controls.setFocalOffset(0, 0, 0, transition)
  void controls.setLookAt(px, py, pz, tx, ty, tz, transition)

  const end = controls.getSpherical(SPHERICAL_SCRATCH, true)
  void controls.rotateTo(shortestTurn(controls.azimuthAngle, end.theta), end.phi, transition)
  void controls.dollyTo(end.radius, transition)
}
