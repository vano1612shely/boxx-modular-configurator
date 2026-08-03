'use client'

import { Grid, Line } from '@react-three/drei'
import { DoubleSide } from 'three'

import { Show } from '@/shared/ui/control-flow'

import type { PlaneBounds } from '../../lib/floor-plane'
import { HandlePoint, type RegisterHandle } from './handles'

const COLOR = '#38bdf8'

type Props = {
  y: number
  bounds: PlaneBounds
  planMode: boolean
  register: RegisterHandle
  onStartDrag: (cx: number, cz: number) => void
}

export function FloorPlaneGizmo({ y, bounds, planMode, register, onStartDrag }: Props) {
  const width = Math.max(bounds.maxX - bounds.minX, 0.5)
  const depth = Math.max(bounds.maxZ - bounds.minZ, 0.5)
  const cx = (bounds.minX + bounds.maxX) / 2
  const cz = (bounds.minZ + bounds.maxZ) / 2

  const outline: Array<[number, number, number]> = [
    [bounds.minX, y, bounds.minZ],
    [bounds.maxX, y, bounds.minZ],
    [bounds.maxX, y, bounds.maxZ],
    [bounds.minX, y, bounds.maxZ],
    [bounds.minX, y, bounds.minZ],
  ]

  return (
    <>
      <mesh position={[cx, y, cz]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial
          color={COLOR}
          transparent
          opacity={0.1}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>

      <Grid
        position={[cx, y + 0.002, cz]}
        args={[width, depth]}
        cellSize={0.5}
        sectionSize={2}
        cellColor="#2b6a8f"
        sectionColor={COLOR}
        fadeDistance={120}
        side={DoubleSide}
      />

      <Line points={outline} color={COLOR} lineWidth={2} />

      {/* Looking straight down, `rayAtVertical` has no horizontal component and the drag cannot resolve. */}
      <Show when={!planMode}>
        {/* No ScreenScaled here: HandlePoint already is one, and nesting applies the scale twice.
            The radius covers the whole arrow — the cones reach 0.41, and a press that
            missed the old 0.22 sphere fell through to whatever volume was behind it. */}
        <HandlePoint
          position={[cx, y, cz]}
          hitRadius={0.55}
          register={register}
          begin={() => onStartDrag(cx, cz)}
        >
          <mesh position={[0, 0.3, 0]}>
            <coneGeometry args={[0.11, 0.22, 16]} />
            <meshBasicMaterial color={COLOR} depthTest={false} transparent />
          </mesh>
          <mesh position={[0, -0.3, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.11, 0.22, 16]} />
            <meshBasicMaterial color={COLOR} depthTest={false} transparent />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.022, 0.022, 0.5, 10]} />
            <meshBasicMaterial color={COLOR} depthTest={false} transparent />
          </mesh>
        </HandlePoint>
      </Show>
    </>
  )
}
