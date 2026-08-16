'use client'

import { Html } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import { MathUtils, Mesh } from 'three'

import type { BuildingScene, ExteriorPart, ExteriorSlot, ExteriorVariant } from '@/entities/building'
import { entranceView, selectedVariant } from '@/entities/building'
import { useConfiguration } from '@/entities/configuration'
import { useConfiguratorSession } from '@/entities/configurator-session'
import { cn } from '@/shared/lib'
import { Chip } from '@/shared/ui/boxx'
import { For } from '@/shared/ui/control-flow'
import { useModel } from '@/shared/three/use-model'

/** Head height over the spot, so the marker reads as belonging to it. */
const LABEL_LIFT = 1.1

function PartModel({ part }: { part: ExteriorPart }) {
  const scene = useModel(part.url)

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

type SpotProps = {
  slot: ExteriorSlot
  variant: ExteriorVariant
  /** Middle of the building, so the fly-over knows which side is outside. */
  centre: { x: number; z: number } | null
}

/**
 * One exterior spot: what is picked there, and a marker naming it.
 *
 * The marker is always on, like the room markers it sits among, and clicking it
 * does the two things the visitor wanted: opens that spot's choices and flies
 * over to look at them. There is no highlight on the ground — it needed a hover
 * to appear, a hover is a thing a phone does not have, and a patch of colour
 * over the deck said nothing the name does not.
 */
function ExteriorSpot({ slot, variant, centre }: SpotProps) {
  const openSlot = useConfiguratorSession((s) => s.openExteriorSlot)
  const open = useConfiguratorSession((s) => s.openSlotKey === slot.key)

  // One choice is not a choice: the structure is simply part of the building,
  // and a marker would promise a picker that never opens.
  const pickable = slot.variants.length > 1

  const look = () => {
    openSlot(slot.key)
    const view = entranceView(slot, centre)
    useConfiguratorSession.getState().requestMoveTo(view.position, view.target)
  }

  return (
    <>
      <group position={slot.position} rotation-y={MathUtils.degToRad(slot.yawDeg)}>
        <For each={variant.parts} getKey={(_, index) => `${variant.key}-${index}`}>
          {(part) => (
            <Suspense fallback={null}>
              <PartModel part={part} />
            </Suspense>
          )}
        </For>
      </group>

      {pickable && (
        <Html
          position={[slot.position[0], slot.position[1] + LABEL_LIFT, slot.position[2]]}
          center
          zIndexRange={[10, 0]}
          // Only the marker itself takes the pointer, never the box drei wraps
          // it in — an invisible wrapper that swallows drags reads as a patch of
          // building that will not turn.
          style={{ pointerEvents: 'none' }}
        >
          <button
            type="button"
            // The label reads as a name; what pressing it does is worth saying
            // out loud, since it both opens the choices and flies over to them.
            aria-label={`Look at ${slot.name}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              look()
            }}
            className="group pointer-events-auto flex items-center justify-center rounded-full p-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Chip
              tone="glass"
              className={cn(
                'shadow-md transition-transform group-hover:scale-105',
                open && 'ring-1 ring-primary',
              )}
            >
              {slot.name}
            </Chip>
          </button>
        </Html>
      )}
    </>
  )
}

/**
 * Every exterior spot on the building, showing what the visitor has picked.
 *
 * Gone entirely once a room is entered. The building's own model is hidden
 * there — the visitor is looking at a generated room and nothing else — so a
 * deck left behind would be a slab of decking floating in the open next to a
 * single room. Previewing a room from above is not the same thing: the building
 * is still on screen for that, and so are its entrances.
 */
export function ExteriorSlots({ building }: { building: BuildingScene }) {
  const selection = useConfiguration((s) => s.exterior)
  const insideRoom = useConfiguratorSession((s) => s.focusedRoomKey !== null)
  const bounds = useConfiguratorSession((s) => s.buildingBounds)

  // Measured off the model once it is in the scene, so it costs nothing to
  // author and cannot disagree with what is on screen.
  const centre = bounds
    ? { x: (bounds.min[0] + bounds.max[0]) / 2, z: (bounds.min[2] + bounds.max[2]) / 2 }
    : null

  if (insideRoom || building.exteriorSlots.length === 0) return null

  return (
    <For each={building.exteriorSlots} getKey={(slot) => slot.key}>
      {(slot) => {
        const variant = selectedVariant(slot, selection)
        if (!variant) return null

        return <ExteriorSpot slot={slot} variant={variant} centre={centre} />
      }}
    </For>
  )
}
