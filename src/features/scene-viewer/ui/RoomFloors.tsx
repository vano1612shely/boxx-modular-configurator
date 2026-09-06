'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Shape, ShapeGeometry } from 'three'

import type { Room } from '@/entities/building'
import { roomFloorTopY } from '@/entities/building'
import { HIGHLIGHT } from '@/shared/three/scene-tokens'
import { For } from '@/shared/ui/control-flow'
import { setSceneCursor } from '@/shared/ui/scene-cursor'

type Props = {
  rooms: Room[]
  previewedKey: string | null
  onPreviewRoom: (key: string) => void
}

/** Just clear of the model's own floor, or the two z-fight. */
const LIFT = 0.02

/** Pointer travel, in pixels, past which a press was a drag and not a click. */
const DRAG_SLOP = 4

/**
 * `ShapeGeometry` builds in XY, and laying it flat rotates −90° about X, which
 * sends the shape's +Y to world −Z. Feeding it −z back is what keeps the room
 * over the room it was traced from rather than mirrored across the building.
 */
function floorGeometry(room: Room): ShapeGeometry {
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
  room: Room
  previewed: boolean
  onPreview: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const geometry = useMemo(() => floorGeometry(room), [room])
  // Built here rather than in JSX, so R3F does not own it and nothing else
  // gives it back when the visitor leaves the overview.
  useEffect(() => () => geometry.dispose(), [geometry])
  // R3F only applies its own "did the pointer move" test to the miss path, so
  // an orbit that starts and ends over a floor arrives here as a click and
  // would preview the room the visitor was only turning the building around.
  const pressedAt = useRef<{ x: number; y: number } | null>(null)

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
      onPointerDown={(event) => {
        pressedAt.current = { x: event.clientX, y: event.clientY }
      }}
      onClick={(event) => {
        const from = pressedAt.current
        pressedAt.current = null
        if (!from || Math.hypot(event.clientX - from.x, event.clientY - from.y) > DRAG_SLOP) return

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
