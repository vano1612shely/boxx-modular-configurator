'use client'

import { useThree } from '@react-three/fiber'
import type CameraControlsImpl from 'camera-controls'
import { useEffect } from 'react'
import { Box3, MathUtils, Vector3, type Object3D, type PerspectiveCamera } from 'three'

import { roomEnvironment } from './room-environment'

// drei caches parsed glbs by URL and shares the scene, which the viewers mutate.
// The fragment forces a separate parse without a second request.
export function previewUrl(url: string): string {
  return `${url}#preview`
}

export function ModelStage() {
  const gl = useThree((state) => state.gl)

  return (
    <>
      {/* Cached per renderer and never disposed — see `roomEnvironment`. This
          used to build its own and give it back in a cleanup, which leaves the
          scene holding a deleted texture the moment React re-runs the effect
          without re-running the memo. */}
      <primitive object={roomEnvironment(gl)} attach="environment" />
      <hemisphereLight intensity={0.5} color="#dbe9ff" groundColor="#b3a894" />
      <directionalLight position={[6, 10, 4]} color="#ffe9c8" intensity={1.6} />
      <directionalLight position={[-6, 4, -6]} color="#dbe9ff" intensity={0.4} />
    </>
  )
}

// Replaces drei's <Bounds observe>, which re-fits on any change including zoom.
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
