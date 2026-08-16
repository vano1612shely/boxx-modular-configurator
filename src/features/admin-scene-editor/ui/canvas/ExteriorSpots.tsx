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

/** Metres out from a model, where its turn grip rides. */
const RING = 1.1
/** Metres up, where the height arrows sit clear of what they lift. */
const LIFT = 1.4

type SlotRow = SceneEditorVm['exteriorSlots'][number]
type VariantRow = NonNullable<SlotRow['variants']>[number]
type PartRow = NonNullable<VariantRow['parts']>[number]
type Triple = [number, number, number]

function PartModel({
  url,
  part,
  index,
  onMeasured,
}: {
  url: string
  part: PartRow
  index: number
  onMeasured: (index: number, box: Box3) => void
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

  // Measured unscaled and untranslated, so a cage can be drawn round it at
  // whatever scale the part is currently set to.
  const box = useMemo(() => {
    const measured = new Box3().setFromObject(object)
    return measured.isEmpty() ? null : measured
  }, [object])

  useEffect(() => {
    if (box) onMeasured(index, box)
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

/** The eight corners of a box, as signs on each axis. */
const CORNERS: Triple[] = [
  [-1, -1, -1],
  [1, -1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [-1, 1, -1],
  [1, 1, -1],
  [-1, 1, 1],
  [1, 1, 1],
]

function MovePuck({ register, begin }: { register: RegisterHandle; begin: (ray: Ray) => void }) {
  return (
    <HandlePoint position={[0, 0.05, 0]} hitRadius={0.26} register={register} begin={begin}>
      <mesh>
        <cylinderGeometry args={[0.16, 0.16, 0.045, 24]} />
        <meshBasicMaterial color={MOVE_COLOR} depthTest={false} transparent />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.018, 8, 32]} />
        <meshBasicMaterial color={MOVE_COLOR} depthTest={false} transparent opacity={0.7} />
      </mesh>
    </HandlePoint>
  )
}

function HeightArrows({
  register,
  begin,
}: {
  register: RegisterHandle
  begin: (ray: Ray) => void
}) {
  return (
    <HandlePoint position={[0, LIFT, 0]} hitRadius={0.24} register={register} begin={begin}>
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
  )
}

/**
 * The cage around a model: clear panes, drawn edges, a grip at every corner,
 * and the move, lift and turn handles at its middle.
 *
 * Sized from the model itself rather than authored, which is the whole point —
 * two imports rarely arrive at the same size or with the same origin, and until
 * there was a box round one there was no way to see how big it had come out.
 */
function PartCage({
  box,
  scale,
  register,
  onStartScale,
  onStartMove,
  onStartHeight,
  onStartYaw,
}: {
  box: Box3
  scale: number
  register: RegisterHandle
  onStartScale: (ray: Ray) => void
  onStartMove: (ray: Ray) => void
  onStartHeight: (ray: Ray) => void
  onStartYaw: (ray: Ray) => void
}) {
  const size = box.getSize(new Vector3()).multiplyScalar(scale)
  const centre = box.getCenter(new Vector3()).multiplyScalar(scale)
  const half: Triple = [size.x / 2, size.y / 2, size.z / 2]
  const geometry = useMemo(() => new BoxGeometry(size.x, size.y, size.z), [size.x, size.y, size.z])

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
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial color={CAGE_COLOR} transparent opacity={0.9} depthTest={false} />
      </lineSegments>

      <For each={CORNERS} getKey={(corner) => corner.join(',')}>
        {(corner) => (
          <HandlePoint
            position={[corner[0] * half[0], corner[1] * half[1], corner[2] * half[2]]}
            hitRadius={0.2}
            register={register}
            begin={onStartScale}
          >
            <mesh>
              <boxGeometry args={[0.11, 0.11, 0.11]} />
              <meshBasicMaterial color={CAGE_COLOR} depthTest={false} transparent />
            </mesh>
          </HandlePoint>
        )}
      </For>

      <mesh position={[0, -half[1] + 0.02, 0]} rotation-x={-Math.PI / 2} raycast={() => {}}>
        <ringGeometry args={[RING - 0.03, RING, 64]} />
        <meshBasicMaterial color={TURN_COLOR} transparent opacity={0.5} depthWrite={false} />
      </mesh>

      <MovePuck register={register} begin={onStartMove} />
      <HeightArrows register={register} begin={onStartHeight} />

      {/* On the +Z arm, so the grip is also the readout: where it sits is the
          way the model is pointing. */}
      <HandlePoint
        position={[0, -half[1] + 0.05, RING]}
        hitRadius={0.24}
        register={register}
        begin={onStartYaw}
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
  onStartHeight: (index: number, part: number | null, ray: Ray, grip: Triple) => void
  onStartYaw: (index: number, part: number | null, ray: Ray, centre: Triple) => void
  onStartScale: (index: number, part: number, ray: Ray) => void
}

/**
 * The exterior spots, as the visitor would meet them, with handles on the
 * selected one.
 *
 * Two things wear handles and they never take turns. A spot is a point in space
 * — where the visitor's marker hangs and what the models are offset from — so
 * it gets a puck and a lift and nothing else; turning it would have been one
 * more thing to set that changed nothing anyone could see. The model in the
 * previewed choice gets the cage, and gets it the moment the choice is on
 * screen rather than after being selected first.
 */
export function ExteriorSpots({
  vm,
  register,
  onStartMove,
  onStartHeight,
  onStartYaw,
  onStartScale,
}: Props) {
  // Kept with the index it was measured for, so the cage never shows one
  // model's size around another.
  const [sized, setSized] = useState<{ part: number; box: Box3 } | null>(null)
  const measure = useCallback((part: number, box: Box3) => setSized({ part, box }), [])

  return (
    <For each={vm.exteriorSlots} getKey={(slot, index) => slot.key || String(index)}>
      {(slot, index) => {
        const shown = shownVariantIndex(vm, index)
        const variant = shown === null ? null : (slot.variants ?? [])[shown]
        const selected = vm.selectedSlotIndex === index
        const spot: Triple = [slot.position?.x ?? 0, slot.position?.y ?? 0, slot.position?.z ?? 0]

        const part = selected ? vm.selectedPartIndex : null
        const held = part === null ? null : ((variant?.parts ?? [])[part] ?? null)
        const heldAt: Triple = [
          held?.position?.x ?? 0,
          held?.position?.y ?? 0,
          held?.position?.z ?? 0,
        ]
        const heldWorld = slotToWorld(
          { x: spot[0], y: spot[1], z: spot[2], yawDeg: slot.yawDeg ?? 0 },
          { x: heldAt[0], y: heldAt[1], z: heldAt[2] },
        )
        const heldOrigin: Triple = [heldWorld.x, heldWorld.y, heldWorld.z]

        return (
          <group position={spot} rotation-y={MathUtils.degToRad(slot.yawDeg ?? 0)}>
            {/* Where the spot is. Visible on every spot, so one just added can
                be found; the marker is the only thing a visitor ever sees of it. */}
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

            <Show when={variant}>
              {(shownVariant) => (
                <For each={shownVariant.parts ?? []} getKey={(_, i) => String(i)}>
                  {(one, partIndex) => {
                    const url = typeof one.model === 'object' ? assetUrl(one.model) : null
                    if (!url) return null

                    return (
                      <Suspense fallback={null}>
                        <PartModel url={url} part={one} index={partIndex} onMeasured={measure} />
                      </Suspense>
                    )
                  }}
                </For>
              )}
            </Show>

            <Show when={selected}>
              <MovePuck
                register={register}
                begin={(ray) => onStartMove(index, null, ray, spot[1])}
              />
              <HeightArrows
                register={register}
                begin={(ray) =>
                  onStartHeight(index, null, ray, [spot[0], spot[1] + LIFT, spot[2]])
                }
              />

              <Show when={held !== null && part !== null && sized?.part === part && sized.box}>
                {(box) => (
                  <group
                    position={heldAt}
                    rotation-y={MathUtils.degToRad(held?.yawDeg ?? 0)}
                  >
                    <PartCage
                      box={box}
                      scale={held?.scale || 1}
                      register={register}
                      onStartScale={(ray) => onStartScale(index, part!, ray)}
                      onStartMove={(ray) => onStartMove(index, part, ray, heldOrigin[1])}
                      onStartHeight={(ray) =>
                        onStartHeight(index, part, ray, [
                          heldOrigin[0],
                          heldOrigin[1] + LIFT,
                          heldOrigin[2],
                        ])
                      }
                      onStartYaw={(ray) => onStartYaw(index, part, ray, heldOrigin)}
                    />
                  </group>
                )}
              </Show>
            </Show>
          </group>
        )
      }}
    </For>
  )
}
