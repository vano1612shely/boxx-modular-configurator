'use client'

import { Html } from '@react-three/drei'
import { Plus } from 'lucide-react'

import type { RoomZone } from '@/entities/building'
import { polygonCentroid, roomFloorTopY } from '@/entities/building'
import { Chip } from '@/shared/ui/boxx'
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
        </Html>
      )}
    </For>
  )
}
