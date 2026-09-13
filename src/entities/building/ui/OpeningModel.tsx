'use client'

import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { Box3, MathUtils, Vector3, type Material, type Mesh, type Object3D } from 'three'

import type { OpeningPlacement, ShellGroup } from '../lib/room-shell'
import type { OpeningFit, OpeningModelStyle, Room } from '../model/types'
import { useModel } from '@/shared/three/use-model'

/**
 * A door or window glb's materials, copied once per wall side and kept.
 *
 * drei caches one glb per URL and Object3D.clone shares material references,
 * so every instance needs its own copies or they all fade together. They used
 * to be copied per instance and disposed with it — and three's shader cache
 * counts references, so the last copy to go took the door's three programs
 * with it, and the next room compiled them again. Per side rather than per
 * instance because the side is what fades; two windows in one wall fade as
 * one anyway. Never disposed: a handful of materials per glb.
 *
 * Transparent from the start, for the same reason the shell's are: the fade
 * would otherwise switch each material between two programs.
 */
const copies = new Map<string, Map<Material, Material>>()

export function openingMaterial(url: string, side: ShellGroup, source: Material): Material {
  const key = `${url}|${side}`
  let held = copies.get(key)
  if (!held) {
    held = new Map()
    copies.set(key, held)
  }
  const kept = held.get(source)
  if (kept) return kept

  const copy = source.clone()
  copy.transparent = true
  held.set(source, copy)
  return copy
}

/** A fresh instance of the glb for one wall, drawn with that wall's copies. */
export function instantiateOpening(scene: Object3D, url: string, side: ShellGroup): Object3D {
  const object = scene.clone(true)
  object.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((entry) => openingMaterial(url, side, entry))
      : openingMaterial(url, side, mesh.material)
    mesh.castShadow = false
    mesh.receiveShadow = false
  })
  return object
}

type Props = {
  placement: OpeningPlacement
  style: OpeningModelStyle
}

export function OpeningModel({ placement, style }: Props) {
  // The URL is checked by the caller; a null one never reaches this component.
  const scene = useModel(style.url as string)

  const { opening, center, normal, side } = placement

  const model = useMemo(() => {
    const object = instantiateOpening(scene, style.url as string, side)

    // Must be measured while the clone is parentless: setFromObject walks world
    // matrices, so measuring after mount folds this component's scale back in.
    const bounds = new Box3().setFromObject(object)

    return {
      object,
      size: bounds.getSize(new Vector3()),
      center: bounds.getCenter(new Vector3()),
    }
  }, [scene, style.url, side])

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
    for (const style of Object.values(room.openingModels)) {
      if (style?.url) useGLTF.preload(style.url, false, true)
    }
  }
}
