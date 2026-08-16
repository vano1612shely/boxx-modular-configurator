'use client'

import { Html, useGLTF } from '@react-three/drei'
import { Suspense, useMemo, useRef, useState } from 'react'
import { Box3, MathUtils, Mesh, Vector3, type Group, type Object3D } from 'three'

import type { BuildingScene, ExteriorPart, ExteriorSlot, ExteriorVariant } from '@/entities/building'
import { selectedVariant } from '@/entities/building'
import { useConfiguration } from '@/entities/configuration'
import { useConfiguratorSession } from '@/entities/configurator-session'
import { createNodeResolver } from '@/shared/three/node-path'
import { HIGHLIGHT } from '@/shared/three/scene-tokens'
import { Chip } from '@/shared/ui/boxx'
import { For, Show } from '@/shared/ui/control-flow'

/** Ground room around the structure, so the plate reads as its own area. */
const PLATE_MARGIN = 0.35
/** Clear of the ground it lies on, without floating off it. */
const PLATE_LIFT = 0.012

type Resolver = (path: string) => Object3D | null

function PartModel({ part }: { part: ExteriorPart }) {
  const { scene } = useGLTF(part.url, false, true)

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
      position={part.position}
      rotation-y={MathUtils.degToRad(part.yawDeg)}
      scale={part.scale}
    />
  )
}

type Plate = { center: [number, number, number]; width: number; depth: number }

const BOX = new Box3()
const SIZE = new Vector3()
const CENTRE = new Vector3()

/**
 * The footprint of whatever this spot is currently showing.
 *
 * Measured rather than authored, and measured on hover rather than on mount:
 * the parts arrive through Suspense, so anything computed earlier would be the
 * footprint of an empty group. By the time a pointer is on the thing, the thing
 * is on screen.
 */
function measure(group: Group | null, nodes: string[], resolve: Resolver): Plate | null {
  BOX.makeEmpty()
  if (group) BOX.expandByObject(group)
  for (const path of nodes) {
    const object = resolve(path)
    if (object) BOX.expandByObject(object)
  }
  if (BOX.isEmpty()) return null

  BOX.getSize(SIZE)
  BOX.getCenter(CENTRE)

  return {
    center: [CENTRE.x, BOX.min.y + PLATE_LIFT, CENTRE.z],
    width: SIZE.x + PLATE_MARGIN * 2,
    depth: SIZE.z + PLATE_MARGIN * 2,
  }
}

type SpotProps = {
  slot: ExteriorSlot
  variant: ExteriorVariant
  resolve: Resolver
}

/**
 * One exterior spot: what is picked there, and the area that says it is pickable.
 *
 * The models are drawn in the spot's own frame, so moving the spot in the editor
 * carries every choice with it. Objects that come from the building's own model
 * are not drawn here at all — they are already in the scene, and all this does
 * for them is measure them and take the click, which `BuildingModel` forwards.
 */
function ExteriorSpot({ slot, variant, resolve }: SpotProps) {
  const groupRef = useRef<Group>(null)
  const [plate, setPlate] = useState<Plate | null>(null)

  const hovered = useConfiguratorSession((s) => s.hoveredSlotKey === slot.key)
  const open = useConfiguratorSession((s) => s.openSlotKey === slot.key)
  const hoverSlot = useConfiguratorSession((s) => s.hoverExteriorSlot)
  const openSlot = useConfiguratorSession((s) => s.openExteriorSlot)

  // One choice is not a choice: the structure is simply part of the building,
  // and lighting it up would promise a picker that never opens.
  const pickable = slot.variants.length > 1
  const lit = pickable && (hovered || open)

  const enter = () => {
    if (!pickable) return
    setPlate(measure(groupRef.current, variant.nodes, resolve))
    hoverSlot(slot.key)
  }

  return (
    <>
      <group
        ref={groupRef}
        position={slot.position}
        rotation-y={MathUtils.degToRad(slot.yawDeg)}
        onPointerOver={(event) => {
          if (!pickable) return
          event.stopPropagation()
          enter()
        }}
        onPointerOut={() => pickable && hoverSlot(null)}
        onClick={(event) => {
          if (!pickable) return
          event.stopPropagation()
          openSlot(slot.key)
        }}
      >
        <For each={variant.parts} getKey={(_, index) => `${variant.key}-${index}`}>
          {(part) => (
            <Suspense fallback={null}>
              <PartModel part={part} />
            </Suspense>
          )}
        </For>
      </group>

      <Show when={lit && plate !== null}>
        {/* Its own subtree, outside the group above: the plate is measured in
            world space, so putting it under a rotated parent would turn it. */}
        <mesh
          position={plate?.center}
          rotation-x={-Math.PI / 2}
          onPointerOver={(event) => {
            event.stopPropagation()
            hoverSlot(slot.key)
          }}
          onPointerOut={() => hoverSlot(null)}
          onClick={(event) => {
            event.stopPropagation()
            openSlot(slot.key)
          }}
        >
          <planeGeometry args={[plate?.width ?? 1, plate?.depth ?? 1]} />
          <meshBasicMaterial
            color={HIGHLIGHT.selected}
            transparent
            opacity={open ? 0.34 : 0.22}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>

        <Html position={plate?.center} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <Chip tone="glass" className="whitespace-nowrap shadow-md">
            {slot.name}
          </Chip>
        </Html>
      </Show>
    </>
  )
}

/**
 * Every exterior spot on the building, showing what the visitor has picked.
 *
 * Gone entirely once a room is entered. The building's own model is hidden
 * there — the visitor is looking at a generated room and nothing else — so a
 * deck left behind would be a slab of decking floating in the open next to a
 * single room, which is what it looked like. Previewing a room from above is
 * not the same thing: the building is still on screen for that, and so are its
 * entrances.
 */
export function ExteriorSlots({ building }: { building: BuildingScene }) {
  const selection = useConfiguration((s) => s.exterior)
  const insideRoom = useConfiguratorSession((s) => s.focusedRoomKey !== null)
  // The same cached scene BuildingModel prepares — useGLTF hands out one object
  // per url, so these resolve to the very nodes on screen.
  const { scene } = useGLTF(building.modelUrl, false, true)
  const resolve = useMemo(() => createNodeResolver(scene), [scene])

  if (insideRoom || building.exteriorSlots.length === 0) return null

  return (
    <For each={building.exteriorSlots} getKey={(slot) => slot.key}>
      {(slot) => {
        const variant = selectedVariant(slot, selection)
        if (!variant) return null

        return <ExteriorSpot slot={slot} variant={variant} resolve={resolve} />
      }}
    </For>
  )
}
