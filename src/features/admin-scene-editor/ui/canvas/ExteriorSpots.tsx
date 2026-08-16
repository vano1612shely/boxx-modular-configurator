'use client'

import { useGLTF } from '@react-three/drei'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Box3, BoxGeometry, DoubleSide, MathUtils, Vector3, type Mesh, type Ray } from 'three'

import { assetUrl } from '@/shared/lib'
import { For, Show } from '@/shared/ui/control-flow'

import { slotToWorld } from '../../lib/slot-drag'
import type { SceneEditorVm } from '../../model/use-scene-editor-model'
import { tone } from '../editor-styles'
import { HandlePoint, SURFACE_PRIORITY, type RegisterHandle } from './handles'

/** Same colours the roof and the volumes use, so the same gesture looks the same. */
const MOVE_COLOR = '#ffffff'
const HEIGHT_COLOR = '#facc15'
const TURN_COLOR = '#38bdf8'
const CAGE_COLOR = '#a78bfa'
const STRETCH_COLOR = '#f0abfc'

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
      scale={[part.scale?.x || 1, part.scale?.y || 1, part.scale?.z || 1]}
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

/** Each face of the cage: which way it points, and how to stand a plane on it. */
type Axis = 'x' | 'y' | 'z'

const FACE_HANDLES: Array<{ axis: Axis; sign: 1 | -1; rotation: Triple }> = [
  { axis: 'x', sign: 1, rotation: [0, Math.PI / 2, 0] },
  { axis: 'x', sign: -1, rotation: [0, -Math.PI / 2, 0] },
  { axis: 'y', sign: 1, rotation: [-Math.PI / 2, 0, 0] },
  { axis: 'y', sign: -1, rotation: [Math.PI / 2, 0, 0] },
  { axis: 'z', sign: 1, rotation: [0, 0, 0] },
  { axis: 'z', sign: -1, rotation: [0, Math.PI, 0] },
]

/**
 * The cage around a model: clear panes, drawn edges, and every part of it doing
 * something.
 *
 * The box itself is the grab handle. A floating puck beside a model the size of
 * a deck was a small target next to a large one, and it read as a second object
 * rather than as the model's own. Its sides slide the model across the ground
 * and its top and bottom lift it, which is the one gesture a flat pointer can
 * spell without a separate arrow to aim at.
 *
 * Corners resize the whole thing; the pad at the middle of each face stretches
 * that axis alone. Sized from the model rather than authored, which is the whole
 * point — two imports rarely arrive at the same size or with the same origin.
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
  scale: Triple
  register: RegisterHandle
  onStartScale: (ray: Ray, axis: Axis | null) => void
  onStartMove: (ray: Ray) => void
  onStartHeight: (ray: Ray) => void
  onStartYaw: (ray: Ray) => void
}) {
  const raw = box.getSize(new Vector3())
  const mid = box.getCenter(new Vector3())
  const size = new Vector3(raw.x * scale[0], raw.y * scale[1], raw.z * scale[2])
  const centre = new Vector3(mid.x * scale[0], mid.y * scale[1], mid.z * scale[2])
  const half: Triple = [size.x / 2, size.y / 2, size.z / 2]
  const geometry = useMemo(() => new BoxGeometry(size.x, size.y, size.z), [size.x, size.y, size.z])

  const reach = (axis: Axis) => (axis === 'x' ? half[0] : axis === 'y' ? half[1] : half[2])

  return (
    <group position={[centre.x, centre.y, centre.z]}>
      <lineSegments raycast={() => {}}>
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial color={CAGE_COLOR} transparent opacity={0.9} depthTest={false} />
      </lineSegments>

      {/* One plane per face rather than one box, so the top and bottom can lift
          while the sides slide. Double-sided: the far ones are seen from inside. */}
      <For each={FACE_HANDLES} getKey={(face) => `${face.axis}${face.sign}`}>
        {(face) => (
          <mesh
            position={[
              face.axis === 'x' ? face.sign * half[0] : 0,
              face.axis === 'y' ? face.sign * half[1] : 0,
              face.axis === 'z' ? face.sign * half[2] : 0,
            ]}
            rotation={face.rotation}
            ref={(mesh) => {
              if (!mesh) return
              // The lowest rank there is: every grip drawn on this face, and
              // every grip behind it, is reached through it.
              return register(
                mesh,
                face.axis === 'y' ? onStartHeight : onStartMove,
                SURFACE_PRIORITY,
              )
            }}
          >
            <planeGeometry
              args={[
                face.axis === 'x' ? size.z : size.x,
                face.axis === 'y' ? size.z : size.y,
              ]}
            />
            <meshBasicMaterial
              color={CAGE_COLOR}
              transparent
              opacity={0.06}
              depthWrite={false}
              side={DoubleSide}
            />
          </mesh>
        )}
      </For>

      <For each={CORNERS} getKey={(corner) => corner.join(',')}>
        {(corner) => (
          <HandlePoint
            position={[corner[0] * half[0], corner[1] * half[1], corner[2] * half[2]]}
            hitRadius={0.2}
            register={register}
            begin={(ray) => onStartScale(ray, null)}
          >
            <mesh>
              <boxGeometry args={[0.11, 0.11, 0.11]} />
              <meshBasicMaterial color={CAGE_COLOR} depthTest={false} transparent />
            </mesh>
          </HandlePoint>
        )}
      </For>

      {/* A pad at the middle of each face, for stretching that axis on its own. */}
      <For each={FACE_HANDLES} getKey={(face) => `pad-${face.axis}${face.sign}`}>
        {(face) => (
          <HandlePoint
            position={[
              face.axis === 'x' ? face.sign * reach('x') : 0,
              face.axis === 'y' ? face.sign * reach('y') : 0,
              face.axis === 'z' ? face.sign * reach('z') : 0,
            ]}
            hitRadius={0.18}
            register={register}
            begin={(ray) => onStartScale(ray, face.axis)}
          >
            <mesh rotation={face.rotation}>
              <boxGeometry args={[0.16, 0.16, 0.035]} />
              <meshBasicMaterial color={STRETCH_COLOR} depthTest={false} transparent />
            </mesh>
          </HandlePoint>
        )}
      </For>

      <mesh position={[0, -half[1] + 0.02, 0]} rotation-x={-Math.PI / 2} raycast={() => {}}>
        <ringGeometry args={[RING - 0.03, RING, 64]} />
        <meshBasicMaterial color={TURN_COLOR} transparent opacity={0.5} depthWrite={false} />
      </mesh>

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
  onStartScale: (index: number, part: number, ray: Ray, axis: 'x' | 'y' | 'z' | null) => void
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
              {/* The spot's own handles stand down while a model is being
                  placed. Both at once put two pucks a few centimetres apart,
                  and picking the wrong one moved the whole arrangement when the
                  intent was one deck. */}
              <Show when={part === null}>
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
              </Show>

              <Show when={held !== null && part !== null && sized?.part === part && sized.box}>
                {(box) => (
                  <group
                    position={heldAt}
                    rotation-y={MathUtils.degToRad(held?.yawDeg ?? 0)}
                  >
                    <PartCage
                      box={box}
                      scale={[held?.scale?.x || 1, held?.scale?.y || 1, held?.scale?.z || 1]}
                      register={register}
                      onStartScale={(ray, axis) => onStartScale(index, part!, ray, axis)}
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
