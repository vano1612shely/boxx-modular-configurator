'use client'

import { useGLTF } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import { MathUtils, type Mesh, type Ray } from 'three'

import { assetUrl } from '@/shared/lib'
import { For, Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../model/use-scene-editor-model'
import { tone } from '../editor-styles'
import { HandlePoint, type RegisterHandle } from './handles'

/** Same colours the roof and the volumes use, so the same gesture looks the same. */
const MOVE_COLOR = '#ffffff'
const HEIGHT_COLOR = '#facc15'
const TURN_COLOR = '#38bdf8'

/** Metres out from the spot, where the turn grip rides. */
const RING = 1.1
/** Metres up, where the height arrows sit clear of whatever is on the spot. */
const LIFT = 1.4

type SlotRow = SceneEditorVm['exteriorSlots'][number]
type VariantRow = NonNullable<SlotRow['variants']>[number]
type PartRow = NonNullable<VariantRow['parts']>[number]

function PartModel({ url, part }: { url: string; part: PartRow }) {
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

  return (
    <primitive
      object={object}
      position={[part.position?.x ?? 0, part.position?.y ?? 0, part.position?.z ?? 0]}
      rotation-y={MathUtils.degToRad(part.yawDeg ?? 0)}
      scale={part.scale && part.scale > 0 ? part.scale : 1}
    />
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
  onStartMove: (index: number, ray: Ray, planeY: number) => void
  onStartHeight: (index: number, ray: Ray, grip: [number, number, number]) => void
  onStartYaw: (index: number, ray: Ray, centre: [number, number, number]) => void
}

/**
 * The exterior spots, as the visitor would meet them, with the selected one's
 * handles on top.
 *
 * A marker stands at each one whether or not it has anything to show yet —
 * a spot with no choices is invisible otherwise, and an admin who has just
 * added one needs to see where it landed before they can move it.
 */
export function ExteriorSpots({ vm, register, onStartMove, onStartHeight, onStartYaw }: Props) {
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
                  {(part) => {
                    const url = typeof part.model === 'object' ? assetUrl(part.model) : null
                    if (!url) return null

                    return (
                      <Suspense fallback={null}>
                        <PartModel url={url} part={part} />
                      </Suspense>
                    )
                  }}
                </For>
              )}
            </Show>

            {/* Handles live inside the spot's own frame, so the turn grip rides
                round with the facing it sets and needs no maths to place. */}
            <Show when={selected}>
              <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2} raycast={() => {}}>
                <ringGeometry args={[RING - 0.03, RING, 64]} />
                <meshBasicMaterial color={TURN_COLOR} transparent opacity={0.5} depthWrite={false} />
              </mesh>

              <HandlePoint
                position={[0, 0.05, 0]}
                hitRadius={0.26}
                register={register}
                begin={(ray) => onStartMove(index, ray, centre[1])}
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
                begin={(ray) => onStartHeight(index, ray, [centre[0], centre[1] + LIFT, centre[2]])}
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

              {/* On the +Z arm, which is the direction the facing points, so the
                  grip is also the readout: where it sits is where the spot
                  faces. */}
              <HandlePoint
                position={[0, 0.05, RING]}
                hitRadius={0.24}
                register={register}
                begin={(ray) => onStartYaw(index, ray, centre)}
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
            </Show>
          </group>
        )
      }}
    </For>
  )
}
