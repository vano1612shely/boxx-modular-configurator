'use client'

import { useMemo, useState } from 'react'
import { Shape, ShapeGeometry } from 'three'

import type { RoomZone } from '@/entities/building'
import { roomFloorTopY } from '@/entities/building'
import { HIGHLIGHT } from '@/shared/three/scene-tokens'
import { For } from '@/shared/ui/control-flow'
import { setSceneCursor } from '@/shared/ui/scene-cursor'

type Props = {
  rooms: RoomZone[]
  previewedKey: string | null
  onPreviewRoom: (key: string) => void
}

/** Just clear of the model's own floor, or the two z-fight. */
const LIFT = 0.02

/**
 * `ShapeGeometry` builds in XY, and laying it flat rotates −90° about X, which
 * sends the shape's +Y to world −Z. Feeding it −z back is what keeps the room
 * over the room it was traced from rather than mirrored across the building.
 */
function floorGeometry(room: RoomZone): ShapeGeometry {
  const shape = new Shape()
  room.floorPolygon.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, -point.z)
    else shape.lineTo(point.x, -point.z)
  })
  shape.closePath()
  return new ShapeGeometry(shape)
}

function RoomFloor({
  room,
  previewed,
  onPreview,
}: {
  room: RoomZone
  previewed: boolean
  onPreview: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const geometry = useMemo(() => floorGeometry(room), [room])

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, roomFloorTopY(room) + LIFT, 0]}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHovered(true)
        setSceneCursor('movable')
      }}
      onPointerOut={() => {
        setHovered(false)
        setSceneCursor('default')
      }}
      onClick={(event) => {
        event.stopPropagation()
        onPreview()
      }}
    >
      <meshBasicMaterial
        color={HIGHLIGHT.selected}
        transparent
        // Invisible until it is pointed at: the whole floor going coloured on
        // load would read as a state the building is in, not something to click.
        opacity={previewed ? 0.16 : hovered ? 0.1 : 0}
        depthWrite={false}
      />
    </mesh>
  )
}

/**
 * The floor of each room, clickable in its entirety.
 *
 * Zooming in the overview always closes on the middle of the building, because
 * the wheel dollies down the camera-to-target ray and the target is the whole
 * building's centre. That is no help when the room of interest is at one end.
 * Clicking its floor moves the target to that room and looks straight down at
 * it — closer, but still outside, with the room's own marker still the way in.
 */
export function RoomFloors({ rooms, previewedKey, onPreviewRoom }: Props) {
  return (
    <For each={rooms} getKey={(room) => room.key}>
      {(room) => (
        <RoomFloor
          room={room}
          previewed={previewedKey === room.key}
          onPreview={() => onPreviewRoom(room.key)}
        />
      )}
    </For>
  )
}
