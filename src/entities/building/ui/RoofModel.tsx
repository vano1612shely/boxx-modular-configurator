'use client'

import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { MathUtils, type Mesh, type Object3D } from 'three'

import type { RoofConfig } from '../model/types'

// Cloned because the loader cache hands every caller the same scene instance.
export function RoofModel({ roof, visible = true }: { roof: RoofConfig; visible?: boolean }) {
  const { scene } = useGLTF(roof.url, false, true)

  const object = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((node: Object3D) => {
      const mesh = node as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    return clone
  }, [scene])

  // Nothing is disposed on unmount: the clone shares geometry and materials with
  // the cached original.
  return (
    <group
      visible={visible}
      position={roof.position}
      rotation={[0, MathUtils.degToRad(roof.yawDeg), 0]}
      scale={roof.scale}
    >
      <primitive object={object} />
    </group>
  )
}
