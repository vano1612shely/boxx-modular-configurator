'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, type MutableRefObject, type ReactNode } from 'react'
import {
  MathUtils,
  Vector3,
  type Group,
  type Mesh,
  type Object3D,
  type OrthographicCamera as ThreeOrthographicCamera,
  type Ray,
} from 'three'

/**
 * Gizmo primitives shared by every draggable thing in the editor.
 *
 * Handles win pointer-down in a capture-phase layer above R3F, so they must be
 * registered rather than relying on event bubbling — hence `register`.
 */

export const handleHoverProps = {
  onPointerOver: () => {
    document.body.style.cursor = 'pointer'
  },
  onPointerOut: () => {
    document.body.style.cursor = 'default'
  },
}

/** Distance at which handles render at their authored size; they keep that
 * apparent size at every zoom level (like gizmos in any 3D editor). */
const HANDLE_REF_DIST = 11
/** Ortho-camera zoom at which handles render at authored size (matches the
 * apparent size of HANDLE_REF_DIST in the perspective view). */
const HANDLE_REF_ZOOM = 72
const HANDLE_SCRATCH = new Vector3()

export type RegisterHandle = (mesh: Object3D, begin: (ray: Ray) => void) => () => void

/** A screen-constant-size group anchored at a world position. */
export function ScreenScaled({
  position,
  rotation,
  children,
  groupRef,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  children: ReactNode
  groupRef?: MutableRefObject<Group | null>
}) {
  const localRef = useRef<Group>(null)

  useFrame(({ camera }) => {
    const group = localRef.current
    if (!group) return
    // Perspective: scale by distance. Ortho (2D plan): scale by zoom —
    // either way the gizmo keeps a constant size on screen.
    const ortho = camera as ThreeOrthographicCamera
    let scale: number
    if (ortho.isOrthographicCamera) {
      scale = MathUtils.clamp(HANDLE_REF_ZOOM / ortho.zoom, 0.05, 20)
    } else {
      group.getWorldPosition(HANDLE_SCRATCH)
      scale = MathUtils.clamp(
        HANDLE_SCRATCH.distanceTo(camera.position) / HANDLE_REF_DIST,
        0.12,
        8,
      )
    }
    group.scale.setScalar(scale)
  })

  return (
    <group
      ref={(g) => {
        localRef.current = g
        if (groupRef) groupRef.current = g
      }}
      position={position}
      rotation={rotation}
    >
      {children}
    </group>
  )
}

/**
 * A draggable gizmo point. The visible geometry stays small at every zoom; an
 * invisible, slightly larger sphere is registered in the priority raycast
 * layer, so grabbing it always wins over volumes/model behind it.
 */
export function HandlePoint({
  position,
  rotation,
  hitRadius = 0.16,
  register,
  begin,
  children,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  hitRadius?: number
  register: RegisterHandle
  begin: (ray: Ray) => void
  children: ReactNode
}) {
  const hitRef = useRef<Mesh>(null)

  // Re-register on every render so `begin` closes over the freshest state.
  useEffect(() => {
    const mesh = hitRef.current
    if (!mesh) return
    return register(mesh, begin)
  })

  return (
    <ScreenScaled position={position} rotation={rotation}>
      <mesh ref={hitRef} visible={false} {...handleHoverProps}>
        <sphereGeometry args={[hitRadius, 8, 8]} />
      </mesh>
      {children}
    </ScreenScaled>
  )
}
