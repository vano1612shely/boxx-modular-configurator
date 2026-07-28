'use client'

import { Line } from '@react-three/drei'
import type { Ray } from 'three'

import type { OpeningPlacement } from '@/entities/building'

import { HandlePoint, type RegisterHandle } from './handles'

/** Which edge of the opening a drag has hold of. */
export type OpeningGrip = 'move' | 'start' | 'end' | 'head' | 'sill'

const OUTLINE = '#4ade80'
const GRIP = '#ffffff'

type Props = {
  placement: OpeningPlacement
  register: RegisterHandle
  onStart: (grip: OpeningGrip, ray: Ray) => void
}

/**
 * The selected door or window, as something you can grab.
 *
 * Openings were four number fields and a "drag anywhere on the wall" gesture
 * that only ever slid them sideways — you could not see what was selected, and
 * resizing meant typing. This draws the hole where it actually is and puts a
 * handle on each edge: the middle slides it along the wall, the sides set the
 * width, the top and bottom set the head and the sill.
 */
export function OpeningGizmo({ placement, register, onStart }: Props) {
  const { center, tangent, normal, opening } = placement
  const halfWidth = opening.width / 2
  const halfHeight = opening.height / 2

  /** A point on the wall, offset from the opening's centre. */
  const at = (along: number, up: number): [number, number, number] => [
    center.x + tangent.x * along,
    center.y + up,
    center.z + tangent.z * along,
  ]

  // Local +Z along the wall's outward normal, so the flat grips lie in the
  // wall rather than across it. Each grip is symmetric, so which way round the
  // remaining axis points does not matter.
  const yaw = Math.atan2(normal.x, normal.z)
  const facing: [number, number, number] = [0, yaw, 0]

  return (
    <>
      <Line
        points={[
          at(-halfWidth, -halfHeight),
          at(halfWidth, -halfHeight),
          at(halfWidth, halfHeight),
          at(-halfWidth, halfHeight),
          at(-halfWidth, -halfHeight),
        ]}
        color={OUTLINE}
        lineWidth={2.5}
        depthTest={false}
        transparent
      />

      <HandlePoint
        position={at(0, 0)}
        rotation={facing}
        hitRadius={0.2}
        register={register}
        begin={(ray) => onStart('move', ray)}
      >
        <mesh>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshBasicMaterial color={OUTLINE} depthTest={false} transparent />
        </mesh>
      </HandlePoint>

      {/* Width: the two jambs. */}
      <EdgeGrip
        position={at(-halfWidth, 0)}
        rotation={facing}
        upright
        register={register}
        begin={(ray) => onStart('start', ray)}
      />
      <EdgeGrip
        position={at(halfWidth, 0)}
        rotation={facing}
        upright
        register={register}
        begin={(ray) => onStart('end', ray)}
      />

      {/* Head and sill. */}
      <EdgeGrip
        position={at(0, halfHeight)}
        rotation={facing}
        register={register}
        begin={(ray) => onStart('head', ray)}
      />
      <EdgeGrip
        position={at(0, -halfHeight)}
        rotation={facing}
        register={register}
        begin={(ray) => onStart('sill', ray)}
      />
    </>
  )
}

function EdgeGrip({
  position,
  rotation,
  upright = false,
  register,
  begin,
}: {
  position: [number, number, number]
  rotation: [number, number, number]
  /** A jamb grip stands on end; a head or sill grip lies flat. */
  upright?: boolean
  register: RegisterHandle
  begin: (ray: Ray) => void
}) {
  return (
    <HandlePoint
      position={position}
      rotation={rotation}
      hitRadius={0.16}
      register={register}
      begin={begin}
    >
      <mesh>
        <boxGeometry args={upright ? [0.05, 0.22, 0.05] : [0.22, 0.05, 0.05]} />
        <meshBasicMaterial color={GRIP} depthTest={false} transparent />
      </mesh>
    </HandlePoint>
  )
}
