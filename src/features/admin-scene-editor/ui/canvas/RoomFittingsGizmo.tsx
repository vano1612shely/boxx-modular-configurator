'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { MathUtils, type Mesh, type Ray } from 'three'

import type { RoomPart } from '@/entities/building'
import { partObject } from '@/shared/three/part-object'
import { useModel } from '@/shared/three/use-model'
import { For, Show } from '@/shared/ui/control-flow'

import { selectionCentre, type PartRow } from '../../lib/part-groups'

import { HandlePoint, type RegisterHandle } from './handles'

// The exterior spots' own three, so one gesture looks the same wherever it is:
// white moves it, yellow lifts it, blue turns it.
const MOVE_COLOR = '#ffffff'
const SELECTED_COLOR = '#facc15'
const HEIGHT_COLOR = '#facc15'
const TURN_COLOR = '#38bdf8'

/** Clear of the move puck's own ring, so the two cannot be grabbed for each other. */
const MIN_RING = 0.45

type Size = { height: number; reach: number }

type Props = {
  /** Everything to draw, whether or not it can be arranged from here. */
  parts: ReadonlyArray<RoomPart>
  /** The rows of the list being arranged: one puck each, a merged object included. */
  rows: ReadonlyArray<PartRow>
  selectedKeys: ReadonlyArray<string>
  /** Top face of the room's floor — heights are measured from it. */
  floorY: number
  register: RegisterHandle
  onSelect: (keys: ReadonlyArray<string>, additive: boolean) => void
  onStartMove: (grabDX: number, grabDZ: number, planeY: number) => void
  onStartHeight: (ray: Ray, grip: [number, number, number]) => void
  onStartYaw: (ray: Ray, centre: [number, number, number]) => void
}

/**
 * One fitting, drawn where the visitor will see it.
 *
 * Draws and measures, and does nothing about being picked: a merged object is
 * grabbed by one puck standing under the whole of it, not by four pucks under
 * its base, its bottle and its two levers.
 */
function PartModel({
  part,
  floorY,
  onMeasured,
}: {
  part: RoomPart
  floorY: number
  onMeasured: (key: string, size: Size) => void
}) {
  const scene = useModel(part.modelUrl ?? '')
  const nodePath = part.nodePath

  const taken = useMemo(() => {
    const resolved = partObject(scene, nodePath)
    if (!resolved) return null

    resolved.object.traverse((node) => {
      const mesh = node as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    return resolved
  }, [scene, nodePath])

  const key = part.key
  useEffect(() => {
    if (!taken) return
    onMeasured(key, {
      height: taken.bounds.height,
      reach: Math.max(taken.bounds.width, taken.bounds.depth) / 2,
    })
  }, [taken, key, onMeasured])

  if (!taken) return null

  return (
    <group
      position={[part.position[0], floorY + part.position[1], part.position[2]]}
      rotation={[0, MathUtils.degToRad(part.yawDeg), 0]}
      scale={part.scale}
      // Read back by the right-click handler, which has a hit and needs to know
      // whose it is.
      userData={{ partKey: part.key }}
    >
      <primitive object={taken.object} />
    </group>
  )
}

/**
 * The fittings of the room being edited, with handles on what is selected.
 *
 * One set of handles for the selection rather than one per fitting: a merged
 * water cooler is one thing to move, and so are four things picked together
 * with a modifier held. The pucks are what does the picking, and there is one
 * of those per row — which is one per merged object.
 */
export function RoomFittingsGizmo({
  parts,
  rows,
  selectedKeys,
  floorY,
  register,
  onSelect,
  onStartMove,
  onStartHeight,
  onStartYaw,
}: Props) {
  const drawn = parts.filter((part) => part.source === 'model' && part.modelUrl)

  const [sizes, setSizes] = useState<Record<string, Size>>({})
  const onMeasured = useCallback((key: string, size: Size) => {
    setSizes((current) => {
      const had = current[key]
      if (had && had.height === size.height && had.reach === size.reach) return current
      return { ...current, [key]: size }
    })
  }, [])

  const byKey = useMemo(() => new Map(parts.map((part) => [part.key, part])), [parts])

  // A row of nothing but building pieces has nothing to grab: those stand where
  // the building has them, and a puck for one would sit at the room's origin
  // offering to move something that cannot move.
  const grabbable = rows.filter((entry) =>
    entry.keys.some((key) => byKey.get(key)?.source === 'model'),
  )

  /** Where a row's puck stands, and where the selection's own handles do. */
  const centreOf = (keys: ReadonlyArray<string>) => selectionCentre(parts, keys)

  const selected = centreOf(selectedKeys)

  /** The tallest thing selected, for the height arrow to clear. */
  const top = selectedKeys.reduce((highest, key) => {
    const part = byKey.get(key)
    const size = sizes[key]
    if (!part || !size) return highest
    return Math.max(highest, part.position[1] + size.height * part.scale)
  }, selected?.y ?? 0)

  /** Far enough out to go round everything selected, however it is arranged. */
  const ring = selectedKeys.reduce((widest, key) => {
    const part = byKey.get(key)
    const size = sizes[key]
    if (!part || !size || !selected) return widest
    const away = Math.hypot(part.position[0] - selected.x, part.position[2] - selected.z)
    return Math.max(widest, away + size.reach * part.scale + 0.18)
  }, MIN_RING)

  return (
    <>
      <For each={drawn} getKey={(part) => part.key}>
        {(part) => (
          <Suspense fallback={null}>
            <PartModel part={part} floorY={floorY} onMeasured={onMeasured} />
          </Suspense>
        )}
      </For>

      {/* One puck per row, on the floor under it rather than on the model: a
          puck inside a fridge is unreachable, and one on top of a counter is in
          the way of the thing being put on the counter. */}
      <For each={grabbable} getKey={(row) => row.id}>
        {(row) => {
          const at = centreOf(row.keys)
          if (!at) return null

          const y = floorY + at.y
          const picked = row.keys.every((key) => selectedKeys.includes(key))

          return (
            <HandlePoint
              position={[at.x, y + 0.01, at.z]}
              hitRadius={0.22}
              register={register}
              begin={(ray, event) => {
                // Held down, the click adds to the selection instead of
                // replacing it — and adding is not the start of a drag, or
                // picking a second object would fling the first one about.
                const additive = event.shiftKey || event.ctrlKey || event.metaKey
                onSelect(row.keys, additive)
                if (additive) return

                const t =
                  Math.abs(ray.direction.y) < 1e-6 ? null : (y - ray.origin.y) / ray.direction.y
                if (t === null || t < 0) return onStartMove(0, 0, y)
                onStartMove(
                  ray.origin.x + ray.direction.x * t - at.x,
                  ray.origin.z + ray.direction.z * t - at.z,
                  y,
                )
              }}
            >
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.26, 0.016, 8, 32]} />
                <meshBasicMaterial
                  color={picked ? SELECTED_COLOR : MOVE_COLOR}
                  depthTest={false}
                  transparent
                  opacity={picked ? 1 : 0.6}
                />
              </mesh>
            </HandlePoint>
          )
        }}
      </For>

      {/* Only around what is being arranged: handles over every fitting would be
          a forest of them, and a kitchen is a dozen pieces standing together. */}
      <Show when={selected}>
        {(at) => (
          <>
            {/* The ring turns with the selection, so the grip on its +Z arm is
                also the readout: where the grip sits is the way it faces. */}
            <group
              position={[at.x, floorY + at.y + 0.02, at.z]}
              rotation={[0, MathUtils.degToRad(byKey.get(selectedKeys[0])?.yawDeg ?? 0), 0]}
            >
              <mesh rotation-x={-Math.PI / 2} raycast={() => {}}>
                <ringGeometry args={[ring - 0.03, ring, 64]} />
                <meshBasicMaterial color={TURN_COLOR} transparent opacity={0.5} depthWrite={false} />
              </mesh>

              <HandlePoint
                position={[0, 0.03, ring]}
                hitRadius={0.3}
                register={register}
                begin={(ray) => onStartYaw(ray, [at.x, floorY + at.y, at.z])}
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
              position={[at.x, floorY + top + 0.3, at.z]}
              hitRadius={0.44}
              register={register}
              begin={(ray) => onStartHeight(ray, [at.x, floorY + top + 0.3, at.z])}
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
          </>
        )}
      </Show>
    </>
  )
}
