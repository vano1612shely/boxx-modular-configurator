'use client'

import { useFrame } from '@react-three/fiber'
import { damp } from 'maath/easing'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  FrontSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
  type Group,
  type Material,
} from 'three'

import { For } from '@/shared/ui/control-flow'

import { setTreeOpacity } from '../lib/fade'
import {
  planOpeningPlacements,
  planRoomShell,
  type OpeningPlacement,
  type ShellGroup,
} from '../lib/room-shell'
import { resolveRoomVisibility, type RoomVisibility } from '../lib/room-visibility'
import { useSurfaceTextures } from '../lib/use-surface-textures'
import type { OpeningKind, RoomZone, ShellSurface } from '../model/types'
import { OPENING_KINDS } from '../model/types'
import { OpeningModel } from './OpeningModel'

type Props = {
  room: RoomZone
}

/** Fallback tone per surface when the admin has not assigned a texture. */
const SURFACE_COLORS: Record<ShellSurface, string> = {
  wallOuter: '#d9d5cd',
  wallInner: '#f2f0ec',
  // Every cut face in the room — wall tops, jambs, the lip of the floor slab.
  // White on purpose: it is the outline that reads the section as a section.
  wallEdge: '#ffffff',
  floor: '#c9b79c',
  ceiling: '#f6f5f3',
  door: '#8a6f52',
  window: '#9fb6c4',
}

/**
 * What reads as the edge of the cut rather than as a surface of the room.
 *
 * `wallEdge` is every sawn face — wall tops, jambs, the lip of the floor slab.
 * `wallOuter` joins it because in a focused room the outside of a wall is only
 * ever glimpsed edge-on at the ends of the section, where it belongs to the
 * white frame and not to the building's cladding.
 */
const FRAME_SURFACES = new Set<ShellSurface>(['wallEdge', 'wallOuter'])

/**
 * Roughly how long a wall takes to get out of the way (maath smoothTime).
 *
 * This is the knob to turn if the fade ever feels wrong: it is a critically
 * damped approach, so the tail is long relative to the number — 0.22 read as
 * "the wall is taking ages". Small enough that the wall is out of the way
 * before you look for what was behind it, big enough to read as movement
 * rather than a cut.
 */
const FADE_TIME = 0.055

type BuiltPart = {
  key: string
  group: ShellGroup
  surface: ShellSurface
  geometry: BufferGeometry
}

type GroupContent = { parts: BuiltPart[]; openings: OpeningPlacement[] }

/** Where a group's opacity is heading this frame. */
function targetOpacity(group: ShellGroup, visibility: RoomVisibility): number {
  // The floor never steps aside: it is what the room stands on, and what
  // furniture is placed against.
  if (group === 'floor') return 1
  if (group === 'ceiling') return visibility.ceilingHidden ? 0 : 1
  return visibility.hiddenSides.includes(group) ? 0 : 1
}

/**
 * The focused room, generated rather than carved.
 *
 * Every wall side is its own group, so "get the walls between the camera and
 * the room out of the way" is one opacity per group instead of a fragment
 * shader — and because each side is a closed solid with square-cut ends, taking
 * one away exposes a finished edge rather than the inside of a hollow shell.
 *
 * A side's doors and windows live INSIDE its group, so they leave with the wall
 * they are set into instead of hanging in the gap it left.
 */
export function RoomShell({ room }: Props) {
  const textures = useSurfaceTextures(room.surfaces)

  // A kind with a model gets no flat leaf: the glb brings its own frame and
  // glazing, and both in the same 12 cm would fight for depth.
  const modelledKinds = useMemo(
    () => new Set(OPENING_KINDS.filter((kind) => room.openingModels[kind]?.url)),
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

  // Frees the GPU buffers when the room changes or the view closes. StrictMode
  // double-invokes the factory above and keeps only the first result, but the
  // discarded set is never rendered — so it never allocates anything to free.
  useEffect(() => {
    return () => {
      for (const part of parts) part.geometry.dispose()
    }
  }, [parts])

  // Owned rather than declared as JSX, because fading needs to reach them from
  // a frame loop and R3F would re-apply the props over anything set there.
  const materials = useMemo(() => {
    const map = new Map<string, Material>()
    for (const part of parts) {
      // The frame of the cutaway is UNLIT white, all the way round. A lit white
      // surface is only white where the light happens to be strong, which is
      // how the top and bottom of the section came out crisp and the two sides
      // — lit at a grazing angle — came out grey.
      map.set(
        part.key,
        FRAME_SURFACES.has(part.surface)
          ? new MeshBasicMaterial({ color: '#ffffff', toneMapped: false, side: FrontSide })
          : new MeshStandardMaterial({
              map: textures[part.surface] ?? null,
              color: textures[part.surface] ? '#ffffff' : SURFACE_COLORS[part.surface],
              roughness: 0.85,
              metalness: 0,
              side: FrontSide,
            }),
      )
    }
    return map
  }, [parts, textures])

  useEffect(() => {
    return () => {
      for (const material of materials.values()) material.dispose()
    }
  }, [materials])

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
        // First frame of a room: land on the answer. Fading in from nothing
        // would make every room open with its near walls swimming into place.
        state = { value: target, applied: Number.NaN }
        fade.current.set(group, state)
      } else {
        // Snaps to the target once inside its own epsilon, so a settled group
        // reaches exactly 0 or 1 and stops paying for transparency.
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
              // A group that remounts (a model assigned, a wall regenerated)
              // arrives with fresh, fully opaque materials. Forgetting what was
              // last applied is what makes the next frame fade it back down
              // instead of leaving a hidden wall standing.
              const state = fade.current.get(key)
              if (state) state.applied = Number.NaN
            }}
          >
            <For each={content.parts} getKey={(part) => part.key}>
              {(part) => (
                // No shadows anywhere in a room: a wall stepping aside would
                // take its shadow with it, and the light would swing across
                // the floor every time the camera passed a corner.
                <mesh geometry={part.geometry} material={materials.get(part.key)} />
              )}
            </For>
            <For each={content.openings} getKey={(placement) => placement.opening.id}>
              {(placement) => (
                // One boundary each: a door still streaming in must not blank
                // the wall it belongs to, let alone the room.
                <Suspense fallback={null}>
                  <OpeningModel
                    placement={placement}
                    style={room.openingModels[placement.opening.kind as OpeningKind]}
                  />
                </Suspense>
              )}
            </For>
          </group>
        )}
      </For>
    </group>
  )
}
