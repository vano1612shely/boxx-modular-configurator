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
import { For } from '@/shared/ui/control-flow'

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

function Sun({ bounds, intensity }: { bounds: Bounds | null; intensity: number }) {
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
      castShadow
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

/**
 * Beams a room may have lit at once.
 *
 * A fixed count, mounted whether or not a room is open: three compiles a
 * material's shader against the number of lights in the scene, so a spotlight
 * that comes and goes with a room makes two shaders of every material — and
 * the building, drawn for a frame on the way out with the room's light still
 * up, compiled every one of its materials a second time. Idle beams sit at
 * zero intensity, which costs a little arithmetic per pixel and no compiles.
 * A room with more sun-facing windows than this lights the first of them.
 */
export const WINDOW_BEAMS = 2

/** The cookie an idle beam carries, so the count of mapped spots never moves. */
const IDLE_COOKIE_HALF = 0.5

function WindowSun({
  placement,
  ray,
  exposure,
}: {
  placement: OpeningPlacement | null
  ray: Vec3Tuple
  exposure: number
}) {
  const light = useRef<ThreeSpotLight>(null)

  const { angle, cookie } = useMemo(() => {
    if (!placement) {
      return { angle: Math.PI / 6, cookie: windowCookie(IDLE_COOKIE_HALF, IDLE_COOKIE_HALF) }
    }
    const { halfWidth, halfHeight } = windowBeamHalfSize(
      ray,
      placement.tangent,
      placement.opening.width,
      placement.opening.height,
    )
    const cone = windowBeamCone(halfWidth, halfHeight)
    return { angle: cone.angle, cookie: windowCookie(cone.halfU, cone.halfV) }
  }, [ray, placement])

  const center = placement?.center ?? IDLE_CENTER
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
      intensity={placement ? DAYLIGHT * exposure : 0}
      // Sunlight does not get dimmer across a room.
      decay={0}
      distance={0}
      penumbra={1}
    />
  )
}

/** Where an idle beam points. Anywhere: it is dark. */
const IDLE_CENTER = { x: 0, y: 0, z: 0 }

/** No room to take a bearing from: the beams still need a direction to hold. */
const IDLE_RAY: Vec3Tuple = [0, -1, 0]

function WindowSuns({ room, exposure }: { room: Room | null; exposure: number }) {
  const glazed = useMemo(
    () =>
      room
        ? planOpeningPlacements(room.floorPolygon, room.shell, room.openings).filter(
            (placement) => placement.opening.kind === 'window',
          )
        : [],
    [room],
  )

  const bearing = room ? roomSunBearing(room) : 0
  const ray = useMemo(() => (room ? sunRay(bearing) : IDLE_RAY), [room, bearing])
  const sideAxes = room?.shell.sideAxes

  // Filtered from the windows the shell really cut: an opening too wide for
  // its edge is dropped, and lighting it aims a beam through solid wall.
  const windows = sideAxes
    ? glazed.filter((placement) => {
        const axis = sideAxes[placement.side]
        return axis ? facesSun(axis, bearing) : false
      })
    : []

  // By slot, not by window: a slot keeps its light across rooms, and only the
  // beam in it changes. Keyed by window, a room change would remount them.
  const slots = Array.from({ length: WINDOW_BEAMS }, (_, index) => ({
    key: String(index),
    placement: windows[index] ?? null,
  }))

  return (
    <For each={slots} getKey={(slot) => slot.key}>
      {(slot) => <WindowSun placement={slot.placement} ray={ray} exposure={exposure} />}
    </For>
  )
}

function RoomKey({ room, intensity }: { room: Room | null; intensity: number }) {
  const light = useRef<DirectionalLight>(null)
  const [tx, ty, tz] = room ? roomFocusTarget(room) : [0, 0, 0]
  const axis = (room && room.shell.sideAxes[roomFeatureSide(room)]) ?? { x: 0, z: -1 }
  const reach = room ? Math.max(room.shell.wallHeight * 4, 8) : 8

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
      intensity={room ? intensity : 0}
    />
  )
}

/**
 * One rig, dimmed and undimmed, rather than two swapped over.
 *
 * Every light is mounted all the time, at zero intensity when its view is not
 * the one on screen. That is not thrift for its own sake: three compiles each
 * material's shader against the lights in the scene — how many of each kind,
 * how many cast shadows, how many carry a cookie — so a rig that changes shape
 * between the overview and a room hands every material two shaders, compiled
 * on the frame the visitor crosses the threshold. Worse, the order the frame
 * loop and React commit in is not fixed, and the building was regularly drawn
 * once under the room's lights on the way out: thirty-odd materials, compiled
 * a second time for a frame nobody saw, a second and a half of freeze.
 *
 * With the shape fixed, everything is compiled once, under the loading veil,
 * and a room visit compiles nothing. The sun keeps casting into its map from
 * inside a room too — the map it wrote stays allocated, and at zero intensity
 * a shadow is not a thing anyone can see.
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
      <Sun bounds={bounds} intensity={outside ? 1.7 * exposure : 0} />
      <directionalLight
        position={[-7, 6, -5]}
        color={SKYLIGHT}
        intensity={outside ? 0.3 * exposure : 0}
      />
      <RoomKey room={focusedRoom} intensity={0.14 * exposure} />
      <WindowSuns room={focusedRoom} exposure={exposure} />
    </>
  )
}
