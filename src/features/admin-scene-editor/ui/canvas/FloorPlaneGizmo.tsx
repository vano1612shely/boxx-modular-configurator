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

/**
 * The room's floor level, as an object you can grab.
 *
 * It used to be a number in a field plus a one-shot "click something" mode,
 * which gave no feedback about what was being changed. A plane you can see and
 * drag answers "where does this room start?" without reading anything.
 */
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
      {/* raycast off: the full-size interaction plane underneath owns clicks. */}
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

      {/* The grid is what makes this read as a plane rather than a tint. */}
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

      {/* Looking straight down, `rayAtVertical` has no horizontal component to
          work with and the drag would silently do nothing — so hide the grab
          rather than offer one that does not respond. */}
      <Show when={!planMode}>
        {/* No ScreenScaled in here: HandlePoint already IS one, and nesting a
            second applied the distance scale twice — at 40 m out the arrow came
            out ~13x oversized and dwarfed the building. */}
        <HandlePoint
          position={[cx, y, cz]}
          hitRadius={0.22}
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
