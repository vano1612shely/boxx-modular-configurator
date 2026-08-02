'use client'

import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  CanvasTexture,
  PMREMGenerator,
  SRGBColorSpace,
  Vector3,
  type DirectionalLight,
  type SpotLight as ThreeSpotLight,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

import { For } from '@/shared/ui/control-flow'

import { roomFeatureSide, roomFocusTarget } from '../lib/room-framing'
import { planOpeningPlacements, type OpeningPlacement } from '../lib/room-shell'
import {
  facesSun,
  roomSunBearing,
  SUN_DISTANCE,
  sunRay,
  windowBeamCone,
  windowBeamHalfSize,
} from '../lib/sun-patch'
import type { RoomZone, Vec3Tuple } from '../model/types'

type Bounds = { min: Vec3Tuple; max: Vec3Tuple }

type Props = {
  bounds: Bounds | null
  focusedRoom: RoomZone | null
  exposure?: number
}

const SUN_DIRECTION = new Vector3(0.45, 0.85, 0.4).normalize()

/** Hoisted: a fresh array literal would be re-applied on every render. */
const SHADOW_MAP = [2048, 2048] as [number, number]

/** Widest half-extent the shadow camera is allowed to cover, in meters. */
const MAX_SHADOW_EXTENT = 24

const FALLBACK_RADIUS = 20

const SUNLIGHT = '#ffe9c8'
const SKYLIGHT = '#dbe9ff'
const GROUND_BOUNCE = '#b3a894'

// The glb's `metalness: 1` materials render black without an environment map.
// Strength is set once on the Canvas, as `scene={{ environmentIntensity }}`.
function ImageBasedLight() {
  const gl = useThree((state) => state.gl)

  const environment = useMemo(() => {
    const generator = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const target = generator.fromScene(room, 0.04)
    room.dispose()
    generator.dispose()
    return target
  }, [gl])

  useEffect(() => () => environment.dispose(), [environment])

  return <primitive object={environment.texture} attach="environment" />
}

function Sun({ bounds, intensity }: { bounds: Bounds | null; intensity: number }) {
  const light = useRef<DirectionalLight>(null)

  useEffect(() => {
    const sun = light.current
    if (!sun) return

    const centre = new Vector3()
    let radius = FALLBACK_RADIUS

    if (bounds) {
      const [minX, minY, minZ] = bounds.min
      const [maxX, maxY, maxZ] = bounds.max
      centre.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2)
      radius = Math.max(Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2, 1)
    }

    sun.position.copy(centre).addScaledVector(SUN_DIRECTION, radius * 3)
    sun.target.position.copy(centre)
    // The target is not in the scene graph, so nothing else will update it.
    sun.target.updateMatrixWorld()

    // three's default shadow frustum is a 10 m box at the world origin.
    const camera = sun.shadow.camera
    const extent = Math.min(radius * 1.25, MAX_SHADOW_EXTENT)
    camera.left = -extent
    camera.right = extent
    camera.top = extent
    camera.bottom = -extent
    camera.near = 0.5
    camera.far = radius * 8
    camera.updateProjectionMatrix()
  }, [bounds])

  return (
    <directionalLight
      ref={light}
      // No `position` prop: a fresh array literal counts as a changed prop
      // every render, so R3F would keep undoing the fit above.
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

function WindowSuns({ room, exposure }: { room: RoomZone; exposure: number }) {
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

function RoomKey({ room, intensity }: { room: RoomZone; intensity: number }) {
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

export function SceneLighting({ bounds, focusedRoom, exposure = 1 }: Props) {
  if (focusedRoom) {
    return (
      <>
        <ImageBasedLight />
        {/* Almost all hemisphere: it gives every vertical surface the same
            value, so four walls painted one colour read as one colour. */}
        <hemisphereLight intensity={0.85 * exposure} color={SKYLIGHT} groundColor={GROUND_BOUNCE} />
        <RoomKey room={focusedRoom} intensity={0.14 * exposure} />
        <WindowSuns room={focusedRoom} exposure={exposure} />
      </>
    )
  }

  return (
    <>
      <ImageBasedLight />
      <hemisphereLight intensity={0.6 * exposure} color={SKYLIGHT} groundColor={GROUND_BOUNCE} />
      <Sun bounds={bounds} intensity={1.7 * exposure} />
      <directionalLight position={[-7, 6, -5]} color={SKYLIGHT} intensity={0.3 * exposure} />
    </>
  )
}
