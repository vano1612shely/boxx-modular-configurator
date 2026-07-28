'use client'

import { Html, useGLTF } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { RotateCw, Trash2 } from 'lucide-react'
import { damp, dampAngle } from 'maath/easing'
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import {
  BackSide,
  Box3,
  Color,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  type Group,
  type Object3D,
} from 'three'

import type { BuildingScene, RoomZone } from '@/entities/building'
import { clampPoseToPolygon, progressiveEdgeSnap, roomFloorTopY } from '@/entities/building'
import { useConfiguration, type PlacedPackage } from '@/entities/configuration'
import { useConfiguratorSession } from '@/entities/configurator-session'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
import { For, Show } from '@/shared/ui/control-flow'

import { setSceneCursor } from '@/shared/ui/scene-cursor'

import { collidesWithAny } from '../lib/placement-geometry'
import { footprintOf, setMeasuredFootprint } from '../lib/measured-footprints'

type Props = {
  building: BuildingScene
  packages: FurniturePackageEntity[]
}

type Obstacle = {
  x: number
  z: number
  rotationYDeg: number
  footprint: FurniturePackageEntity['footprint']
}

function obstaclesFor(
  placed: PlacedPackage[],
  packagesById: Map<number, FurniturePackageEntity>,
  roomKey: string,
  excludeInstanceId: string,
): Obstacle[] {
  return placed
    .filter((p) => p.instanceId !== excludeInstanceId && p.roomKey === roomKey)
    .flatMap((p) => {
      const pkg = packagesById.get(p.packageId)
      return pkg
        ? [
            {
              x: p.x,
              z: p.z,
              rotationYDeg: p.rotationYDeg,
              footprint: footprintOf(p.packageId, pkg.footprint),
            },
          ]
        : []
    })
}

/**
 * Where on the floor you took hold of the model, relative to its own origin.
 *
 * Without this the drag plane treats the cursor as the model's centre, so the
 * first pointer move teleports the model under the cursor — you grab a sofa by
 * its arm and it jumps half a metre to meet you.
 *
 * Measured on the FIRST MOVE, not on the press. The press lands on the model's
 * own surface, which is metres above the floor for anything tall, and the same
 * pointer ray crosses the floor somewhere else entirely — an offset taken there
 * throws the target outside the room, where the polygon clamp pins it and the
 * drag dies after one jump.
 */
type GrabOffset = { instanceId: string | null; x: number; z: number }

export function PlacedPackages({ building, packages }: Props) {
  const grabOffsetRef = useRef<GrabOffset>({ instanceId: null, x: 0, z: 0 })
  const placed = useConfiguration((s) => s.placed)
  const focusedRoomKey = useConfiguratorSession((s) => s.focusedRoomKey)
  const packagesById = useMemo(() => new Map(packages.map((pkg) => [pkg.id, pkg])), [packages])
  const roomsByKey = useMemo(
    () => new Map(building.rooms.map((room) => [room.key, room])),
    [building.rooms],
  )

  return (
    <>
      <For each={placed} getKey={(p) => p.instanceId}>
        {(placement) => {
          const pkg = packagesById.get(placement.packageId)
          const room = roomsByKey.get(placement.roomKey)
          if (!pkg || !room) return null

          // Dollhouse isolation: only the focused room's furniture is shown.
          if (focusedRoomKey && placement.roomKey !== focusedRoomKey) return null

          return (
            <Suspense
              fallback={
                <PlacementGhost placement={placement} pkg={pkg} floorY={roomFloorTopY(room)} />
              }
            >
              <PlacedPackageItem
                placement={placement}
                pkg={pkg}
                room={room}
                grabOffsetRef={grabOffsetRef}
                obstacles={obstaclesFor(placed, packagesById, placement.roomKey, placement.instanceId)}
              />
            </Suspense>
          )
        }}
      </For>
      <DragPlane building={building} packages={packagesById} grabOffsetRef={grabOffsetRef} />
    </>
  )
}

type GhostProps = {
  placement: PlacedPackage
  pkg: FurniturePackageEntity
  floorY?: number
}

/**
 * Shown while a package glb is streaming in: a softly pulsing volume of the
 * package footprint, so the scene stays put and the user sees where the
 * furniture will appear.
 */
function PlacementGhost({ placement, pkg, floorY = 0 }: GhostProps) {
  const materialRef = useRef<MeshStandardMaterial>(null)

  useFrame(({ clock }) => {
    const material = materialRef.current
    if (material) material.opacity = 0.18 + (Math.sin(clock.elapsedTime * 5) + 1) * 0.05
  })

  return (
    <group
      position={[placement.x, floorY, placement.z]}
      rotation={[0, MathUtils.degToRad(placement.rotationYDeg), 0]}
    >
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[pkg.footprint.width, 0.9, pkg.footprint.depth]} />
        <meshStandardMaterial
          ref={materialRef}
          color="#94a3b8"
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

type ItemProps = {
  placement: PlacedPackage
  pkg: FurniturePackageEntity
  room: RoomZone
  grabOffsetRef: MutableRefObject<GrabOffset>
  obstacles: Obstacle[]
}

const OUTLINE_VALID = new Color('#ffdb00')
const OUTLINE_INVALID = new Color('#ef4444')

/**
 * The stored angle as the slider shows it: −180…180, zero in the middle.
 *
 * Rotation is stored 0…360 because that is what the maths wants, but a control
 * where "straight ahead" sits at one end and again at the other is a control
 * you cannot aim. Zero belongs in the middle, with a quarter turn either way.
 */
function signedDegrees(rotationYDeg: number): number {
  const wrapped = ((Math.round(rotationYDeg) % 360) + 360) % 360
  return wrapped > 180 ? wrapped - 360 : wrapped
}

/**
 * Inverted-hull silhouette: a slightly inflated clone rendered back-face only,
 * so a contour appears around the model itself (no plane underneath).
 */
function buildOutlineShell(source: Object3D): { shell: Object3D; material: MeshBasicMaterial } {
  const material = new MeshBasicMaterial({
    color: OUTLINE_VALID.clone(),
    side: BackSide,
    toneMapped: false,
  })

  const shell = source.clone(true)
  shell.traverse((object) => {
    if (object instanceof Mesh) {
      object.material = material
      object.castShadow = false
      object.receiveShadow = false
      object.raycast = () => {}
    }
  })

  return { shell, material }
}

function PlacedPackageItem({ placement, pkg, room, grabOffsetRef, obstacles }: ItemProps) {
  const { scene } = useGLTF(pkg.modelUrl, false, true)
  const groupRef = useRef<Group>(null)
  const rotationRef = useRef<Group>(null)
  const [rotateOpen, setRotateOpen] = useState(false)

  const { object, outline } = useMemo(() => {
    const clone = scene.clone(true)

    const bounds = new Box3().setFromObject(clone)
    const size = bounds.getSize(new Vector3())
    setMeasuredFootprint(pkg.id, { width: size.x, depth: size.z })

    return { object: clone, outline: buildOutlineShell(clone) }
  }, [scene, pkg.id])

  const selectedInstanceId = useConfiguration((s) => s.selectedInstanceId)
  const draggingInstanceId = useConfiguration((s) => s.draggingInstanceId)
  const selectPackage = useConfiguration((s) => s.selectPackage)
  const startDrag = useConfiguration((s) => s.startDrag)
  const rotatePackage = useConfiguration((s) => s.rotatePackage)
  const movePackage = useConfiguration((s) => s.movePackage)
  const removePackage = useConfiguration((s) => s.removePackage)
  const setInteractionLock = useConfiguratorSession((s) => s.setInteractionLock)

  const dragValid = useConfiguration((s) => s.dragValid)

  const isSelected = selectedInstanceId === placement.instanceId
  const isDragging = draggingInstanceId === placement.instanceId
  const isInvalid = isDragging && !dragValid

  // Furniture stands on the room's floor volume, not on world y=0.
  const floorY = roomFloorTopY(room)

  outline.material.color.copy(isInvalid ? OUTLINE_INVALID : OUTLINE_VALID)

  const introPlayedRef = useRef(false)

  // Smoothly damp the visual transform toward the stored pose so wall
  // snapping and slider rotation land with an animation instead of a jump.
  // A short scale-in plays when the freshly loaded model replaces its ghost.
  useFrame((_, delta) => {
    const group = groupRef.current
    const rotation = rotationRef.current
    if (!group || !rotation) return

    if (!introPlayedRef.current) {
      group.scale.setScalar(0.75)
      introPlayedRef.current = true
    }

    damp(group.scale, 'x', 1, 0.14, delta)
    damp(group.scale, 'y', 1, 0.14, delta)
    damp(group.scale, 'z', 1, 0.14, delta)
    damp(group.position, 'x', placement.x, 0.16, delta)
    damp(group.position, 'z', placement.z, 0.16, delta)
    group.position.y = floorY
    dampAngle(rotation.rotation, 'y', MathUtils.degToRad(placement.rotationYDeg), 0.32, delta)
  })

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    // Camera controls listen on the same canvas element; without this the
    // camera would orbit together with the package drag.
    event.nativeEvent.stopImmediatePropagation()
    // Cleared, not measured: the drag plane takes the offset on its own plane
    // the first time the pointer moves.
    grabOffsetRef.current = { instanceId: null, x: 0, z: 0 }
    startDrag(placement.instanceId)
    setInteractionLock(true)
    setSceneCursor('moving')

    // Releasing is the drag tracker's business now: it listens on the window
    // for as long as a drag is running, so a plain click ends as cleanly as a
    // real move and there is nothing left here to get stuck.
  }

  const footprint = footprintOf(pkg.id, pkg.footprint)

  const applyRotation = (nextDeg: number) => {
    // Detent near right angles for a crisp feel on the slider.
    const detented =
      Math.abs(nextDeg - Math.round(nextDeg / 90) * 90) <= 5
        ? (Math.round(nextDeg / 90) * 90 + 360) % 360
        : nextDeg

    const clamped = clampPoseToPolygon(
      placement.x,
      placement.z,
      detented,
      footprint,
      room.floorPolygon,
    )
    const candidate = { ...clamped, rotationYDeg: detented, footprint }

    if (collidesWithAny(candidate, obstacles)) return

    rotatePackage(placement.instanceId, detented)
    movePackage(placement.instanceId, clamped.x, clamped.z)
  }

  return (
    <group ref={groupRef} position={[placement.x, floorY, placement.z]}>
      <group ref={rotationRef} rotation={[0, MathUtils.degToRad(placement.rotationYDeg), 0]}>
        <group
          onPointerDown={handlePointerDown}
          onPointerOver={(event) => {
            event.stopPropagation()
            setSceneCursor('movable')
          }}
          onPointerOut={() => {
            if (!useConfiguration.getState().draggingInstanceId) setSceneCursor('default')
          }}
          onClick={(event) => {
            event.stopPropagation()
            selectPackage(placement.instanceId)
          }}
        >
          <primitive object={object} />
        </group>
        <Show when={isSelected}>
          <primitive object={outline.shell} scale={1.035} />
        </Show>
      </group>

      <Show when={isSelected && !isDragging}>
        <Html position={[0, 2, 0]} center zIndexRange={[20, 0]}>
          {/* The toolbar overlays the canvas — keep its pointer input away from
              camera controls and the R3F event layer. */}
          <div
            className="flex flex-col items-center gap-2"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
              event.stopPropagation()
              setInteractionLock(true)
              // The pointer may be released anywhere (slider drags leave the bar).
              window.addEventListener('pointerup', () => setInteractionLock(false), {
                once: true,
              })
            }}
          >
            <Show when={rotateOpen}>
              <div className="flex items-center gap-3 rounded-full bg-neutral-900/95 py-2 pr-4 pl-4 shadow-xl backdrop-blur">
                <div className="relative flex h-5 w-44 items-center">
                  <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-0.5">
                    {[-180, -90, 0, 90, 180].map((tick) => (
                      <span key={tick} className="h-2.5 w-0.5 rounded bg-white/40" />
                    ))}
                  </div>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={signedDegrees(placement.rotationYDeg)}
                    onChange={(event) => applyRotation(Number(event.target.value))}
                    className="rotation-slider relative w-full"
                  />
                </div>
                <span className="min-w-10 rounded bg-neutral-800 px-1.5 py-0.5 text-center text-xs font-semibold text-white tabular-nums">
                  {signedDegrees(placement.rotationYDeg)}°
                </span>
              </div>
            </Show>

            <div className="flex items-center overflow-hidden rounded-2xl bg-neutral-900/95 shadow-xl backdrop-blur">
              <button
                type="button"
                onClick={() => setRotateOpen((v) => !v)}
                className={`flex flex-col items-center gap-1 px-4 py-2.5 text-[11px] font-medium transition-colors ${
                  rotateOpen ? 'bg-neutral-700 text-white' : 'text-neutral-200 hover:bg-neutral-800'
                }`}
              >
                <RotateCw size={16} />
                Rotate
              </button>
              <span className="h-8 w-px bg-neutral-700" />
              <button
                type="button"
                onClick={() => removePackage(placement.instanceId)}
                className="flex flex-col items-center gap-1 px-4 py-2.5 text-[11px] font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
              >
                <Trash2 size={16} />
                Remove
              </button>
            </div>
          </div>
        </Html>
      </Show>
    </group>
  )
}

type DragPlaneProps = {
  building: BuildingScene
  packages: Map<number, FurniturePackageEntity>
  grabOffsetRef: MutableRefObject<GrabOffset>
}

function DragPlane({ building, packages, grabOffsetRef }: DragPlaneProps) {
  const draggingInstanceId = useConfiguration((s) => s.draggingInstanceId)
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  // The drag plane sits at the dragged package's floor level so pointer
  // rays land where the furniture actually stands. The room can't change
  // mid-drag, so this only recomputes when a drag starts.
  const dragFloorY = useMemo(() => {
    if (!draggingInstanceId) return 0
    const placement = useConfiguration
      .getState()
      .placed.find((p) => p.instanceId === draggingInstanceId)
    const room = placement ? building.rooms.find((r) => r.key === placement.roomKey) : null
    return room ? roomFloorTopY(room) : 0
  }, [draggingInstanceId, building])

  const lastValidRef = useRef<{ x: number; z: number; rotationYDeg: number } | null>(null)
  // Rotation the package had when this drag started — the progressive wall
  // blend always interpolates from it, so alignment is reversible.
  const freeRotationRef = useRef<{ instanceId: string; rotationYDeg: number } | null>(null)

  const endDrag = () => {
    const state = useConfiguration.getState()
    const dragging = state.draggingInstanceId

    if (dragging && !state.dragValid && lastValidRef.current) {
      const pose = lastValidRef.current
      state.movePackage(dragging, pose.x, pose.z)
      state.rotatePackage(dragging, pose.rotationYDeg)
    }

    lastValidRef.current = null
    freeRotationRef.current = null
    state.endDrag()
    useConfiguratorSession.getState().setInteractionLock(false)
    setSceneCursor('default')
  }

  const moveTo = (pointX: number, pointZ: number) => {
    const state = useConfiguration.getState()
    const dragging = state.draggingInstanceId
    if (!dragging) return

    const placement = state.placed.find((p) => p.instanceId === dragging)
    const pkg = placement ? packages.get(placement.packageId) : null
    const room = placement ? building.rooms.find((r) => r.key === placement.roomKey) : null
    if (!placement || !pkg || !room) return

    if (freeRotationRef.current?.instanceId !== dragging) {
      freeRotationRef.current = { instanceId: dragging, rotationYDeg: placement.rotationYDeg }
    }

    const footprint = footprintOf(pkg.id, pkg.footprint)

    // First move of this drag: whatever is under the cursor right now IS the
    // grab point, so the model does not shift at all until the pointer does.
    if (grabOffsetRef.current.instanceId !== dragging) {
      grabOffsetRef.current = {
        instanceId: dragging,
        x: placement.x - pointX,
        z: placement.z - pointZ,
      }
    }

    const snapped = progressiveEdgeSnap(
      pointX + grabOffsetRef.current.x,
      pointZ + grabOffsetRef.current.z,
      freeRotationRef.current.rotationYDeg,
      footprint,
      room.floorPolygon,
    )

    const obstacles = obstaclesFor(
      state.placed,
      packages,
      placement.roomKey,
      placement.instanceId,
    )

    const valid = !collidesWithAny(
      { x: snapped.x, z: snapped.z, rotationYDeg: snapped.rotationYDeg, footprint },
      obstacles,
    )

    if (valid) {
      lastValidRef.current = { x: snapped.x, z: snapped.z, rotationYDeg: snapped.rotationYDeg }
    }

    state.movePackage(dragging, snapped.x, snapped.z)
    if (snapped.rotationYDeg !== placement.rotationYDeg) {
      state.rotatePackage(dragging, snapped.rotationYDeg)
    }
    state.setDragValid(valid)
  }

  // The window listeners below are attached once per drag, so they need a
  // stable way to reach this render's closures rather than the first one's.
  const moveToRef = useRef(moveTo)
  const endDragRef = useRef(endDrag)
  useEffect(() => {
    moveToRef.current = moveTo
    endDragRef.current = endDrag
  })

  useEffect(() => {
    if (!draggingInstanceId) return

    // A mathematical plane and window listeners, NOT an invisible mesh with
    // R3F pointer events. A mesh has to win the raycast to hear anything, so
    // the moment a wall or another package came between the cursor and it, the
    // move stopped — and its `pointerleave` ended the drag outright, which is
    // why you had to press again to carry on.
    const plane = new Plane(new Vector3(0, 1, 0), -dragFloorY)
    const hit = new Vector3()
    const ndc = new Vector2()
    const raycaster = new Raycaster()

    const onMove = (event: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect()
      ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(ndc, camera)
      // Misses only when the camera looks along the floor — then there is no
      // sensible answer, so leave the package where it is.
      if (raycaster.ray.intersectPlane(plane, hit)) moveToRef.current(hit.x, hit.z)
    }
    const onUp = () => endDragRef.current()

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [draggingInstanceId, dragFloorY, camera, gl])

  return null
}
