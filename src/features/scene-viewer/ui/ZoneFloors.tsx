'use client'

import { useMemo, useRef, useState } from 'react'
import { Shape, ShapeGeometry } from 'three'

import type { Room, Zone } from '@/entities/building'
import { roomFloorTopY } from '@/entities/building'
import { For } from '@/shared/ui/control-flow'
import { setSceneCursor } from '@/shared/ui/scene-cursor'

type Props = {
  room: Room
  activeZoneKey: string | null
  onPickZone: (key: string) => void
}

/** Clear of the generated floor, and under the furniture standing on it. */
const LIFT = 0.015

/** Pointer travel, in pixels, past which a press was a drag and not a click. */
const DRAG_SLOP = 4

/**
 * `ShapeGeometry` builds in XY, and laying it flat rotates −90° about X, which
 * sends the shape's +Y to world −Z. Feeding it −z back is what keeps the zone
 * over the floor it was traced from rather than mirrored across the room.
 */
function floorGeometry(zone: Zone): ShapeGeometry {
  const shape = new Shape()
  zone.polygon.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, -point.z)
    else shape.lineTo(point.x, -point.z)
  })
  shape.closePath()
  return new ShapeGeometry(shape)
}

function ZoneFloor({
  zone,
  y,
  active,
  onPick,
}: {
  zone: Zone
  y: number
  active: boolean
  onPick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const geometry = useMemo(() => floorGeometry(zone), [zone])
  // R3F only applies its own "did the pointer move" test to the miss path, so
  // an orbit that starts and ends over a zone arrives here as a click and would
  // switch the panel out from under a visitor who was only turning the room.
  const pressedAt = useRef<{ x: number; y: number } | null>(null)

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, y + LIFT, 0]}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHovered(true)
        if (!active) setSceneCursor('movable')
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
        onPick()
      }}
    >
      <meshBasicMaterial
        color={zone.color}
        transparent
        // The one you are in goes clear. Its tint was there to say "this is a
        // separate place you could go to", and once you are in it the answer is
        // the panel on the left, not paint on the floor you are standing on.
        opacity={active ? 0 : hovered ? 0.22 : 0.12}
        depthWrite={false}
      />
    </mesh>
  )
}

/**
 * The halves of a divided room, tinted on the floor and clickable.
 *
 * Nothing is built between them — the whole point of a zone is that there is no
 * partition — so the tint is the only thing that says where one ends.
 */
export function ZoneFloors({ room, activeZoneKey, onPickZone }: Props) {
  const y = roomFloorTopY(room)

  return (
    <For each={room.zones} getKey={(zone) => zone.key}>
      {(zone) => (
        <ZoneFloor
          zone={zone}
          y={y}
          active={activeZoneKey === zone.key}
          onPick={() => onPickZone(zone.key)}
        />
      )}
    </For>
  )
}
