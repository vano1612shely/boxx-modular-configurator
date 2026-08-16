'use client'

import { useGLTF } from '@react-three/drei'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Box3, BoxGeometry, DoubleSide, MathUtils, Vector3, type Mesh, type Ray } from 'three'

import { assetUrl } from '@/shared/lib'
import { For, Show } from '@/shared/ui/control-flow'

import { slotToWorld } from '../../lib/slot-drag'
import type { SceneEditorVm } from '../../model/use-scene-editor-model'
import { tone } from '../editor-styles'
import { HandlePoint, type RegisterHandle } from './handles'

/** Same colours the roof and the volumes use, so the same gesture looks the same. */
const MOVE_COLOR = '#ffffff'
const HEIGHT_COLOR = '#facc15'
const TURN_COLOR = '#38bdf8'
const CAGE_COLOR = '#a78bfa'

/** Metres out from the spot, where the turn grip rides. */
const RING = 1.1
/** Metres up, where the height arrows sit clear of whatever is on the spot. */
const LIFT = 1.4

type SlotRow = SceneEditorVm['exteriorSlots'][number]
type VariantRow = NonNullable<SlotRow['variants']>[number]
type PartRow = NonNullable<VariantRow['parts']>[number]

function PartModel({
  url,
  part,
  index,
  onMeasured,
}: {
  url: string
  part: PartRow
  index: number
  onMeasured?: (index: number, box: Box3) => void
}) {
  const { scene } = useGLTF(url, false, true)

  const object = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    return clone
  }, [scene])

  // Measured unscaled and untranslated, so the caller can draw a box around it
  // at whatever scale the part is currently set to.
  const box = useMemo(() => {
    const measured = new Box3().setFromObject(object)
    return measured.isEmpty() ? null : measured
  }, [object])

  useEffect(() => {
    if (box && onMeasured) onMeasured(index, box)
  }, [box, index, onMeasured])

  return (
    <primitive
      object={object}
      position={[part.position?.x ?? 0, part.position?.y ?? 0, part.position?.z ?? 0]}
      rotation-y={MathUtils.degToRad(part.yawDeg ?? 0)}
      scale={part.scale && part.scale > 0 ? part.scale : 1}
    />
  )
}

/** The eight corners of a box, as offsets from its centre. */
const CORNERS: Array<[number, number, number]> = [
  [-1, -1, -1],
  [1, -1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [-1, 1, -1],
  [1, 1, -1],
  [-1, 1, 1],
  [1, 1, 1],
]

/**
 * The cage around the model being placed: clear panes, drawn edges, a grip at
 * every corner.
 *
 * Sized from the model itself rather than authored, so it fits whatever came out
 * of the exporter — which is the whole reason it is here, since two imports
 * rarely arrive at the same size or with the same origin.
 */
function PartCage({
  box,
  scale,
  register,
  onStartScale,
}: {
  box: Box3
  scale: number
  register: RegisterHandle
  onStartScale: (ray: Ray, corner: [number, number, number]) => void
}) {
  const size = box.getSize(new Vector3()).multiplyScalar(scale)
  const centre = box.getCenter(new Vector3()).multiplyScalar(scale)
  const half: [number, number, number] = [size.x / 2, size.y / 2, size.z / 2]

  return (
    <group position={[centre.x, centre.y, centre.z]}>
      <mesh raycast={() => {}}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial
          color={CAGE_COLOR}
          transparent
          opacity={0.06}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <lineSegments raycast={() => {}}>
        <edgesGeometry args={[new BoxGeometry(size.x, size.y, size.z)]} />
        <lineBasicMaterial color={CAGE_COLOR} transparent opacity={0.9} depthTest={false} />
      </lineSegments>

      <For each={CORNERS} getKey={(corner) => corner.join(',')}>
        {(corner) => {
          const at: [number, number, number] = [
            corner[0] * half[0],
            corner[1] * half[1],
            corner[2] * half[2],
          ]

          return (
            <HandlePoint
              position={at}
              hitRadius={0.2}
              register={register}
              begin={(ray) => onStartScale(ray, corner)}
            >
              <mesh>
                <boxGeometry args={[0.11, 0.11, 0.11]} />
                <meshBasicMaterial color={CAGE_COLOR} depthTest={false} transparent />
              </mesh>
            </HandlePoint>
          )
        }}
      </For>
    </group>
  )
}

/**
 * Which choice a spot is showing in the viewport.
 *
 * The selected spot follows the preview switch, so an admin can step through
 * what the visitor will see; every other spot shows its own default, so the
 * building around the one being worked on looks the way it will ship.
 */
export function shownVariantIndex(vm: SceneEditorVm, slotIndex: number): number | null {
  const slot = vm.exteriorSlots[slotIndex]
  const variants = slot?.variants ?? []
  if (variants.length === 0) return null

  if (slotIndex === vm.selectedSlotIndex) return vm.previewVariantIndex ?? 0

  const named = variants.findIndex((variant) => variant.key === slot?.defaultVariantKey)
  return named >= 0 ? named : 0
}

type Props = {
  vm: SceneEditorVm
  register: RegisterHandle
  onStartMove: (index: number, part: number | null, ray: Ray, planeY: number) => void
  onStartHeight: (
    index: number,
    part: number | null,
    ray: Ray,
    grip: [number, number, number],
  ) => void
  onStartYaw: (
    index: number,
    part: number | null,
    ray: Ray,
    centre: [number, number, number],
  ) => void
  onStartScale: (
    index: number,
    part: number,
    ray: Ray,
    corner: [number, number, number],
  ) => void
}

/**
 * The exterior spots, as the visitor would meet them, with the selected one's
 * handles on top.
 *
 * A marker stands at each one whether or not it has anything to show yet —
 * a spot with no choices is invisible otherwise, and an admin who has just
 * added one needs to see where it landed before they can move it.
 */
export function ExteriorSpots({
  vm,
  register,
  onStartMove,
  onStartHeight,
  onStartYaw,
  onStartScale,
}: Props) {
  // The selected model's own size, reported by whichever part is wearing the
  // handles. Kept with the index it was measured for, so the cage never shows
  // one model's size around another.
  const [sized, setSized] = useState<{ part: number; box: Box3 } | null>(null)
  const measure = useCallback((part: number, box: Box3) => setSized({ part, box }), [])

  return (
    <For each={vm.exteriorSlots} getKey={(slot, index) => slot.key || String(index)}>
      {(slot, index) => {
        const shown = shownVariantIndex(vm, index)
        const variant = shown === null ? null : (slot.variants ?? [])[shown]
        const selected = vm.selectedSlotIndex === index
        const centre: [number, number, number] = [
          slot.position?.x ?? 0,
          slot.position?.y ?? 0,
          slot.position?.z ?? 0,
        ]

        // What the handles are on: one part of the choice, or the spot itself.
        const part = selected ? vm.selectedPartIndex : null
        const handled = part === null ? slot : ((variant?.parts ?? [])[part] ?? slot)
        const origin =
          part === null || handled === slot
            ? centre
            : ((): [number, number, number] => {
                const world = slotToWorld(
                  { x: centre[0], y: centre[1], z: centre[2], yawDeg: slot.yawDeg ?? 0 },
                  {
                    x: handled.position?.x ?? 0,
                    y: handled.position?.y ?? 0,
                    z: handled.position?.z ?? 0,
                  },
                )
                return [world.x, world.y, world.z]
              })()

        return (
          <group position={centre} rotation-y={MathUtils.degToRad(slot.yawDeg ?? 0)}>
            {/* Where the spot is, and which way it faces — the offsets of every
                part are read from here, so it has to be visible even when the
                choice showing is made entirely of the building's own objects. */}
            <mesh
              position={[0, 0.02, 0]}
              rotation-x={-Math.PI / 2}
              onClick={(event) => {
                event.stopPropagation()
                vm.onSelectSlot(selected ? null : index)
              }}
            >
              <circleGeometry args={[0.45, 32]} />
              <meshBasicMaterial
                color={selected ? tone.accent : tone.node}
                transparent
                opacity={selected ? 0.85 : 0.45}
                depthWrite={false}
              />
            </mesh>
            <mesh position={[0, 0.02, 0.55]} rotation-x={-Math.PI / 2} raycast={() => {}}>
              <circleGeometry args={[0.16, 3]} />
              <meshBasicMaterial
                color={selected ? tone.accent : tone.node}
                transparent
                opacity={selected ? 0.85 : 0.45}
                depthWrite={false}
              />
            </mesh>

            <Show when={variant}>
              {(shownVariant) => (
                <For each={shownVariant.parts ?? []} getKey={(_, i) => String(i)}>
                  {(one, partIndex) => {
                    const url = typeof one.model === 'object' ? assetUrl(one.model) : null
                    if (!url) return null

                    return (
                      <Suspense fallback={null}>
                        <PartModel
                          url={url}
                          part={one}
                          index={partIndex}
                          onMeasured={partIndex === part ? measure : undefined}
                        />
                      </Suspense>
                    )
                  }}
                </For>
              )}
            </Show>

            {/* Handles live inside the frame of whatever they move — the spot,
                or one part of it — so the turn grip rides round with the facing
                it sets and needs no maths to place. */}
            <Show when={selected}>
              <group
                position={[
                  handled?.position?.x ?? 0,
                  handled?.position?.y ?? 0,
                  handled?.position?.z ?? 0,
                ]}
                rotation-y={MathUtils.degToRad(handled?.yawDeg ?? 0)}
              >
                <Show when={part !== null && sized?.part === part && sized.box}>
                  {(box) => (
                    <PartCage
                      box={box}
                      scale={(handled as PartRow)?.scale || 1}
                      register={register}
                      onStartScale={(ray, corner) => onStartScale(index, part!, ray, corner)}
                    />
                  )}
                </Show>

                <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2} raycast={() => {}}>
                  <ringGeometry args={[RING - 0.03, RING, 64]} />
                  <meshBasicMaterial
                    color={TURN_COLOR}
                    transparent
                    opacity={0.5}
                    depthWrite={false}
                  />
                </mesh>

                <HandlePoint
                  position={[0, 0.05, 0]}
                  hitRadius={0.26}
                  register={register}
                  begin={(ray) => onStartMove(index, part, ray, origin[1])}
                >
                  <mesh>
                    <cylinderGeometry args={[0.16, 0.16, 0.045, 24]} />
                    <meshBasicMaterial color={MOVE_COLOR} depthTest={false} transparent />
                  </mesh>
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.3, 0.018, 8, 32]} />
                    <meshBasicMaterial
                      color={MOVE_COLOR}
                      depthTest={false}
                      transparent
                      opacity={0.7}
                    />
                  </mesh>
                </HandlePoint>

                <HandlePoint
                  position={[0, LIFT, 0]}
                  hitRadius={0.24}
                  register={register}
                  begin={(ray) =>
                    onStartHeight(index, part, ray, [origin[0], origin[1] + LIFT, origin[2]])
                  }
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

                {/* On the +Z arm, which is the direction the facing points, so
                    the grip is also the readout: where it sits is where the
                    thing it turns is pointing. */}
                <HandlePoint
                  position={[0, 0.05, RING]}
                  hitRadius={0.24}
                  register={register}
                  begin={(ray) => onStartYaw(index, part, ray, origin)}
                >
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.13, 0.13, 0.05, 20]} />
                    <meshBasicMaterial color={TURN_COLOR} depthTest={false} transparent />
                  </mesh>
                  <mesh position={[0, 0, 0.22]} rotation={[-Math.PI / 2, 0, 0]}>
                    <coneGeometry args={[0.1, 0.2, 16]} />
                    <meshBasicMaterial color={TURN_COLOR} depthTest={false} transparent />
                  </mesh>
                </HandlePoint>
              </group>
            </Show>
          </group>
        )
      }}
    </For>
  )
}
