'use client'

import { Html } from '@react-three/drei'

import type { RoomZone } from '@/entities/building'
import { polygonCentroid, roomFloorTopY } from '@/entities/building'
import { For } from '@/shared/ui/control-flow'

type Props = {
  rooms: RoomZone[]
  visible: boolean
  onFocusRoom: (key: string) => void
}

function roomCenter(room: RoomZone): [number, number, number] {
  const centroid = polygonCentroid(room.floorPolygon)
  return [centroid.x, roomFloorTopY(room) + 1.1, centroid.z]
}

export function RoomHotspots({ rooms, visible, onFocusRoom }: Props) {
  if (!visible) return null

  return (
    <For each={rooms} getKey={(room) => room.key}>
      {(room) => (
        <Html position={roomCenter(room)} center zIndexRange={[10, 0]}>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onFocusRoom(room.key)
            }}
            className="flex items-center gap-1.5 rounded-full bg-background/90 py-1.5 pr-3.5 pl-2.5 text-sm font-medium shadow-md ring-1 ring-border backdrop-blur transition-transform hover:scale-105"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              +
            </span>
            <span className="whitespace-nowrap">{room.name}</span>
          </button>
        </Html>
      )}
    </For>
  )
}
