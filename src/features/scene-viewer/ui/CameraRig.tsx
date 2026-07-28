'use client'

import { CameraControls } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import { Box3, MathUtils, Vector3 } from 'three'

import type { BuildingScene, CameraPreset, RoomZone } from '@/entities/building'
import {
  buildingExtent,
  fitDistance,
  frameBuilding,
  frameRoom,
  polygonBounds,
} from '@/entities/building'
import {
  useConfiguratorSession,
  type BuildingBounds,
  type ViewMode,
} from '@/entities/configurator-session'

/** Closest the camera may orbit while a room is focused, in metres. */
const ROOM_MIN_DISTANCE = 0.4

/**
 * How far each scope may be pushed away, and how far aside — deliberately not
 * the same numbers.
 *
 * `zoomOut` is a multiple of the fitted distance, where 1 means the subject
 * fills the frame. A room wants very little of it: pull back from a room and
 * there is nothing around it, so all you get is a small box adrift in an empty
 * frame. A building stands on a site and still reads from further out, so it
 * gets more rope.
 *
 * `panSlack` is how far past its own bounds the orbit target may be shoved, as
 * a fraction of the subject's radius. Clamping to the bounds exactly is correct
 * but feels stuck — you barely move before it refuses. This buys enough travel
 * to push the subject over against one edge of the frame and no further, so it
 * can be moved out of the way but never lost off screen.
 */
const LIMITS = {
  room: { zoomOut: 1.35, panSlack: 0.3 },
  building: { zoomOut: 1.6, panSlack: 0.5 },
} as const

type Props = {
  building: BuildingScene
  /** When set, view modes orbit this room instead of the whole building. */
  focusedRoom: RoomZone | null
  /** Pauses user camera input (e.g. while a package is being dragged). */
  enabled?: boolean
}

type ViewScope = {
  min: [number, number, number]
  max: [number, number, number]
  /** Preset used for the "dollhouse" mode of this scope. */
  dollhouse: CameraPreset
  /** Vertical field of view, so every view can be fitted rather than guessed. */
  fov: number
}

/**
 * What the camera is looking at right now — a single room, or the building.
 *
 * Both scopes are measured the same way and fitted the same way. That is the
 * whole point: every camera action is scaled by the orbit radius, so a scope
 * whose radius is not proportional to its subject makes panning, zooming and
 * orbiting behave nothing like they do in the other one.
 */
function scopeFor(
  building: BuildingScene,
  focusedRoom: RoomZone | null,
  buildingBounds: BuildingBounds | null,
): ViewScope | null {
  const fov = building.camera.fov

  if (focusedRoom) {
    const { minX, minZ, maxX, maxZ } = polygonBounds(focusedRoom.floorPolygon)
    const { floorY, wallHeight } = focusedRoom.shell
    // The room's own floor, not the world's: the building model sits on a base
    // that is not part of any room, so a scope anchored at y=0 aims every view
    // mode below the floor the visitor is looking at.
    return {
      min: [minX, floorY, minZ],
      max: [maxX, floorY + wallHeight, maxZ],
      dollhouse: frameRoom(focusedRoom, fov),
      fov,
    }
  }

  // The authored extent first — the glb's own box includes the site plate it
  // was exported with, which is four times the building and would frame a field.
  const extent =
    buildingExtent(building) ??
    (buildingBounds ? { min: buildingBounds.min, max: buildingBounds.max } : null)
  if (!extent) return null

  return {
    min: extent.min,
    max: extent.max,
    dollhouse: frameBuilding(extent.min, extent.max, fov, {
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
  // Fitted against the bounding sphere and the real field of view, so the
  // subject fills the frame from any angle at either scale.
  const fitted = fitDistance(Math.hypot(maxX - minX, height, maxZ - minZ) / 2, scope.fov)

  switch (mode) {
    case 'top':
      // Keep a slight tilt — an exact straight-down pose (polar 0) degenerates
      // the orbit math in camera-controls and can hang transitions out of it.
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

  /**
   * What the visitor is allowed to do with the camera.
   *
   * All three limits come off the same measured subject, so a room and the
   * whole building are governed by the same rule at their own scale: you may
   * zoom in until you are standing in the middle of it, pull back until it
   * fills about half the frame, and pan until it reaches the edge — never far
   * enough to lose it off screen and have to hunt for it again.
   */
  const limits = useMemo(() => {
    const floor = focusedRoom
      ? Math.min(camera.minDistance, ROOM_MIN_DISTANCE)
      : camera.minDistance
    const authoredCeiling = camera.maxDistance * 1.4
    if (!scope) return { min: floor, max: authoredCeiling, boundary: null }

    const [minX, minY, minZ] = scope.min
    const [maxX, maxY, maxZ] = scope.max
    const radius = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2
    const { zoomOut, panSlack } = focusedRoom ? LIMITS.room : LIMITS.building

    return {
      min: floor,
      // Whichever is tighter — the admin's own ceiling still counts.
      max: Math.min(authoredCeiling, fitDistance(radius, scope.fov) * zoomOut),
      // Bounds the TARGET, not the camera: panning slides what you orbit, and
      // once that reaches the far corner the subject is already at the edge of
      // the frame. Camera-controls clamps it for us from here on.
      boundary: new Box3(
        new Vector3(minX, minY, minZ),
        new Vector3(maxX, maxY, maxZ),
      ).expandByScalar(radius * panSlack),
    }
  }, [scope, camera, focusedRoom])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    controls.setBoundary(limits.boundary ?? undefined)
  }, [limits])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    const preset =
      moveToTarget ??
      (scope
        ? viewModePreset(viewMode, scope)
        : { position: camera.position, target: camera.target })

    const [px, py, pz] = preset.position
    const [tx, ty, tz] = preset.target

    void controls.setLookAt(px, py, pz, tx, ty, tz, true)
    // moveToTarget is cleared by the session store on the next mode/focus change.
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
