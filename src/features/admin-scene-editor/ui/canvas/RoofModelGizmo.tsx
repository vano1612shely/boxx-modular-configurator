'use client'

import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { Box3, MathUtils, Vector3 } from 'three'

import type { Extent } from '@/entities/building'

import { HandlePoint, type RegisterHandle } from './handles'

const COLOR = '#38bdf8'

type Placement = {
  position: { x: number; y: number; z: number }
  yawDeg: number
  scale: number
}

type Props = {
  url: string
  placement: Placement
  visible: boolean
  register: RegisterHandle
  onMeasured: (bounds: Extent) => void
  onStartMove: (grabDX: number, grabDZ: number) => void
  onStartHeight: () => void
}

export function RoofModelGizmo({
  url,
  placement,
  visible,
  register,
  onMeasured,
  onStartMove,
  onStartHeight,
}: Props) {
  const { scene } = useGLTF(url, false, true)
  const object = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    const box = new Box3().setFromObject(object)
    if (box.isEmpty()) return
    onMeasured({
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
    })
  }, [object, onMeasured])

  const centre = useMemo(() => {
    const box = new Box3().setFromObject(object)
    if (box.isEmpty()) return new Vector3()
    return box.getCenter(new Vector3())
  }, [object])

  const yaw = MathUtils.degToRad(placement.yawDeg)
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const local = centre.clone().multiplyScalar(placement.scale)
  const grip: [number, number, number] = [
    placement.position.x + local.x * cos + local.z * sin,
    placement.position.y + local.y,
    placement.position.z - local.x * sin + local.z * cos,
  ]

  return (
    <>
      <group
        visible={visible}
        position={[placement.position.x, placement.position.y, placement.position.z]}
        rotation={[0, yaw, 0]}
        scale={placement.scale}
      >
        <primitive object={object} />
      </group>

      {visible && (
        <>
          <HandlePoint
            position={grip}
            hitRadius={0.3}
            register={register}
            begin={(ray) => {
              // Grab offset, so the roof does not jump to centre under the cursor.
              const t = Math.abs(ray.direction.y) < 1e-6 ? null : (grip[1] - ray.origin.y) / ray.direction.y
              if (t === null || t < 0) return onStartMove(0, 0)
              onStartMove(
                ray.origin.x + ray.direction.x * t - placement.position.x,
                ray.origin.z + ray.direction.z * t - placement.position.z,
              )
            }}
          >
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.24, 0.24, 0.03, 24]} />
              <meshBasicMaterial color={COLOR} transparent opacity={0.9} depthTest={false} />
            </mesh>
          </HandlePoint>

          <HandlePoint
            position={[grip[0], grip[1] + 0.9, grip[2]]}
            hitRadius={0.22}
            register={register}
            begin={() => onStartHeight()}
          >
            <mesh position={[0, 0.28, 0]}>
              <coneGeometry args={[0.11, 0.22, 16]} />
              <meshBasicMaterial color={COLOR} depthTest={false} transparent />
            </mesh>
            <mesh position={[0, -0.28, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.11, 0.22, 16]} />
              <meshBasicMaterial color={COLOR} depthTest={false} transparent />
            </mesh>
            <mesh>
              <cylinderGeometry args={[0.022, 0.022, 0.46, 10]} />
              <meshBasicMaterial color={COLOR} depthTest={false} transparent />
            </mesh>
          </HandlePoint>
        </>
      )}
    </>
  )
}
