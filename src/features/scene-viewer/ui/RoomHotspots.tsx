'use client'

import { Html } from '@react-three/drei'
import { Eye, Plus, Toilet } from 'lucide-react'

import { roomFloorTopY } from '@/entities/building'
import { cn } from '@/shared/lib'
import { Chip } from '@/shared/ui/boxx'
import { For } from '@/shared/ui/control-flow'

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

// Hidden in CSS rather than unmounted: every drei <Html> runs a full
// scene.updateMatrixWorld() and spins up its own React root when it mounts, so
// unmounting these on room entry made leaving one cost a traversal per room.
export function RoomHotspots({ markers, focusedKey, onOpenMarker }: Props) {
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
          <div className={cn(focusedKey !== null && 'hidden')}>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onOpenMarker(marker)
              }}
              aria-label={labelOf(marker)}
              // The chip shrank; the padding grew to meet it, so what a thumb
              // has to hit is the size it always was.
              className="group pointer-events-auto flex items-center justify-center rounded-full p-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Chip
                tone="glass"
                // Small, because there are several of these over one building
                // and the room each one names is often barely wider than the
                // word. They do not shrink as the building is zoomed away —
                // nothing anchored to the screen does — so at a distance they
                // are the largest thing on it unless they start small.
                size="sm"
                // The plus is the whole promise of furnishing, and on a restroom
                // it would be the most misleading thing on the screen. A
                // look-only room that is not a restroom — a corridor, say —
                // gets an eye: it is there to be looked at, and a toilet over
                // a corridor would be the second most misleading thing.
                icon={
                  marker.entry !== 'preview' ? (
                    <Plus />
                  ) : marker.room.roomType === 'restroom' ? (
                    <Toilet />
                  ) : (
                    <Eye />
                  )
                }
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
