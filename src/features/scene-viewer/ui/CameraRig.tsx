'use client'

import { CameraControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import CameraControlsImpl from 'camera-controls'
import { useEffect, useMemo, useRef } from 'react'
import { Box3, MathUtils, Vector3 } from 'three'

import type { BuildingScene, CameraPreset, RoomZone } from '@/entities/building'
import {
  fitDistance,
  frameBuilding,
  frameRoom,
  orbitable,
  polygonBounds,
} from '@/entities/building'
import {
  useConfiguratorSession,
  type BuildingBounds,
  type ViewMode,
} from '@/entities/configurator-session'

import { cameraLimits } from '../lib/camera-limits'

type Props = {
  building: BuildingScene
  focusedRoom: RoomZone | null
  enabled?: boolean
}

type ViewScope = {
  min: [number, number, number]
  max: [number, number, number]
  dollhouse: CameraPreset
  fov: number
}

function scopeFor(
  building: BuildingScene,
  focusedRoom: RoomZone | null,
  buildingBounds: BuildingBounds | null,
): ViewScope | null {
  const fov = building.camera.fov

  if (focusedRoom) {
    const { minX, minZ, maxX, maxZ } = polygonBounds(focusedRoom.floorPolygon)
    const { floorY, wallHeight } = focusedRoom.shell
    // Anchor at the room's floorY, not y=0: the model sits on a base that
    // belongs to no room.
    return {
      min: [minX, floorY, minZ],
      max: [maxX, floorY + wallHeight, maxZ],
      dollhouse: frameRoom(focusedRoom, fov),
      fov,
    }
  }

  if (!buildingBounds) return null

  const { min, max } = buildingBounds

  return {
    min,
    max,
    dollhouse: frameBuilding(min, max, fov, {
      position: building.camera.position,
      target: building.camera.target,
    }),
    fov,
  }
}

function viewModePreset(mode: ViewMode, scope: ViewScope): CameraPreset {
  const [minX, minY, minZ] = scope.min
  const [maxX, maxY, maxZ] = scope.max
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const spread = Math.max(maxX - minX, maxZ - minZ)
  const height = maxY - minY
  const target: [number, number, number] = [cx, minY + height * 0.45, cz]
  const fitted = fitDistance(Math.hypot(maxX - minX, height, maxZ - minZ) / 2, scope.fov)

  switch (mode) {
    case 'top':
      // Slight tilt: polar 0 degenerates camera-controls' orbit math.
      return {
        position: [cx, minY + fitted, cz + spread * 0.08],
        target: [cx, minY, cz],
      }
    case 'side-front':
      return { position: [cx, minY + height * 1.1, maxZ + fitted], target }
    case 'side-back':
      return { position: [cx, minY + height * 1.1, minZ - fitted], target }
    case 'side-right':
      return { position: [maxX + fitted, minY + height * 1.1, cz], target }
    case 'side-left':
      return { position: [minX - fitted, minY + height * 1.1, cz], target }
    case 'dollhouse':
    default:
      return scope.dollhouse
  }
}

/** Reused so the per-frame offset clamp allocates nothing and mutates no hook value. */
const OFFSET_SCRATCH = new Vector3()

/** How far the view may slide off the subject, as a fraction of its radius. */
const MAX_OFFSET_RATIO = 0.6

export function CameraRig({ building, focusedRoom, enabled = true }: Props) {
  const controlsRef = useRef<CameraControls>(null)
  const viewMode = useConfiguratorSession((s) => s.viewMode)
  const viewRequestId = useConfiguratorSession((s) => s.viewRequestId)
  const buildingBounds = useConfiguratorSession((s) => s.buildingBounds)
  const moveToTarget = useConfiguratorSession((s) => s.moveToTarget)
  const { camera } = building

  const scope = useMemo(
    () => scopeFor(building, focusedRoom, buildingBounds),
    [building, focusedRoom, buildingBounds],
  )

  const limits = useMemo(
    () => cameraLimits(scope, camera, focusedRoom !== null),
    [scope, camera, focusedRoom],
  )

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const box = limits.boundary
    controls.setBoundary(
      box ? new Box3(new Vector3(...box.min), new Vector3(...box.max)) : undefined,
    )
  }, [limits])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    // Panning must not carry the pivot with it. TRUCK — the default for the
    // right button and two fingers — moves the target as well as the camera, so
    // one pan leaves the orbit centred on wherever the drag ended and the dolly
    // converging there too. OFFSET slides the camera and leaves the target on
    // the room centre, which is what both gestures are expected to mean.
    controls.mouseButtons.right = CameraControlsImpl.ACTION.OFFSET
    controls.touches.two = CameraControlsImpl.ACTION.TOUCH_DOLLY_OFFSET
  }, [])

  const maxOffset = useMemo(() => {
    if (!scope) return 0
    const [minX, minY, minZ] = scope.min
    const [maxX, maxY, maxZ] = scope.max
    return (Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2) * MAX_OFFSET_RATIO
  }, [scope])

  // Nothing in camera-controls bounds the focal offset, so without this the view
  // can be slid until the room leaves the frame with no way back but a preset.
  useFrame(() => {
    const controls = controlsRef.current
    if (!controls || maxOffset <= 0) return

    const offset = controls.getFocalOffset(OFFSET_SCRATCH, true)
    const planar = Math.hypot(offset.x, offset.y)
    if (planar <= maxOffset) return

    const scale = maxOffset / planar
    void controls.setFocalOffset(offset.x * scale, offset.y * scale, offset.z, false)
  })

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    const preset =
      moveToTarget ??
      (scope
        ? viewModePreset(viewMode, scope)
        : { position: camera.position, target: camera.target })

    // A preset whose target sits on its own position leaves the controls
    // spinning on the spot.
    if (!orbitable(preset)) return

    const [px, py, pz] = preset.position
    const [tx, ty, tz] = preset.target

    // camera-controls accumulates azimuth and never normalizes it itself;
    // without this, setLookAt unwinds every accumulated turn.
    controls.normalizeRotations()
    // setLookAt leaves the focal offset alone, so a view picked after panning
    // would arrive with the pan still applied and sit off-centre.
    void controls.setFocalOffset(0, 0, 0, true)
    void controls.setLookAt(px, py, pz, tx, ty, tz, true)
  }, [camera, scope, viewMode, viewRequestId, moveToTarget])

  const minPolar =
    viewMode === 'top' ? MathUtils.degToRad(3) : MathUtils.degToRad(camera.minPolarDeg)

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      enabled={enabled}
      minDistance={limits.min}
      maxDistance={limits.max}
      minPolarAngle={minPolar}
      maxPolarAngle={MathUtils.degToRad(camera.maxPolarDeg)}
      smoothTime={0.35}
      draggingSmoothTime={0.12}
    />
  )
}
