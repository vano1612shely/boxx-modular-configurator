'use client'

import { CameraControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import CameraControlsImpl from 'camera-controls'
import { useEffect, useMemo, useRef } from 'react'
import { Box3, MathUtils, Spherical, Vector3 } from 'three'

import type { BuildingScene, RoomZone } from '@/entities/building'
import { frameBuilding, frameRoom, orbitable, polygonBounds } from '@/entities/building'
import { useConfiguratorSession, type BuildingBounds } from '@/entities/configurator-session'

import { applyPreset } from '../lib/apply-preset'
import { cameraLimits } from '../lib/camera-limits'
import { offsetLimit, panSpeedFactor } from '../lib/pan-resistance'
import { pinPose } from '../lib/pin-pose'
import { azimuthRotateSpeed, polarRotateSpeed } from '../lib/rotate-speeds'
import { viewModePreset, type ViewScope } from '../lib/view-presets'
import { dollySpeedFor } from '../lib/wheel-dolly'

type Props = {
  building: BuildingScene
  focusedRoom: RoomZone | null
  enabled?: boolean
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

/** Reused so the per-event reads allocate nothing and mutate no hook value. */
const OFFSET_SCRATCH = new Vector3()
const SPHERICAL_SCRATCH = new Spherical()

/** camera-controls' own default; restated so the resistance has a fixed base. */
const PAN_SPEED = 2

const SMOOTH_TIME = 0.3
const DRAGGING_SMOOTH_TIME = 0.12

export function CameraRig({ building, focusedRoom, enabled = true }: Props) {
  const controlsRef = useRef<CameraControls>(null)
  const hasFlownRef = useRef(false)
  const viewMode = useConfiguratorSession((s) => s.viewMode)
  const viewRequestId = useConfiguratorSession((s) => s.viewRequestId)
  const buildingBounds = useConfiguratorSession((s) => s.buildingBounds)
  const moveToTarget = useConfiguratorSession((s) => s.moveToTarget)
  const domElement = useThree((s) => s.gl.domElement)
  const size = useThree((s) => s.size)
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
    controls.azimuthRotateSpeed = azimuthRotateSpeed(size.width, size.height)
    controls.polarRotateSpeed = polarRotateSpeed(camera.minPolarDeg, camera.maxPolarDeg)
  }, [size, camera])

  const fov = camera.fov

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    const { ACTION } = CameraControlsImpl

    // Panning must not carry the pivot with it. TRUCK — the default for the
    // right button, the middle button and two or three fingers — moves the
    // target as well as the camera, so one pan leaves the orbit centred on
    // wherever the drag ended and the dolly converging there too. OFFSET slides
    // the camera and leaves the target on the room centre, which is what all of
    // those gestures are expected to mean.
    controls.mouseButtons.right = ACTION.OFFSET
    controls.mouseButtons.middle = ACTION.OFFSET
    controls.touches.two = ACTION.TOUCH_DOLLY_OFFSET
    controls.touches.three = ACTION.TOUCH_OFFSET
    controls.truckSpeed = PAN_SPEED
    // Nothing may squeeze the lens: a zoom is a camera move here. Belt to the
    // braces of the wheel handler below.
    controls.minZoom = 1
    controls.maxZoom = 1

    // Must match the library's own test, or the wheel normalization inverts the
    // wrong divisor.
    const isMac = /Mac/.test(navigator.platform)

    const endRadius = () => controls.getSpherical(SPHERICAL_SCRATCH, true).radius

    /** Radius the focal offset currently matches, staged before a wheel dolly. */
    let scaledAt: number | null = null
    /** Radius the pan bound is measured against for the length of a gesture. */
    let gestureFrom: number | null = null
    let pinned = false

    const rescaleOffset = (ratio: number) => {
      if (!Number.isFinite(ratio) || ratio === 1) return
      const held = controls.getFocalOffset(OFFSET_SCRATCH, true)
      if (held.lengthSq() === 0) return
      void controls.setFocalOffset(held.x * ratio, held.y * ratio, held.z * ratio, true)
    }

    const onWheelCapture = (event: WheelEvent) => {
      // A macOS trackpad pinch arrives as a ctrlKey wheel, which camera-controls
      // hardcodes to ACTION.ZOOM: a lens squeeze with no parallax that no view
      // preset undoes. Take it off the library before it sees it.
      if (event.ctrlKey) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }

      if (!controls.enabled) return

      controls.dollySpeed = dollySpeedFor(event.deltaY, event.deltaMode, isMac)
      scaledAt = endRadius()
      if (!event.ctrlKey) return

      // Replayed plain, so it dollies through the library's own path and keeps
      // its dragging damping, which driving the dolly from here would drop.
      domElement.dispatchEvent(
        new WheelEvent('wheel', {
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaZ: event.deltaZ,
          deltaMode: event.deltaMode,
          clientX: event.clientX,
          clientY: event.clientY,
          bubbles: true,
          cancelable: true,
        }),
      )
    }

    // Nothing in camera-controls bounds the focal offset, so without this the
    // view could be slid until the subject left the frame.
    //
    // The bound is on the drag speed, never on the resulting offset. The library
    // applies an offset drag through setFocalOffset with a transition, so it is
    // damped; overwriting the value afterwards replaced that damping with a snap
    // from the moment the bound engaged, and the changeover was felt as a jolt
    // mid-travel. Slowing the drag leaves the library's own motion alone all the
    // way out, and the offset approaches the limit without reaching it.
    const resist = () => {
      const radius = endRadius()

      // A dolly leaves the offset alone, and the offset is world-space, so
      // zooming in multiplies whatever the pan slid off centre — the subject
      // swims out of frame as the camera closes. Holding the offset at a fixed
      // share of the radius makes the zoom a zoom and nothing else, and keeps
      // the screen-stated bound below invariant under it.
      if (scaledAt !== null) {
        const from = scaledAt
        scaledAt = null
        // Deferred to the end of a gesture: two fingers are TOUCH_DOLLY_OFFSET,
        // so rescaling here would clear `_isUserControllingOffset` under the
        // same fingers that are still sliding the offset, swapping its damping
        // for the resting one mid-drag.
        if (gestureFrom === null && from > 0) rescaleOffset(radius / from)
      }

      const offset = controls.getFocalOffset(OFFSET_SCRATCH, true)
      const reach = Math.hypot(offset.x, offset.y)
      // The bound is radius-proportional, so a pinch that shrinks the radius
      // would drag it down past a reach the same gesture had already earned and
      // stop the pan dead with the fingers still moving. Held at the radius the
      // gesture started from, it cannot cross itself mid-gesture.
      const limit = offsetLimit(gestureFrom ?? radius, fov)
      controls.truckSpeed = PAN_SPEED * panSpeedFactor(reach, limit)
    }

    const onControlStart = () => {
      gestureFrom = endRadius()
      // A wheel-tuned dollySpeed must not carry into the pinch after it.
      controls.dollySpeed = 1
      resist()
    }

    // camera-controls dispatches controlstart from every pointerdown, drag or
    // not, so a bare click would hard-stop a view flight that the click has no
    // business touching. Capture phase on the document, so the pin lands before
    // the library's own pointermove applies the drag to the pose it is pinning.
    const onPointerMoveCapture = () => {
      if (gestureFrom === null || pinned) return
      pinned = true
      pinPose(controls)
    }

    const onControlEnd = () => {
      if (gestureFrom !== null && gestureFrom > 0) rescaleOffset(endRadius() / gestureFrom)
      gestureFrom = null
      pinned = false
      resist()
    }

    const ownerDocument = domElement.ownerDocument
    domElement.addEventListener('wheel', onWheelCapture, { capture: true, passive: false })
    ownerDocument.addEventListener('pointermove', onPointerMoveCapture, { capture: true })
    controls.addEventListener('controlstart', onControlStart)
    controls.addEventListener('control', resist)
    controls.addEventListener('controlend', onControlEnd)
    return () => {
      domElement.removeEventListener('wheel', onWheelCapture, { capture: true })
      ownerDocument.removeEventListener('pointermove', onPointerMoveCapture, { capture: true })
      controls.removeEventListener('controlstart', onControlStart)
      controls.removeEventListener('control', resist)
      controls.removeEventListener('controlend', onControlEnd)
      controls.truckSpeed = PAN_SPEED
      controls.dollySpeed = 1
    }
  }, [domElement, fov])

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

    // The opening pose is a placement, not a move: camera-controls starts with
    // its target on the world origin, so animating the first one drifts the
    // model into place under the loader.
    const transition = hasFlownRef.current
    hasFlownRef.current = true

    applyPreset(controls, preset, transition)
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
      smoothTime={SMOOTH_TIME}
      draggingSmoothTime={DRAGGING_SMOOTH_TIME}
    />
  )
}
