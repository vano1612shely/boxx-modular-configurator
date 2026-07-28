'use client'

import { Line } from '@react-three/drei'

import { polygonBounds, roomSunBearing, sunHeading, type RoomZone } from '@/entities/building'

import { ScreenScaled } from './handles'

const SUN_COLOR = '#fbbf24'

/**
 * Where the sun is, as something you can see.
 *
 * A compass point in a dropdown is a fact you have to hold in your head while
 * you look at a room that is pointing whichever way the building was exported.
 * A marker sitting on that side of the room, with a line pointing in, is the
 * same fact where you are already looking.
 */
export function SunMarker({ room }: { room: RoomZone }) {
  if (room.floorPolygon.length < 3) return null

  const { minX, minZ, maxX, maxZ } = polygonBounds(room.floorPolygon)
  const centre = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 }
  const heading = sunHeading(roomSunBearing(room))

  // Clear of the walls whichever way it lands, and up near the top of them so
  // it reads as being in the sky rather than standing on the floor.
  const reach = Math.hypot(maxX - minX, maxZ - minZ) / 2 + 1.6
  const y = room.shell.floorY + room.shell.wallHeight * 1.15
  const at: [number, number, number] = [
    centre.x + heading.x * reach,
    y,
    centre.z + heading.z * reach,
  ]

  return (
    <group>
      {/* Which way the light travels, from the sun to the room. */}
      <Line
        points={[at, [centre.x, room.shell.floorY + room.shell.wallHeight * 0.5, centre.z]]}
        color={SUN_COLOR}
        lineWidth={1.5}
        dashed
        dashSize={0.25}
        gapSize={0.2}
        transparent
        opacity={0.55}
      />

      <ScreenScaled position={at}>
        <mesh raycast={() => {}}>
          <sphereGeometry args={[0.22, 20, 20]} />
          <meshBasicMaterial color={SUN_COLOR} toneMapped={false} />
        </mesh>
        {/* Eight spokes, so it reads as a sun and not as a stray handle. */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
          const angle = (index * Math.PI) / 4
          return (
            <mesh
              key={index}
              raycast={() => {}}
              position={[Math.cos(angle) * 0.38, Math.sin(angle) * 0.38, 0]}
              rotation={[0, 0, angle]}
            >
              <boxGeometry args={[0.16, 0.035, 0.035]} />
              <meshBasicMaterial color={SUN_COLOR} toneMapped={false} />
            </mesh>
          )
        })}
      </ScreenScaled>
    </group>
  )
}
