'use client'

import { useMemo } from 'react'
import { MathUtils, type Mesh, type Object3D } from 'three'

import type { RoofConfig } from '../model/types'
import { useModel } from '@/shared/three/use-model'

// Cloned because the loader cache hands every caller the same scene instance.
export function RoofModel({ roof, visible = true }: { roof: RoofConfig; visible?: boolean }) {
  const scene = useModel(roof.url)

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
