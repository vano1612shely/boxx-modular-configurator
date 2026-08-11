'use client'

import { useGLTF } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import { MathUtils, type Mesh } from 'three'

import { assetUrl } from '@/shared/lib'
import { For, Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../model/use-scene-editor-model'
import { tone } from '../editor-styles'

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

/**
 * The exterior spots, as the visitor would meet them.
 *
 * A marker stands at each one whether or not it has anything to show yet —
 * a spot with no choices is invisible otherwise, and an admin who has just
 * added one needs to see where it landed before they can move it.
 */
export function ExteriorSpots({ vm }: { vm: SceneEditorVm }) {
  return (
    <For each={vm.exteriorSlots} getKey={(slot, index) => slot.key || String(index)}>
      {(slot, index) => {
        const shown = shownVariantIndex(vm, index)
        const variant = shown === null ? null : (slot.variants ?? [])[shown]
        const selected = vm.selectedSlotIndex === index

        return (
          <group
            position={[slot.position?.x ?? 0, slot.position?.y ?? 0, slot.position?.z ?? 0]}
            rotation-y={MathUtils.degToRad(slot.yawDeg ?? 0)}
          >
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
          </group>
        )
      }}
    </For>
  )
}
