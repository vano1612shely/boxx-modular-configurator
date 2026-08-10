'use client'

import { CameraControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import CameraControlsImpl from 'camera-controls'
import { useEffect, useMemo, useRef } from 'react'
import { Box3, MathUtils, Spherical, Vector3 } from 'three'

import type { BuildingFloor, BuildingScene, Room } from '@/entities/building'
import { floorExtent, frameBuilding, frameExtent, orbitable } from '@/entities/building'
import { useConfiguratorSession, type BuildingBounds } from '@/entities/configurator-session'

import { applyPreset } from '../lib/apply-preset'
import { cameraLimits } from '../lib/camera-limits'
import { clampOffsetToLimit } from '../lib/clamp-offset'
import { groundOffsetLimit } from '../lib/ground-clearance'
import { offsetLimit, panSpeedFactor } from '../lib/pan-resistance'
import { quarterTurn } from '../lib/quarter-turn'
import { pinPose } from '../lib/pin-pose'
import { azimuthRotateSpeed, polarRotateSpeed } from '../lib/rotate-speeds'
import { roomScope, viewModePreset, type ViewScope } from '../lib/view-presets'
import { dollySpeedFor } from '../lib/wheel-dolly'

type Props = {
  building: BuildingScene
  focusedRoom: Room | null
  previewedRoom: Room | null
  floor: BuildingFloor | null
  enabled?: boolean
}

function scopeFor(
  building: BuildingScene,
  focusedRoom: Room | null,
  buildingBounds: BuildingBounds | null,
  floor: BuildingFloor | null,
  previewedRoom: Room | null,
): ViewScope | null {
  const fov = building.camera.fov

  if (focusedRoom) return roomScope(focusedRoom, fov)

  // The same extent as being in the room, but arrived at in the top view, so
  // the visitor is looking straight down at one room instead of at the middle
  // of the whole building. It also bounds the zoom and the pan to that room.
  if (previewedRoom) return roomScope(previewedRoom, fov)

  if (!buildingBounds) return null

  // A storey gets a fresh frame rather than the authored pose: that pose was
  // aimed at the whole building, and reusing it would leave the visitor's pick
  // looking like nothing happened.
  if (floor) {
    const { min, max } = floorExtent(floor, buildingBounds)
    return { min, max, dollhouse: frameExtent(min, max, fov), fov }
  }

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
const TARGET_SCRATCH = new Vector3()
const SPHERICAL_SCRATCH = new Spherical()

/** camera-controls' own default; restated so the resistance has a fixed base. */
const PAN_SPEED = 2

const SMOOTH_TIME = 0.3
const DRAGGING_SMOOTH_TIME = 0.12

export function CameraRig({
  building,
  focusedRoom,
  previewedRoom,
  floor,
  enabled = true,
}: Props) {
  const controlsRef = useRef<CameraControls>(null)
  const hasFlownRef = useRef(false)
  const viewMode = useConfiguratorSession((s) => s.viewMode)
  const viewRequestId = useConfiguratorSession((s) => s.viewRequestId)
  const rotateRequestId = useConfiguratorSession((s) => s.rotateRequestId)
  const buildingBounds = useConfiguratorSession((s) => s.buildingBounds)
  const domElement = useThree((s) => s.gl.domElement)
  const size = useThree((s) => s.size)
  const { camera } = building

  const scope = useMemo(
    () => scopeFor(building, focusedRoom, buildingBounds, floor, previewedRoom),
    [building, focusedRoom, buildingBounds, floor, previewedRoom],
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

  // The floor under whatever is being looked at: the site for the building, the
  // storey's own base for a storey, the room's walkable level for a room.
  const groundY = scope ? scope.min[1] : null
  const groundRef = useRef<number | null>(null)

  // Declared above the listeners so it has landed before any of them can fire,
  // and kept in a ref so a new scope does not re-register the whole set.
  useEffect(() => {
    groundRef.current = groundY
  }, [groundY])

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

    /**
     * How far the view may still be slid downward before the eye reaches the
     * ground. Read live, because the pose it depends on is not the radius: the
     * same offset that is harmless overhead puts the eye underground at the
     * horizon.
     */
    const downLimit = (radius: number) => {
      const ground = groundRef.current
      if (ground === null) return Infinity

      const { phi } = controls.getSpherical(SPHERICAL_SCRATCH, true)
      const { y } = controls.getTarget(TARGET_SCRATCH, true)
      return groundOffsetLimit({ radius, phi, targetY: y }, ground)
    }

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

      // The bound is radius-proportional, so a pinch that shrinks the radius
      // would drag it down past a reach the same gesture had already earned and
      // stop the pan dead with the fingers still moving. Held at the radius the
      // gesture started from, it cannot cross itself mid-gesture.
      const measuredAt = gestureFrom ?? radius
      const down = downLimit(measuredAt)

      // Between gestures only: the bounds move with the pose, so a zoom or a
      // swing towards the horizon can leave the offset outside them, and the
      // resistance below is zero out there — which panning cannot undo, panning
      // being what it switches off.
      if (gestureFrom === null) clampOffsetToLimit(controls, fov, down)

      const offset = controls.getFocalOffset(OFFSET_SCRATCH, true)
      const reach = Math.hypot(offset.x, offset.y)
      // Two bounds, one speed. Sliding sideways cannot lower the eye, so the
      // ground is measured against the downward component alone — but truckSpeed
      // is a single scalar, so nearing the ground does slow a sideways drag too.
      // Splitting it per axis would mean rewriting what `panSpeedFactor` means.
      controls.truckSpeed =
        PAN_SPEED *
        Math.min(
          panSpeedFactor(reach, offsetLimit(measuredAt, fov)),
          panSpeedFactor(Math.max(offset.y, 0), down),
        )
    }

    const onControlStart = () => {
      // Before the gesture's own radius is latched, so a drag never starts from
      // outside the bound and spends its whole length at zero speed.
      clampOffsetToLimit(controls, fov, downLimit(endRadius()))
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
      // The first genuine movement of a gesture, which is exactly when the view
      // stops being the one a button asked for. A bare click never gets here —
      // it dispatches controlstart but no pointermove — and neither does the
      // wheel, which dispatches neither, so a zoom keeps the label.
      useConfiguratorSession.getState().noteManualView()
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

    // Read, not subscribed: `requestMoveTo` bumps `viewRequestId`, so this
    // effect already re-runs for it. Subscribing would make the clear below a
    // second run, and holding the pose instead of consuming it would fly the
    // camera back to it on every later scope change — a storey pick, a resize,
    // the bounds resolving — long after the visitor asked to go somewhere once.
    const session = useConfiguratorSession.getState()
    const moveTo = session.moveToTarget
    if (moveTo) session.clearMoveTo()

    const preset =
      moveTo ??
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
  }, [camera, scope, viewMode, viewRequestId])

  // Its own effect, not the preset one above: a turn rewrites the bearing and
  // nothing else, so it keeps the zoom, the tilt and the pan the visitor has
  // built up — all of which `applyPreset` would throw away. `rotateAzimuthTo`
  // is the library's own setter, and the target is not touched.
  useEffect(() => {
    const controls = controlsRef.current
    // Zero is the opening value, not a request; acting on it would spin the
    // camera off its authored pose the moment the scene appeared.
    if (!controls || rotateRequestId === 0) return

    const { rotateDirection } = useConfiguratorSession.getState()
    void controls.rotateAzimuthTo(quarterTurn(controls.azimuthAngle, rotateDirection), true)
  }, [rotateRequestId])

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
