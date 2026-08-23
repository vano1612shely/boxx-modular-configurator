'use client'

import { Suspense, useMemo } from 'react'
import { MathUtils, type Mesh, type Ray } from 'three'

import type { RoomPart } from '@/entities/building'
import { centreOnFootprint } from '@/shared/three/centre-model'
import { useModel } from '@/shared/three/use-model'
import { For, Show } from '@/shared/ui/control-flow'

import { HandlePoint, type RegisterHandle } from './handles'

// The exterior spots' own three, so one gesture looks the same wherever it is:
// white moves it, yellow lifts it, blue turns it.
const MOVE_COLOR = '#ffffff'
const SELECTED_COLOR = '#facc15'
const HEIGHT_COLOR = '#facc15'
const TURN_COLOR = '#38bdf8'

/** Clear of the move puck's own ring, so the two cannot be grabbed for each other. */
const MIN_RING = 0.45

type Props = {
  parts: ReadonlyArray<RoomPart>
  /** Top face of the room's floor — heights are measured from it. */
  floorY: number
  selectedKey: string | null
  register: RegisterHandle
  onSelect: (key: string) => void
  onStartMove: (key: string, grabDX: number, grabDZ: number, planeY: number) => void
  onStartHeight: (key: string, ray: Ray, grip: [number, number, number]) => void
  onStartYaw: (key: string, ray: Ray, centre: [number, number, number]) => void
}

/**
 * One fitting as the visitor will see it, with a puck to drag it by.
 *
 * The same centring the scene does, so what the admin lines up is what lands:
 * the model is put over the middle of its own footprint and stood on its own
 * base, and the numbers on the panel then mean the middle and the height above
 * this room's floor.
 */
function PartGizmo({
  part,
  floorY,
  selected,
  register,
  onSelect,
  onStartMove,
  onStartHeight,
  onStartYaw,
}: {
  part: RoomPart
  floorY: number
  selected: boolean
  register: RegisterHandle
  onSelect: () => void
  onStartMove: (grabDX: number, grabDZ: number, planeY: number) => void
  onStartHeight: (ray: Ray, grip: [number, number, number]) => void
  onStartYaw: (ray: Ray, centre: [number, number, number]) => void
}) {
  const scene = useModel(part.modelUrl ?? '')

  const { object, height, reach } = useMemo(() => {
    const clone = scene.clone(true)
    const measured = centreOnFootprint(clone)
    clone.position.y -= measured.baseY
    clone.traverse((node) => {
      const mesh = node as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    return {
      object: clone,
      height: measured.height,
      reach: Math.max(measured.width, measured.depth) / 2,
    }
  }, [scene])

  const y = floorY + part.position[1]
  /** Just clear of the top, so the arrows are not buried in the model. */
  const headY = y + height * part.scale + 0.3
  /** Sized to the fitting: one ring for a fridge and a coffee machine alike. */
  const ring = Math.max(reach * part.scale + 0.18, MIN_RING)

  return (
    <>
      <group
        position={[part.position[0], y, part.position[2]]}
        rotation={[0, MathUtils.degToRad(part.yawDeg), 0]}
        scale={part.scale}
      >
        <primitive object={object} />
      </group>

      {/* On the floor under it rather than on the model: a puck inside a fridge
          is unreachable, and one on top of a counter is in the way of the thing
          being put on the counter. */}
      <HandlePoint
        position={[part.position[0], y + 0.01, part.position[2]]}
        hitRadius={0.22}
        register={register}
        begin={(ray) => {
          onSelect()
          const t =
            Math.abs(ray.direction.y) < 1e-6 ? null : (y - ray.origin.y) / ray.direction.y
          if (t === null || t < 0) return onStartMove(0, 0, y)
          onStartMove(
            ray.origin.x + ray.direction.x * t - part.position[0],
            ray.origin.z + ray.direction.z * t - part.position[2],
            y,
          )
        }}
      >
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.26, 0.016, 8, 32]} />
          <meshBasicMaterial
            color={selected ? SELECTED_COLOR : MOVE_COLOR}
            depthTest={false}
            transparent
            opacity={selected ? 1 : 0.6}
          />
        </mesh>
      </HandlePoint>

      {/* Only on the one being arranged: handles over every fitting would be a
          forest of them, and a kitchen is a dozen pieces standing together. */}
      <Show when={selected}>
        {/* The ring turns with the fitting, so the grip on its +Z arm is also
            the readout: where the grip sits is the way the thing is facing. */}
        <group
          position={[part.position[0], y + 0.02, part.position[2]]}
          rotation={[0, MathUtils.degToRad(part.yawDeg), 0]}
        >
          <mesh rotation-x={-Math.PI / 2} raycast={() => {}}>
            <ringGeometry args={[ring - 0.03, ring, 64]} />
            <meshBasicMaterial color={TURN_COLOR} transparent opacity={0.5} depthWrite={false} />
          </mesh>

          <HandlePoint
            position={[0, 0.03, ring]}
            hitRadius={0.3}
            register={register}
            begin={(ray) => {
              onSelect()
              onStartYaw(ray, [part.position[0], y, part.position[2]])
            }}
          >
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.11, 0.11, 0.045, 20]} />
              <meshBasicMaterial color={TURN_COLOR} depthTest={false} transparent />
            </mesh>
            <mesh position={[0, 0, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.09, 0.18, 16]} />
              <meshBasicMaterial color={TURN_COLOR} depthTest={false} transparent />
            </mesh>
          </HandlePoint>
        </group>

        <HandlePoint
          position={[part.position[0], headY, part.position[2]]}
          hitRadius={0.44}
          register={register}
          begin={(ray) => onStartHeight(ray, [part.position[0], headY, part.position[2]])}
        >
          <mesh position={[0, 0.28, 0]}>
            <coneGeometry args={[0.09, 0.2, 16]} />
            <meshBasicMaterial color={HEIGHT_COLOR} depthTest={false} transparent />
          </mesh>
          <mesh position={[0, -0.28, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.09, 0.2, 16]} />
            <meshBasicMaterial color={HEIGHT_COLOR} depthTest={false} transparent />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.018, 0.018, 0.46, 10]} />
            <meshBasicMaterial color={HEIGHT_COLOR} depthTest={false} transparent />
          </mesh>
        </HandlePoint>
      </Show>
    </>
  )
}

/**
 * The fittings of the room being edited, drawn where the visitor will see them.
 *
 * Model parts only. A piece of the building taken into the room is already on
 * screen — it is the building — so drawing a copy over it would put two
 * counters in the same place and make the admin wonder which one moves.
 */
export function RoomFittingsGizmo({
  parts,
  floorY,
  selectedKey,
  register,
  onSelect,
  onStartMove,
  onStartHeight,
  onStartYaw,
}: Props) {
  const drawn = parts.filter((part) => part.source === 'model' && part.modelUrl)

  return (
    <For each={drawn} getKey={(part) => part.key}>
      {(part) => (
        <Suspense fallback={null}>
          <PartGizmo
            part={part}
            floorY={floorY}
            selected={selectedKey === part.key}
            register={register}
            onSelect={() => onSelect(part.key)}
            onStartMove={(dx, dz, planeY) => onStartMove(part.key, dx, dz, planeY)}
            onStartHeight={(ray, grip) => onStartHeight(part.key, ray, grip)}
            onStartYaw={(ray, centre) => onStartYaw(part.key, ray, centre)}
          />
        </Suspense>
      )}
    </For>
  )
}
