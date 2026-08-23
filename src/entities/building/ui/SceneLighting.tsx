'use client'

import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  CanvasTexture,
  SRGBColorSpace,
  type DirectionalLight,
  type SpotLight as ThreeSpotLight,
} from 'three'

import { roomEnvironment } from '@/shared/three/room-environment'
import { For, Show } from '@/shared/ui/control-flow'

import { roomFeatureSide, roomFocusTarget } from '../lib/room-framing'
import { sunPlacement } from '../lib/sun-placement'
import { planOpeningPlacements, type OpeningPlacement } from '../lib/room-shell'
import {
  facesSun,
  roomSunBearing,
  SUN_DISTANCE,
  sunRay,
  windowBeamCone,
  windowBeamHalfSize,
} from '../lib/sun-patch'
import type { Room, Vec3Tuple } from '../model/types'

type Bounds = { min: Vec3Tuple; max: Vec3Tuple }

type Props = {
  bounds: Bounds | null
  focusedRoom: Room | null
  exposure?: number
}

/** Hoisted: a fresh array literal would be re-applied on every render. */
const SHADOW_MAP = [2048, 2048] as [number, number]

const SUNLIGHT = '#ffe9c8'
const SKYLIGHT = '#dbe9ff'
const GROUND_BOUNCE = '#b3a894'

// The glb's `metalness: 1` materials render black without an environment map.
// Strength is set once on the Canvas, as `scene={{ environmentIntensity }}`.
// Cached per renderer and never disposed — see `roomEnvironment` for why.
function ImageBasedLight() {
  const gl = useThree((state) => state.gl)

  return <primitive object={roomEnvironment(gl)} attach="environment" />
}

function Sun({
  bounds,
  intensity,
  casting,
}: {
  bounds: Bounds | null
  intensity: number
  casting: boolean
}) {
  const light = useRef<DirectionalLight>(null)

  const placement = useMemo(() => sunPlacement(bounds), [bounds])

  /**
   * Re-asserted after every render, not once when the bounds arrive.
   *
   * The target and the shadow frustum are objects the light owns, and nothing
   * about them is a prop R3F would put back. Written once, they are lost the
   * first time anything rebuilds the light, and a sun whose target sits where
   * the sun does has no direction at all. This runs on the handful of renders
   * this rig ever has, which is not a cost worth being clever about.
   */
  useEffect(() => {
    const sun = light.current
    if (!sun) return

    // Not in the scene graph, so nothing else will ever update it.
    sun.target.position.set(...placement.target)
    sun.target.updateMatrixWorld()

    const camera = sun.shadow.camera
    camera.left = -placement.extent
    camera.right = placement.extent
    camera.top = placement.extent
    camera.bottom = -placement.extent
    camera.near = 0.5
    camera.far = placement.far
    camera.updateProjectionMatrix()
  })

  return (
    <directionalLight
      ref={light}
      // A prop, so R3F owns it and puts it back on every update it makes. It
      // was set imperatively once, for fear of a fresh array literal counting
      // as a change on every render — which a memoised one does not.
      position={placement.position}
      color={SUNLIGHT}
      intensity={intensity}
      castShadow={casting}
      shadow-mapSize={SHADOW_MAP}
      // r185 scales softness by `radius`; PCFSoftShadowMap is deprecated.
      shadow-radius={8}
      shadow-intensity={0.6}
      // Without these the model self-shadows in stripes.
      shadow-bias={-0.0004}
      shadow-normalBias={0.035}
    />
  )
}

/** How much of the beam's half-width is taken up by its soft edge. */
const FEATHER = 0.35
const DAYLIGHT = 1.5
const DAYLIGHT_COLOR = '#ffd9a0'

function feather(distance: number, half: number): number {
  const soft = Math.max(half * FEATHER, 1e-4)
  const k = Math.min(Math.max((half - distance) / soft, 0), 1)
  return k * k * (3 - 2 * k)
}

// Cached per shape and never disposed: a handful of 64 KB textures, and a
// disposed-then-reused texture fails silently rather than loudly.
const cookies = new Map<string, CanvasTexture>()

function windowCookie(halfU: number, halfV: number): CanvasTexture | null {
  if (typeof document === 'undefined') return null

  const key = `${halfU.toFixed(3)}x${halfV.toFixed(3)}`
  const cached = cookies.get(key)
  if (cached) return cached

  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')
  if (!context) return null

  const image = context.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value =
        feather(Math.abs((x + 0.5) / size - 0.5), halfU) *
        feather(Math.abs((y + 0.5) / size - 0.5), halfV)
      const level = Math.round(value * 255)
      const index = (y * size + x) * 4
      image.data[index] = level
      image.data[index + 1] = level
      image.data[index + 2] = level
      image.data[index + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  cookies.set(key, texture)
  return texture
}

function WindowSun({ placement, ray, exposure }: { placement: OpeningPlacement; ray: Vec3Tuple; exposure: number }) {
  const light = useRef<ThreeSpotLight>(null)
  const { center, tangent, opening } = placement

  const { angle, cookie } = useMemo(() => {
    const { halfWidth, halfHeight } = windowBeamHalfSize(
      ray,
      tangent,
      opening.width,
      opening.height,
    )
    const cone = windowBeamCone(halfWidth, halfHeight)
    return { angle: cone.angle, cookie: windowCookie(cone.halfU, cone.halfV) }
  }, [ray, tangent, opening.width, opening.height])

  const position: [number, number, number] = [
    center.x - ray[0] * SUN_DISTANCE,
    center.y - ray[1] * SUN_DISTANCE,
    center.z - ray[2] * SUN_DISTANCE,
  ]

  useEffect(() => {
    const spot = light.current
    if (!spot) return
    spot.target.position.set(center.x, center.y, center.z)
    spot.target.updateMatrixWorld()
  }, [center])

  if (!cookie) return null

  return (
    <spotLight
      ref={light}
      position={position}
      map={cookie}
      angle={angle}
      color={DAYLIGHT_COLOR}
      intensity={DAYLIGHT * exposure}
      // Sunlight does not get dimmer across a room.
      decay={0}
      distance={0}
      penumbra={1}
    />
  )
}

function WindowSuns({ room, exposure }: { room: Room; exposure: number }) {
  const glazed = useMemo(
    () =>
      planOpeningPlacements(room.floorPolygon, room.shell, room.openings).filter(
        (placement) => placement.opening.kind === 'window',
      ),
    [room],
  )

  const bearing = roomSunBearing(room)
  const ray = useMemo(() => sunRay(bearing), [bearing])
  const sideAxes = room.shell.sideAxes

  // Filtered from the windows the shell really cut: an opening too wide for
  // its edge is dropped, and lighting it aims a beam through solid wall.
  const windows = glazed.filter((placement) => {
    const axis = sideAxes[placement.side]
    return axis ? facesSun(axis, bearing) : false
  })

  return (
    <For each={windows} getKey={(placement) => placement.opening.id}>
      {(placement) => <WindowSun placement={placement} ray={ray} exposure={exposure} />}
    </For>
  )
}

function RoomKey({ room, intensity }: { room: Room; intensity: number }) {
  const light = useRef<DirectionalLight>(null)
  const [tx, ty, tz] = roomFocusTarget(room)
  const axis = room.shell.sideAxes[roomFeatureSide(room)] ?? { x: 0, z: -1 }
  const reach = Math.max(room.shell.wallHeight * 4, 8)

  useEffect(() => {
    const key = light.current
    if (!key) return
    key.target.position.set(tx, ty, tz)
    key.target.updateMatrixWorld()
  }, [tx, ty, tz])

  return (
    <directionalLight
      ref={light}
      position={[tx + axis.x * reach, ty + reach * 0.55, tz + axis.z * reach]}
      color={SUNLIGHT}
      intensity={intensity}
    />
  )
}

/**
 * One rig, dimmed and undimmed, rather than two swapped over.
 *
 * The outdoor lights are kept mounted through a room visit at zero intensity,
 * which looks the same as not having them and costs one thing less: unmounting
 * the sun disposes its 2048² shadow map, and coming back out of the room then
 * has to allocate a new one and fill it from scratch — on the same frame as the
 * room's geometry is being torn down and the camera is flying. That was the
 * hitch on the way out, and it was paid every single time.
 */
export function SceneLighting({ bounds, focusedRoom, exposure = 1 }: Props) {
  const outside = focusedRoom === null

  return (
    <>
      <ImageBasedLight />
      {/* Almost all hemisphere indoors: it gives every vertical surface the
          same value, so four walls painted one colour read as one colour. */}
      <hemisphereLight
        intensity={(outside ? 0.6 : 0.85) * exposure}
        color={SKYLIGHT}
        groundColor={GROUND_BOUNCE}
      />
      <Sun
        bounds={bounds}
        intensity={outside ? 1.7 * exposure : 0}
        // Nothing outdoors is drawn from inside a room, so the pass would be
        // over an empty scene — but the map it wrote stays allocated, which is
        // the whole point of keeping the light.
        casting={outside}
      />
      <directionalLight
        position={[-7, 6, -5]}
        color={SKYLIGHT}
        intensity={outside ? 0.3 * exposure : 0}
      />
      <Show when={focusedRoom}>
        {(room) => (
          <>
            <RoomKey room={room} intensity={0.14 * exposure} />
            <WindowSuns room={room} exposure={exposure} />
          </>
        )}
      </Show>
    </>
  )
}
