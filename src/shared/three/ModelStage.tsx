'use client'

import { useThree } from '@react-three/fiber'
import type CameraControlsImpl from 'camera-controls'
import { useEffect, useMemo } from 'react'
import {
  Box3,
  MathUtils,
  PMREMGenerator,
  Vector3,
  type Object3D,
  type PerspectiveCamera,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/** Scaffolding for looking at a single asset in its own little canvas. */

/**
 * Neutral studio light.
 *
 * The environment map is the important part, and for the same reason it is
 * everywhere else in this project: a `metalness: 1` material has no colour of
 * its own, so with nothing to reflect it previews as a black silhouette.
 */
export function ModelStage() {
  const gl = useThree((state) => state.gl)

  const environment = useMemo(() => {
    const generator = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const target = generator.fromScene(room, 0.04)
    room.dispose()
    generator.dispose()
    return target
  }, [gl])

  useEffect(() => () => environment.dispose(), [environment])

  return (
    <>
      <primitive object={environment.texture} attach="environment" />
      <hemisphereLight intensity={0.5} color="#dbe9ff" groundColor="#b3a894" />
      <directionalLight position={[6, 10, 4]} color="#ffe9c8" intensity={1.6} />
      <directionalLight position={[-6, 4, -6]} color="#dbe9ff" intensity={0.4} />
    </>
  )
}

/**
 * Frames the camera on an object ONCE, and then leaves it alone.
 *
 * This replaces drei's `<Bounds observe>`, which re-fits whenever it notices a
 * change — including the change your own scroll wheel just made. The result was
 * a preview that zoomed in and snapped straight back out on every notch, and a
 * crash from inside its frame loop once the object it was watching went away.
 */
export function FitOnce({ object }: { object: Object3D }) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as CameraControlsImpl | null

  useEffect(() => {
    const box = new Box3().setFromObject(object)
    if (box.isEmpty()) return

    if (controls) {
      void controls.fitToBox(box, false, {
        paddingLeft: 0.15,
        paddingRight: 0.15,
        paddingTop: 0.15,
        paddingBottom: 0.15,
      })
      return
    }

    // No controls — the hover preview. Place the camera by hand.
    const centre = box.getCenter(new Vector3())
    const radius = Math.max(box.getSize(new Vector3()).length() / 2, 0.001)
    const fov = MathUtils.degToRad((camera as PerspectiveCamera).fov ?? 45)
    const distance = (radius / Math.sin(fov / 2)) * 1.1

    camera.position.copy(centre).addScaledVector(new Vector3(1, 0.65, 1).normalize(), distance)
    camera.lookAt(centre)
    camera.updateProjectionMatrix()
  }, [object, camera, controls])

  return null
}
