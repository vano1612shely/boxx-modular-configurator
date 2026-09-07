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

import { declutterLabels, type LabelBox } from '../lib/declutter-labels'
import type { RoomMarker } from '../lib/room-markers'

type Props = {
  markers: RoomMarker[]
  /** The room being looked at, or null while the whole building is. */
  focusedKey: string | null
  onOpenMarker: (marker: RoomMarker) => void
}

/**
 * How quickly a chip catches up with where it should be, in seconds.
 *
 * Long enough to read as gliding rather than jumping, short enough that it has
 * arrived by the time the camera stops. The easing is exponential, so this is
 * the time it covers about two thirds of the distance in.
 */
const GLIDE = 0.13

/** Under this the chip is where it belongs, and writing again buys nothing. */
const SETTLED = 0.25

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
 * Lifts a crowded chip clear of its neighbour, and glides it there.
 *
 * Nine rooms in a small building put their markers within a chip's width of one
 * another, and on a phone the whole building is a few hundred pixels across, so
 * the names print over each other and none of them can be read.
 *
 * Where each one goes is `declutterLabels`; this is the half that has to be
 * done in the frame loop. Two things here, and both were learned the hard way.
 * The target is recomputed only when the camera has actually moved — every
 * frame is wasted work and, worse, a source of shake. And the chip is eased
 * towards it rather than put there, so a marker that has to give way slides
 * over instead of appearing somewhere else; the easing also absorbs the moment
 * two rooms trade places, which is a glide rather than a jump.
 *
 * Written straight onto the elements. Re-rendering a dozen drei `<Html>`
 * portals per frame is the one thing that would make turning the building cost
 * more than drawing it.
 */
function useDeclutter(markers: RoomMarker[], active: boolean) {
  const chips = useRef(new Map<string, HTMLDivElement>())
  /** Measured once per chip: the words do not change while the page is open. */
  const sizes = useRef(new Map<string, { width: number; height: number }>())
  const target = useRef(new Map<string, number>())
  const shown = useRef(new Map<string, number>())
  const lastView = useRef('')
  const point = useMemo(() => new Vector3(), [])

  useFrame(({ camera, size }, delta) => {
    if (!active) return

    // Sixteen numbers of the camera's pose, plus the canvas. Cheaper than the
    // projection it guards, and it is exactly what the answer depends on.
    const view = `${camera.matrixWorld.elements.join(',')}|${size.width}x${size.height}|${markers.length}`

    if (view !== lastView.current) {
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
        // must not push one they can.
        if (point.z > 1) return blank

        return {
          x: (point.x * 0.5 + 0.5) * size.width,
          y: (-point.y * 0.5 + 0.5) * size.height,
          width: measured.width,
          height: measured.height,
          depth,
        }
      })

      // Fed its own last answer, so a label that has already given way keeps
      // the side it gave way on for as long as that side works.
      const held = markers.map((marker) => target.current.get(marker.key) ?? 0)
      const offsets = declutterLabels(boxes, held)
      markers.forEach((marker, index) => target.current.set(marker.key, offsets[index]))
    }

    // Frame-rate independent easing, so the glide takes the same time whether
    // the scene is running at 120 or struggling at 30.
    const step = 1 - Math.exp(-delta / GLIDE)

    for (const marker of markers) {
      const element = chips.current.get(marker.key)
      if (!element) continue

      const wanted = target.current.get(marker.key) ?? 0
      const at = shown.current.get(marker.key) ?? 0
      if (Math.abs(wanted - at) < SETTLED) {
        if (at !== wanted) {
          shown.current.set(marker.key, wanted)
          element.style.transform = wanted === 0 ? '' : `translateY(${wanted.toFixed(1)}px)`
        }
        continue
      }

      const next = at + (wanted - at) * step
      shown.current.set(marker.key, next)
      element.style.transform = `translateY(${next.toFixed(1)}px)`
    }
  })

  return (key: string) => (node: HTMLDivElement | null) => {
    if (node) chips.current.set(key, node)
    else {
      chips.current.delete(key)
      sizes.current.delete(key)
      target.current.delete(key)
      shown.current.delete(key)
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
          <div ref={chipRef(marker.key)} className={cn(focusedKey !== null && 'hidden')}>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onOpenMarker(marker)
              }}
              aria-label={labelOf(marker)}
              // The chip shrank; the padding did not, so what a thumb has to
              // hit is the same size it always was.
              className="group pointer-events-auto flex items-center justify-center rounded-full p-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Chip
                tone="glass"
                // Small: these stand over a building, several at once, and the
                // room they name is often only a little wider than the word.
                // Every pixel off the chip is a pixel of crowding that never
                // has to be sorted out by moving it.
                size="sm"
                // The plus is the whole promise of furnishing, and on a restroom
                // it would be the most misleading thing on the screen.
                icon={marker.entry === 'preview' ? <Toilet /> : <Plus />}
                className="max-w-[9rem] shadow-md transition-transform group-hover:scale-105"
              >
                <span className="truncate">{marker.name}</span>
              </Chip>
            </button>
          </div>
        </Html>
      )}
    </For>
  )
}
