'use client'

import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { Box3, MathUtils, Vector3, type Ray } from 'three'

import type { Extent } from '@/entities/building'

import { HandlePoint, type RegisterHandle } from './handles'

/** Matches the roof volumes' own handles, so the same gesture looks the same. */
const MOVE_COLOR = '#ffffff'
const HEIGHT_COLOR = '#facc15'

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
  onStartMove: (grabDX: number, grabDZ: number, planeY: number) => void
  onStartHeight: (ray: Ray, grip: [number, number, number]) => void
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

  const box = useMemo(() => {
    const measured = new Box3().setFromObject(object)
    return measured.isEmpty() ? null : measured
  }, [object])

  useEffect(() => {
    if (!box) return
    onMeasured({
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
    })
  }, [box, onMeasured])

  const yaw = MathUtils.degToRad(placement.yawDeg)

  // The gizmo lives outside the placed group, so the model's own transform has
  // to be applied by hand to put a handle on it.
  const toWorld = (local: Vector3): [number, number, number] => {
    const scaled = local.clone().multiplyScalar(placement.scale)
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)
    return [
      placement.position.x + scaled.x * cos + scaled.z * sin,
      placement.position.y + scaled.y,
      placement.position.z - scaled.x * sin + scaled.z * cos,
    ]
  }

  const centre = box ? box.getCenter(new Vector3()) : new Vector3()

  // Underside for the move puck and overhead for the height arrows: a handle at
  // the centre of a roof is buried inside it, and drawing it through the
  // geometry is what made it look pasted on.
  const foot = toWorld(new Vector3(centre.x, box?.min.y ?? 0, centre.z))
  const head = toWorld(new Vector3(centre.x, box?.max.y ?? 0, centre.z))

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
            position={foot}
            hitRadius={0.24}
            register={register}
            begin={(ray) => {
              // Grab offset on the puck's own plane, so the roof does not jump
              // to centre itself under the cursor.
              const t =
                Math.abs(ray.direction.y) < 1e-6 ? null : (foot[1] - ray.origin.y) / ray.direction.y
              if (t === null || t < 0) return onStartMove(0, 0, foot[1])
              onStartMove(
                ray.origin.x + ray.direction.x * t - placement.position.x,
                ray.origin.z + ray.direction.z * t - placement.position.z,
                foot[1],
              )
            }}
          >
            <mesh>
              <cylinderGeometry args={[0.16, 0.16, 0.045, 24]} />
              <meshBasicMaterial color={MOVE_COLOR} depthTest={false} transparent />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.3, 0.018, 8, 32]} />
              <meshBasicMaterial color={MOVE_COLOR} depthTest={false} transparent opacity={0.7} />
            </mesh>
          </HandlePoint>

          {/* Wide enough to hold the cones: the tips are at 0.39, and a sphere
              that stopped at the shaft left the arrowheads inert. */}
          <HandlePoint
            position={[head[0], head[1] + 0.55, head[2]]}
            hitRadius={0.44}
            register={register}
            begin={(ray) => onStartHeight(ray, [head[0], head[1] + 0.55, head[2]])}
          >
            <mesh position={[0, 0.28, 0]}>
              <coneGeometry args={[0.11, 0.22, 16]} />
              <meshBasicMaterial color={HEIGHT_COLOR} depthTest={false} transparent />
            </mesh>
            <mesh position={[0, -0.28, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.11, 0.22, 16]} />
              <meshBasicMaterial color={HEIGHT_COLOR} depthTest={false} transparent />
            </mesh>
            <mesh>
              <cylinderGeometry args={[0.022, 0.022, 0.46, 10]} />
              <meshBasicMaterial color={HEIGHT_COLOR} depthTest={false} transparent />
            </mesh>
          </HandlePoint>
        </>
      )}
    </>
  )
}
