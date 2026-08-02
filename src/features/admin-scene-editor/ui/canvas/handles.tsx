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

// Handles are hit-tested in a capture-phase layer above R3F, so they must be
// registered rather than rely on event bubbling.

export const handleHoverProps = {
  onPointerOver: () => {
    document.body.style.cursor = 'pointer'
  },
  onPointerOut: () => {
    document.body.style.cursor = 'default'
  },
}

/** Camera distance at which handles render at their authored size. */
const HANDLE_REF_DIST = 11
/** Ortho zoom matching the apparent size HANDLE_REF_DIST gives in perspective. */
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

/** Draggable gizmo point; an oversized invisible sphere wins the raycast over anything behind it. */
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
