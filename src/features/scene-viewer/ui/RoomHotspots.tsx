'use client'

import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Plus, Toilet } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { Vector3 } from 'three'

import { roomFloorTopY } from '@/entities/building'
import { cn } from '@/shared/lib'
import { Chip } from '@/shared/ui/boxx'
import { For } from '@/shared/ui/control-flow'

import { hiddenLabels, type LabelBox } from '../lib/declutter-labels'
import type { RoomMarker } from '../lib/room-markers'

type Props = {
  markers: RoomMarker[]
  /** The room being looked at, or null while the whole building is. */
  focusedKey: string | null
  onOpenMarker: (marker: RoomMarker) => void
}

/** Head height over the floor it stands for, so it reads as belonging to it. */
function anchorOf(marker: RoomMarker): [number, number, number] {
  return [marker.at.x, roomFloorTopY(marker.room) + 1.1, marker.at.z]
}

/**
 * What a marker promises, said out loud.
 *
 * A room's marker promises somewhere to go and furnish; a restroom's promises a
 * closer look and nothing else; a zone's promises one named half of a room. The
 * room is named alongside the zone because two rooms may well both have a half
 * called "Kitchen", and a chip reading "Kitchen" over a plan is the only thing
 * telling them apart on screen — where they are is the answer, and a screen
 * reader has no where.
 */
function labelOf(marker: RoomMarker): string {
  if (marker.entry === 'preview') return `Look at ${marker.name}`
  if (marker.zone) return `Enter ${marker.zone.name} in ${marker.room.name}`
  return `Enter ${marker.name}`
}

/**
 * Hides the chips that would print over a nearer one.
 *
 * Nine rooms in a small building put their markers within a chip's width of one
 * another, and on a phone the whole building is a few hundred pixels across, so
 * the names print over each other and none of them can be read.
 *
 * Nothing is moved to fix that. A chip that is nudged aside stops standing over
 * the room it names, and seen from the side — where every room in the building
 * falls into one narrow band — there is nowhere to move it to that is still
 * over a room at all. The crowded ones are dropped instead, and the one in
 * front is the one kept.
 *
 * Recomputed only when the camera has actually moved. Doing it every frame is
 * both wasted work and a source of shake: two labels sitting on the edge of a
 * decision will trade places with any drift, which is what the dead band in
 * `hiddenLabels` is for and what this skip removes the rest of.
 */
function useDeclutter(markers: RoomMarker[], active: boolean) {
  const chips = useRef(new Map<string, HTMLDivElement>())
  /** Measured once per chip: the words do not change while the page is open. */
  const sizes = useRef(new Map<string, { width: number; height: number }>())
  const hidden = useRef<Set<number>>(new Set())
  const lastView = useRef('')
  const point = useMemo(() => new Vector3(), [])

  useFrame(({ camera, size }) => {
    if (!active) return

    // Sixteen numbers of the camera's pose, plus the canvas. Cheaper than the
    // projection it guards, and it is exactly what the answer depends on.
    const view = `${camera.matrixWorld.elements.join(',')}|${size.width}x${size.height}|${markers.length}`
    if (view === lastView.current) return
    lastView.current = view

    const boxes: LabelBox[] = markers.map((marker) => {
      const element = chips.current.get(marker.key)
      const blank = { x: 0, y: 0, width: 0, height: 0, depth: 0 }
      if (!element) return blank

      let measured = sizes.current.get(marker.key)
      if (!measured || measured.width === 0) {
        // The one forced layout, and only until the chip has been laid out
        // once. Reading this every frame would be a reflow per chip per frame.
        measured = { width: element.offsetWidth, height: element.offsetHeight }
        if (measured.width > 0) sizes.current.set(marker.key, measured)
      }

      point.set(...anchorOf(marker))
      const depth = point.distanceTo(camera.position)
      point.project(camera)
      // Behind the camera: it comes back mirrored, and a label nobody can see
      // must not hide one they can.
      if (point.z > 1) return blank

      return {
        x: (point.x * 0.5 + 0.5) * size.width,
        y: (-point.y * 0.5 + 0.5) * size.height,
        width: measured.width,
        height: measured.height,
        depth,
      }
    })

    const next = hiddenLabels(boxes, hidden.current)

    markers.forEach((marker, index) => {
      const element = chips.current.get(marker.key)
      if (!element) return
      if (next.has(index) === hidden.current.has(index)) return

      const out = next.has(index)
      element.style.opacity = out ? '0' : ''
      // Not opacity alone: a chip faded to nothing still catches the click that
      // was meant for the building behind it.
      element.style.visibility = out ? 'hidden' : ''
    })

    hidden.current = next
  })

  return (key: string) => (node: HTMLDivElement | null) => {
    if (node) chips.current.set(key, node)
    else {
      chips.current.delete(key)
      sizes.current.delete(key)
    }
  }
}

// Hidden in CSS rather than unmounted: every drei <Html> runs a full
// scene.updateMatrixWorld() and spins up its own React root when it mounts, so
// unmounting these on room entry made leaving one cost a traversal per room.
export function RoomHotspots({ markers, focusedKey, onOpenMarker }: Props) {
  const chipRef = useDeclutter(markers, focusedKey === null)

  return (
    <For each={markers} getKey={(marker) => marker.key}>
      {(marker) => (
        <Html
          position={anchorOf(marker)}
          center
          zIndexRange={[10, 0]}
          // Only the marker itself is clickable, never the box drei wraps it
          // in. Here the two nearly coincide, but the rule is worth keeping
          // where it is cheap: a wrapper that catches drags is invisible, and
          // the symptom — a patch of building that will not turn — looks like
          // anything but a div.
          style={{ pointerEvents: 'none' }}
        >
          {/* Inside a room every marker goes: this one has nowhere left to
              take you, and the rest belong to rooms you cannot reach from here.
              What the room is and how big it is now lives in the header panel,
              where nothing in the scene can land on top of it. */}
          <div
            ref={chipRef(marker.key)}
            // Faded rather than switched off, so a chip giving way to a nearer
            // one on the way round the building does it without a blink.
            className={cn(
              'transition-opacity duration-150',
              focusedKey !== null && 'hidden',
            )}
          >
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onOpenMarker(marker)
              }}
              aria-label={labelOf(marker)}
              className="group pointer-events-auto flex items-center justify-center rounded-full p-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Chip
                tone="glass"
                // The plus is the whole promise of furnishing, and on a restroom
                // it would be the most misleading thing on the screen.
                icon={marker.entry === 'preview' ? <Toilet /> : <Plus />}
                className="shadow-md transition-transform group-hover:scale-105"
              >
                {marker.name}
              </Chip>
            </button>
          </div>
        </Html>
      )}
    </For>
  )
}
