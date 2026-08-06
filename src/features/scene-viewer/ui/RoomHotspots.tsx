'use client'

import { Html } from '@react-three/drei'
import { Plus } from 'lucide-react'

import type { RoomZone } from '@/entities/building'
import { polygonCentroid, roomAreaSqFt, roomFloorTopY } from '@/entities/building'
import { useConfiguration } from '@/entities/configuration'
import { cn } from '@/shared/lib'
import { Chip } from '@/shared/ui/boxx'
import { For } from '@/shared/ui/control-flow'

type Props = {
  rooms: RoomZone[]
  /** The room being looked at, or null while the whole building is. */
  focusedKey: string | null
  onFocusRoom: (key: string) => void
}

/**
 * Head height over the room from outside; up near the ceiling once inside it.
 *
 * A plate at the entry height would sit in the middle of the room the visitor
 * came to look at. High in the frame it names the room without standing in it.
 */
function anchorOf(room: RoomZone, focused: boolean): [number, number, number] {
  const centroid = polygonCentroid(room.floorPolygon)
  const height = focused ? room.shell.wallHeight * 0.8 : 1.1
  return [centroid.x, roomFloorTopY(room) + height, centroid.z]
}

// Hidden in CSS rather than unmounted: every drei <Html> runs a full
// scene.updateMatrixWorld() and spins up its own React root when it mounts, so
// unmounting these on room entry made leaving one cost a traversal per room.
export function RoomHotspots({ rooms, focusedKey, onFocusRoom }: Props) {
  // Both plates are anchored near the middle of the room, so from some angles
  // the furniture toolbar lands straight on top of the room's name. The name is
  // the one that can wait: nobody adjusting a chair needs telling which room
  // they are in.
  const editing = useConfiguration((state) => state.selectedInstanceId !== null)

  return (
    <For each={rooms} getKey={(room) => room.key}>
      {(room) => {
        const focused = focusedKey === room.key
        // Every other room's marker: it belongs to a room that is not being
        // looked at and cannot be entered from in here.
        const hidden = (focusedKey !== null && !focused) || (focused && editing)

        return (
          <Html position={anchorOf(room, focused)} center zIndexRange={[10, 0]}>
            <div className={cn(hidden && 'hidden')}>
              {focused ? (
                // The name used to live only in the top-left corner, next to the
                // way out. Here it is on the room it names.
                <Chip tone="glass" className="shadow-md whitespace-nowrap">
                  <span className="font-medium">{room.name}</span>
                  <span className="text-muted-foreground">
                    {' · '}approx. {roomAreaSqFt(room).toLocaleString('en-US')} ft²
                  </span>
                </Chip>
              ) : (
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    onFocusRoom(room.key)
                  }}
                  className="group flex items-center justify-center rounded-full p-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Chip
                    tone="glass"
                    icon={<Plus />}
                    className="shadow-md transition-transform group-hover:scale-105"
                  >
                    {room.name}
                  </Chip>
                </button>
              )}
            </div>
          </Html>
        )
      }}
    </For>
  )
}
