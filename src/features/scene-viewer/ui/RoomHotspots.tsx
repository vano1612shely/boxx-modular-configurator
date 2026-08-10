'use client'

import { Html } from '@react-three/drei'
import { Plus } from 'lucide-react'

import type { Room } from '@/entities/building'
import { polygonCentroid, roomFloorTopY } from '@/entities/building'
import { cn } from '@/shared/lib'
import { Chip } from '@/shared/ui/boxx'
import { For } from '@/shared/ui/control-flow'

type Props = {
  rooms: Room[]
  /** The room being looked at, or null while the whole building is. */
  focusedKey: string | null
  onFocusRoom: (key: string) => void
}

/** Head height over the room, so the marker reads as belonging to it. */
function anchorOf(room: Room): [number, number, number] {
  const centroid = polygonCentroid(room.floorPolygon)
  return [centroid.x, roomFloorTopY(room) + 1.1, centroid.z]
}

// Hidden in CSS rather than unmounted: every drei <Html> runs a full
// scene.updateMatrixWorld() and spins up its own React root when it mounts, so
// unmounting these on room entry made leaving one cost a traversal per room.
export function RoomHotspots({ rooms, focusedKey, onFocusRoom }: Props) {
  return (
    <For each={rooms} getKey={(room) => room.key}>
      {(room) => (
        <Html
          position={anchorOf(room)}
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
                onFocusRoom(room.key)
              }}
              className="group pointer-events-auto flex items-center justify-center rounded-full p-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Chip
                tone="glass"
                icon={<Plus />}
                className="shadow-md transition-transform group-hover:scale-105"
              >
                {room.name}
              </Chip>
            </button>
          </div>
        </Html>
      )}
    </For>
  )
}
