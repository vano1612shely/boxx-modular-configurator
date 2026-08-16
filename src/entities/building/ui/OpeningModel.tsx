'use client'

import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { Box3, MathUtils, Vector3, type Mesh } from 'three'

import type { OpeningPlacement } from '../lib/room-shell'
import type { OpeningFit, OpeningModelStyle, Room } from '../model/types'
import { OPENING_KINDS } from '../model/types'
import { useModel } from '@/shared/three/use-model'

type Props = {
  placement: OpeningPlacement
  style: OpeningModelStyle
}

export function OpeningModel({ placement, style }: Props) {
  // The URL is checked by the caller; a null one never reaches this component.
  const scene = useModel(style.url as string)

  const model = useMemo(() => {
    const object = scene.clone(true)

    // drei caches one glb per URL and Object3D.clone shares material references,
    // so materials must be cloned too or every instance fades together.
    object.traverse((node) => {
      const mesh = node as Mesh
      if (!mesh.isMesh) return
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((entry) => entry.clone())
        : mesh.material.clone()
      mesh.castShadow = false
      mesh.receiveShadow = false
    })

    // Must be measured while the clone is parentless: setFromObject walks world
    // matrices, so measuring after mount folds this component's scale back in.
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

  // The model's +Z is expected to point out of the room.
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
      {/* Mirroring is a negative scale; three flips the front face for a
          negative determinant on its own. */}
      <group scale={[opening.mirror ? -scale.x : scale.x, scale.y, scale.z]}>
        <group position={[-model.center.x, -model.center.y, -model.center.z]}>
          <primitive object={model.object} />
        </group>
      </group>
    </group>
  )
}

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

export function preloadOpeningModels(rooms: Room[]) {
  for (const room of rooms) {
    for (const kind of OPENING_KINDS) {
      const url = room.openingModels[kind]?.url
      if (url) useGLTF.preload(url, false, true)
    }
  }
}
