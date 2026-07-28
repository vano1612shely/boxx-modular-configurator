'use client'

import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { Box3, MathUtils, Vector3, type Mesh } from 'three'

import type { OpeningPlacement } from '../lib/room-shell'
import type { OpeningFit, OpeningModelStyle, RoomZone } from '../model/types'
import { OPENING_KINDS } from '../model/types'

type Props = {
  placement: OpeningPlacement
  style: OpeningModelStyle
}

/**
 * A door or window as an actual object rather than a picture of one.
 *
 * A flat leaf is convincing from exactly one angle. Everything in a room view
 * is seen from an angle: the frame has depth, the handle sticks out, the glass
 * sits back from the reveal — and none of that survives being a quad.
 *
 * Where it goes comes entirely from `planOpeningPlacements`, which reads the
 * same topology the hole was cut from, so the model cannot drift out of its
 * reveal when a vertex moves or an opening gets clamped back onto its edge.
 */
export function OpeningModel({ placement, style }: Props) {
  // The URL is checked by the caller; a null one never reaches this component.
  const { scene } = useGLTF(style.url as string, false, true)

  const model = useMemo(() => {
    const object = scene.clone(true)

    // Materials are cloned as well. drei hands out ONE cached glb per URL, and
    // `Object3D.clone` copies material references — so without this, the wall
    // fading this door out would fade the same door in every other room.
    object.traverse((node) => {
      const mesh = node as Mesh
      if (!mesh.isMesh) return
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((entry) => entry.clone())
        : mesh.material.clone()
      // Rooms have no shadow casters; see RoomShell for why.
      mesh.castShadow = false
      mesh.receiveShadow = false
    })

    // Measured HERE, while the clone is still parentless: `setFromObject` walks
    // world matrices, so re-measuring after mount would fold this component's
    // own scale back into the answer and shrink the model on every edit.
    const bounds = new Box3().setFromObject(object)

    return {
      object,
      size: bounds.getSize(new Vector3()),
      center: bounds.getCenter(new Vector3()),
    }
  }, [scene])

  useEffect(() => {
    return () => {
      model.object.traverse((node) => {
        const mesh = node as Mesh
        if (!mesh.isMesh) return
        const material = mesh.material
        for (const entry of Array.isArray(material) ? material : [material]) entry.dispose()
      })
    }
  }, [model])

  const { opening, center, normal } = placement

  const scale = useMemo(
    () => fitScale(model.size, opening.width, opening.height, style.fit),
    [model, opening.width, opening.height, style.fit],
  )

  // The model's +Z points out of the room. `style.yawDeg` corrects a source
  // authored along some other axis — one setting for the whole file — and the
  // opening's own yaw turns this one instance, which is how the same door leaf
  // serves an inward and an outward swing.
  const yaw =
    Math.atan2(normal.x, normal.z) + MathUtils.degToRad(style.yawDeg + (opening.yawDeg ?? 0))

  return (
    <group
      position={[
        center.x + normal.x * style.depth,
        center.y,
        center.z + normal.z * style.depth,
      ]}
      rotation={[0, yaw, 0]}
    >
      {/* Mirroring is a negative scale, not a rotation: a left-hand door is the
          reflection of a right-hand one, and no amount of turning gets there.
          three flips the front face for a negative determinant on its own. */}
      <group scale={[opening.mirror ? -scale.x : scale.x, scale.y, scale.z]}>
        <group position={[-model.center.x, -model.center.y, -model.center.z]}>
          <primitive object={model.object} />
        </group>
      </group>
    </group>
  )
}

/**
 * How much to scale the source so it fills the hole.
 *
 * `stretch` is the default because a frame that does not meet the reveal shows
 * daylight around itself, and openings are rarely the exact proportions of the
 * model somebody drew. Depth follows the average of the two so a door handle is
 * squashed by roughly what the leaf is, rather than by the wall thickness.
 */
function fitScale(size: Vector3, width: number, height: number, fit: OpeningFit): Vector3 {
  if (fit === 'none') return new Vector3(1, 1, 1)

  const sx = size.x > 1e-4 ? width / size.x : 1
  const sy = size.y > 1e-4 ? height / size.y : 1

  if (fit === 'contain') {
    const uniform = Math.min(sx, sy)
    return new Vector3(uniform, uniform, uniform)
  }

  return new Vector3(sx, sy, (sx + sy) / 2)
}

/**
 * Warms the loader cache for every door and window in the building, so opening
 * a room does not suspend on a network round trip.
 */
export function preloadOpeningModels(rooms: RoomZone[]) {
  for (const room of rooms) {
    for (const kind of OPENING_KINDS) {
      const url = room.openingModels[kind]?.url
      if (url) useGLTF.preload(url, false, true)
    }
  }
}
