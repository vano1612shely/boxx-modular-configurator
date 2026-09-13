'use client'

import { useFrame } from '@react-three/fiber'
import { damp } from 'maath/easing'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, Vector3, type Group, type Material } from 'three'

import { For } from '@/shared/ui/control-flow'

import { setTreeOpacity } from '../lib/fade'
import {
  planOpeningPlacements,
  planRoomShell,
  type OpeningPlacement,
  type ShellGroup,
} from '../lib/room-shell'
import { resolveRoomVisibility, type RoomVisibility } from '../lib/room-visibility'
import { shellMaterial } from '../lib/shell-materials'
import { useSurfaceTextures } from '../lib/use-surface-textures'
import type { OpeningKind, OpeningModelStyle, Room, RoomOpening, ShellSurface } from '../model/types'
import { OPENING_KINDS } from '../model/types'
import { OpeningModel } from './OpeningModel'

type Props = {
  room: Room
}

/** maath smoothTime, in seconds: critically damped, so the tail is long. */
const FADE_TIME = 0.055

type BuiltPart = {
  key: string
  group: ShellGroup
  surface: ShellSurface
  geometry: BufferGeometry
}

type GroupContent = { parts: BuiltPart[]; openings: OpeningPlacement[] }

function targetOpacity(group: ShellGroup, visibility: RoomVisibility): number {
  if (group === 'floor') return 1
  if (group === 'ceiling') return visibility.ceilingHidden ? 0 : 1
  return visibility.hiddenSides.includes(group) ? 0 : 1
}

/** The model an opening is drawn with: the entrance door's for a door out of the building. */
function openingStyle(room: Room, opening: RoomOpening): OpeningModelStyle {
  if (opening.kind === 'door' && opening.entrance) return room.openingModels.entrance
  return room.openingModels[opening.kind as OpeningKind]
}

export function RoomShell({ room }: Props) {
  const textures = useSurfaceTextures(room.surfaces)

  // A kind with a model gets no flat leaf: both in the same 12 cm would fight
  // for depth.
  const modelledKinds = useMemo(
    () =>
      new Set(
        OPENING_KINDS.filter(
          (kind) =>
            room.openingModels[kind]?.url ||
            (kind === 'door' && room.openingModels.entrance?.url),
        ),
      ),
    [room.openingModels],
  )

  const parts = useMemo(() => {
    const tiles = Object.fromEntries(
      (
        Object.entries(room.surfaces) as Array<
          [ShellSurface, { tileWidth: number; tileHeight: number }]
        >
      ).map(([surface, style]) => [
        surface,
        { width: style.tileWidth, height: style.tileHeight },
      ]),
    ) as Parameters<typeof planRoomShell>[3]

    const plan = planRoomShell(room.floorPolygon, room.shell, room.openings, tiles, {
      modelledKinds,
    })

    return plan.parts.map((part, index) => {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new BufferAttribute(part.positions, 3))
      geometry.setAttribute('normal', new BufferAttribute(part.normals, 3))
      geometry.setAttribute('uv', new BufferAttribute(part.uvs, 2))
      geometry.computeBoundingBox()
      geometry.computeBoundingSphere()

      return {
        key: `${part.group}-${part.surface}-${index}`,
        group: part.group,
        surface: part.surface,
        geometry,
      }
    })
  }, [room.floorPolygon, room.shell, room.openings, room.surfaces, modelledKinds])

  useEffect(() => {
    return () => {
      for (const part of parts) part.geometry.dispose()
    }
  }, [parts])

  // Owned rather than declared as JSX: the frame loop writes to these, and R3F
  // would re-apply the props over anything set there. Held for the life of the
  // page, not made here — see shellMaterial for what making them cost.
  const materials = useMemo(() => {
    const map = new Map<string, Material>()
    for (const part of parts) {
      map.set(part.key, shellMaterial(part.group, part.surface, textures[part.surface] ?? null))
    }
    return map
  }, [parts, textures])

  const placements = useMemo(
    () => planOpeningPlacements(room.floorPolygon, room.shell, room.openings),
    [room.floorPolygon, room.shell, room.openings],
  )

  const groups = useMemo(() => {
    const map = new Map<ShellGroup, GroupContent>()
    const entryFor = (group: ShellGroup): GroupContent => {
      let entry = map.get(group)
      if (!entry) {
        entry = { parts: [], openings: [] }
        map.set(group, entry)
      }
      return entry
    }

    for (const part of parts) entryFor(part.group).parts.push(part)
    for (const placement of placements) {
      if (modelledKinds.has(placement.opening.kind)) entryFor(placement.side).openings.push(placement)
    }

    return [...map.entries()]
  }, [parts, placements, modelledKinds])

  const nodes = useRef(new Map<ShellGroup, Group | null>())
  const fade = useRef(new Map<ShellGroup, { value: number; applied: number }>())
  const hidden = useRef<RoomVisibility['hiddenSides']>([])
  const cameraWorld = useRef(new Vector3())

  useFrame(({ camera }, delta) => {
    camera.getWorldPosition(cameraWorld.current)
    const visibility = resolveRoomVisibility(
      room.floorPolygon,
      room.shell,
      cameraWorld.current,
      hidden.current,
    )
    hidden.current = visibility.hiddenSides

    for (const [group, node] of nodes.current) {
      if (!node) continue
      const target = targetOpacity(group, visibility)

      let state = fade.current.get(group)
      if (!state) {
        state = { value: target, applied: Number.NaN }
        fade.current.set(group, state)
      } else {
        // damp snaps to the target inside its epsilon, so a settled group
        // reaches exactly 0 or 1.
        damp(state, 'value', target, FADE_TIME, delta)
      }

      if (state.applied === state.value) continue
      setTreeOpacity(node, state.value)
      state.applied = state.value
    }
  })

  return (
    <group name="generated-room">
      <For each={groups} getKey={([key]) => key}>
        {([key, content]) => (
          <group
            ref={(node) => {
              nodes.current.set(key, node)
              // A remounted group arrives with fresh, fully opaque materials,
              // so what was last applied has to be forgotten.
              const state = fade.current.get(key)
              if (state) state.applied = Number.NaN
            }}
          >
            <For each={content.parts} getKey={(part) => part.key}>
              {(part) => (
                <mesh geometry={part.geometry} material={materials.get(part.key)} />
              )}
            </For>
            <For each={content.openings} getKey={(placement) => placement.opening.id}>
              {(placement) => (
                <Suspense fallback={null}>
                  <OpeningModel placement={placement} style={openingStyle(room, placement.opening)} />
                </Suspense>
              )}
            </For>
          </group>
        )}
      </For>
    </group>
  )
}
