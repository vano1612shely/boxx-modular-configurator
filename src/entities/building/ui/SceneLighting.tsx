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

/**
 * The scene's light, shared by the client and the editor.
 *
 * Two rigs, because the two views want opposite things. The building is a real
 * object standing outdoors and only reads as one with a sun over it. A focused
 * room is a cutaway: a shadow there is just something that swings across the
 * floor every time a wall steps aside, so it has none — the light comes in
 * through the windows and stays there.
 *
 * Both rigs lean on the environment map rather than on ambient light. Ambient
 * is the flattest light there is: it adds the same value to every face
 * whatever way it points, which is exactly how a render ends up looking like
 * untextured plastic. An environment varies with direction, so a wall and the
 * floor it meets pick up different light and the corner between them appears
 * without anything having to cast a shadow.
 */

type Bounds = { min: Vec3Tuple; max: Vec3Tuple }

type Props = {
  bounds: Bounds | null
  focusedRoom: RoomZone | null
  /**
   * Multiplies every light in the rig.
   *
   * The client's room is lit for mood — dim enough that a shaft of daylight is
   * the brightest thing in it. The editor shows the same room with a building
   * around it and things to aim at, and wants to be able to see all of it, so
   * it turns the same rig up rather than running a different one.
   */
  exposure?: number
}

/** Where the sun sits, before it is scaled to the model it has to cover. */
const SUN_DIRECTION = new Vector3(0.45, 0.85, 0.4).normalize()

/** Hoisted: a fresh array literal would be re-applied on every render. */
const SHADOW_MAP = [2048, 2048] as [number, number]

/**
 * Widest half-extent the shadow camera is allowed to cover, in meters.
 *
 * The glb includes a 45 m site plane, so fitting the shadow frustum to the
 * model's own bounds spends nearly all of the map on empty ground. Clamping
 * keeps the texels on the building, where the shadow actually is.
 */
const MAX_SHADOW_EXTENT = 24

/** Radius assumed when nothing has measured the model yet. */
const FALLBACK_RADIUS = 20

/** Warm key, cool bounce — the split that reads as daylight rather than as a lamp. */
const SUNLIGHT = '#ffe9c8'
const SKYLIGHT = '#dbe9ff'
const GROUND_BOUNCE = '#b3a894'

/**
 * Image-based light from a procedural room.
 *
 * Not decoration. The building glb is full of `metalness: 1` materials —
 * metal_chrome, Aluminum, old_metal_2, the entrance stairs among them — and a
 * metal has no diffuse colour of its own: everything it shows is a reflection.
 * With nothing to reflect it renders black, which is exactly what the stairs
 * were doing. Generated on the GPU from geometry three already ships, so it
 * costs no download and needs no network.
 *
 * Attached rather than assigned: `scene` comes out of a hook and the compiler
 * is right to refuse writes behind React's back. Its strength is set once, on
 * the Canvas, as `scene={{ environmentIntensity }}`.
 */
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

/** The building's sun, with a shadow frustum that actually covers it. */
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
    // The target is not in the scene graph, so nothing else will update it —
    // and nothing else needs to, since it never moves again.
    sun.target.updateMatrixWorld()

    // three's default shadow frustum is a 10 m box at the world origin. On a
    // 15 x 18 m building most of the model fell outside it and got no shadow
    // at all, while the frustum's edge drew a hard straight line across
    // whatever it did cover — the stray dark quadrilateral on the floor.
    const camera = sun.shadow.camera
    const extent = Math.min(radius * 1.25, MAX_SHADOW_EXTENT)
    camera.left = -extent
    camera.right = extent
    camera.top = extent
    camera.bottom = -extent
    // Generous depth range: a near plane fitted to the light's distance clips
    // the far half of the model straight out of the shadow map.
    camera.near = 0.5
    camera.far = radius * 8
    camera.updateProjectionMatrix()
  }, [bounds])

  return (
    <directionalLight
      ref={light}
      // No `position` prop on purpose. A fresh array literal counts as a
      // changed prop every render, so R3F would keep snapping the light back
      // to it and undo the fit above — which is why nothing cast a shadow.
      color={SUNLIGHT}
      intensity={intensity}
      castShadow
      shadow-mapSize={SHADOW_MAP}
      // r185 replaced the PCF kernel with a Vogel disk scaled by `radius`, so
      // softness is a dial now — PCFSoftShadowMap itself is deprecated and
      // silently falls back to PCF.
      shadow-radius={8}
      shadow-intensity={0.6}
      // Without these the model self-shadows in stripes, which was most of
      // what "the shadows look strange" actually was.
      shadow-bias={-0.0004}
      shadow-normalBias={0.035}
    />
  )
}

/** How much of the beam's half-width is taken up by its soft edge. */
const FEATHER = 0.35
/** Strength of the daylight coming through one window. */
const DAYLIGHT = 1.5
/** Colour of it. Warmer than the key, the way low sun is. */
const DAYLIGHT_COLOR = '#ffd9a0'

/** 1 well inside the edge, 0 outside it, smooth across. */
function feather(distance: number, half: number): number {
  const soft = Math.max(half * FEATHER, 1e-4)
  const k = Math.min(Math.max((half - distance) / soft, 0), 1)
  return k * k * (3 - 2 * k)
}

/**
 * The window-shaped mask a spot light wears.
 *
 * White inside the window, black outside, soft across the join — the light
 * multiplies its colour by this, so the beam takes the shape of the opening it
 * came through. Cached per shape and never disposed: they are 64 KB each,
 * there are only ever a handful, and a disposed-then-reused texture fails
 * silently rather than loudly.
 */
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
 * One window, throwing daylight into the room.
 *
 * A spot light standing outside the window, aimed along the sun, wearing the
 * window as a mask. Because it is a light and not a decal, the beam lands on
 * the floor, over the furniture and up the far wall — which is the difference
 * the reference images show. No shadows: nothing in a room casts them, so the
 * beam cannot vanish when the wall carrying its window steps aside.
 */
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

  // Stood back along the sun's direction, so the beam arrives near-parallel
  // rather than fanning out of a lamp sitting in the window.
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

/**
 * Daylight through every window on the sunny side.
 *
 * Only that side. Letting each window light itself put beams across the room
 * at conflicting angles, which reads as several suns rather than one.
 */
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

  // Only walls the sun can actually reach. Chosen from the windows that were
  // really CUT, not the ones on paper: an opening too wide for its edge is
  // dropped by the shell, and lighting it aims a beam through solid wall.
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

/**
 * The room's key light: outside the window wall, aimed in.
 *
 * Nothing in a room casts or receives shadows, so this is only ever direction
 * — which is the point. It does not vanish when the wall carrying the windows
 * steps aside, because there is no wall in its way to begin with.
 */
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
        {/*
          The room's light is deliberately almost all hemisphere, and that is
          the whole point.

          A hemisphere gives every VERTICAL surface the same value, whichever
          way it faces — it mixes sky and ground by how far a normal tilts up or
          down, and a wall does not tilt at all. So four walls painted one
          colour read as one colour. A directional light does the opposite: its
          value is the angle between the surface and the light, so two walls
          meeting at a corner get two different tones and read as two different
          paints. That is exactly what was happening, and why turning the whole
          rig up did not help — it scaled the difference along with everything
          else.

          What is left of the key is a hint of modelling, not a light source.
        */}
        <hemisphereLight intensity={0.85 * exposure} color={SKYLIGHT} groundColor={GROUND_BOUNCE} />
        <RoomKey room={focusedRoom} intensity={0.14 * exposure} />
        {/* Untouched: the beam through the window is the one thing in here
            allowed to be brighter than its surroundings. */}
        <WindowSuns room={focusedRoom} exposure={exposure} />
      </>
    )
  }

  return (
    <>
      <ImageBasedLight />
      {/* Outdoors the sun has to stay the strongest thing in frame or the
          building stops looking like it is standing in daylight — but the same
          rule applies to its walls, so the hemisphere carries enough that a
          shaded elevation is a shaded elevation and not a darker building. */}
      <hemisphereLight intensity={0.6 * exposure} color={SKYLIGHT} groundColor={GROUND_BOUNCE} />
      <Sun bounds={bounds} intensity={1.7 * exposure} />
      <directionalLight position={[-7, 6, -5]} color={SKYLIGHT} intensity={0.3 * exposure} />
    </>
  )
}
