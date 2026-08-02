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

// Grab point on the floor relative to the model origin. Measured on the first
// move, not the press: the press ray hits the model's surface, not the floor.
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

/** Stored 0…360 rotation expressed as −180…180. */
function signedDegrees(rotationYDeg: number): number {
  const wrapped = ((Math.round(rotationYDeg) % 360) + 360) % 360
  return wrapped > 180 ? wrapped - 360 : wrapped
}

/** Inverted-hull silhouette: a clone rendered back-face only, to be scaled up by the caller. */
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
    const centre = bounds.getCenter(new Vector3())

    // Clamping and collision assume a footprint centred on the placement point.
    // Y is left alone: the model stands on the floor, so its base sits there.
    clone.position.x -= centre.x
    clone.position.z -= centre.z

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

  const floorY = roomFloorTopY(room)

  outline.material.color.copy(isInvalid ? OUTLINE_INVALID : OUTLINE_VALID)

  const introPlayedRef = useRef(false)

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
    // Camera controls listen on the same canvas element and would orbit too.
    event.nativeEvent.stopImmediatePropagation()
    grabOffsetRef.current = { instanceId: null, x: 0, z: 0 }
    startDrag(placement.instanceId)
    setInteractionLock(true)
    setSceneCursor('moving')
  }

  const footprint = footprintOf(pkg.id, pkg.footprint)

  const applyRotation = (nextDeg: number) => {
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
          {/* Scaled by a group: the shell carries the recentring offset in its
              own transform, which scaling it directly would multiply too. */}
          <group scale={1.035}>
            <primitive object={outline.shell} />
          </group>
        </Show>
      </group>

      <Show when={isSelected && !isDragging}>
        <Html position={[0, 2, 0]} center zIndexRange={[20, 0]}>
          <div
            className="flex flex-col items-center gap-2"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
              event.stopPropagation()
              setInteractionLock(true)
              // Slider drags leave the bar, so the release lands anywhere.
              window.addEventListener('pointerup', () => setInteractionLock(false), {
                once: true,
              })
            }}
          >
            <Show when={rotateOpen}>
              <div className="flex items-center gap-2 rounded-full bg-neutral-900/95 px-3 py-1.5 shadow-xl backdrop-blur desktop:gap-3 desktop:px-4 desktop:py-2">
                <div className="relative flex h-5 w-32 items-center desktop:w-44">
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

            <div className="flex items-center overflow-hidden rounded-full bg-neutral-900/95 shadow-xl backdrop-blur desktop:rounded-2xl">
              <button
                type="button"
                aria-label="Rotate"
                onClick={() => setRotateOpen((v) => !v)}
                className={`flex size-10 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors desktop:size-auto desktop:px-4 desktop:py-2.5 ${
                  rotateOpen ? 'bg-neutral-700 text-white' : 'text-neutral-200 hover:bg-neutral-800'
                }`}
              >
                <RotateCw size={16} />
                <span className="hidden desktop:inline">Rotate</span>
              </button>
              <span className="h-6 w-px bg-neutral-700 desktop:h-8" />
              <button
                type="button"
                aria-label="Remove"
                onClick={() => removePackage(placement.instanceId)}
                className="flex size-10 flex-col items-center justify-center gap-1 text-[11px] font-medium text-neutral-200 transition-colors hover:bg-neutral-800 desktop:size-auto desktop:px-4 desktop:py-2.5"
              >
                <Trash2 size={16} />
                <span className="hidden desktop:inline">Remove</span>
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

  const dragFloorY = useMemo(() => {
    if (!draggingInstanceId) return 0
    const placement = useConfiguration
      .getState()
      .placed.find((p) => p.instanceId === draggingInstanceId)
    const room = placement ? building.rooms.find((r) => r.key === placement.roomKey) : null
    return room ? roomFloorTopY(room) : 0
  }, [draggingInstanceId, building])

  const lastValidRef = useRef<{ x: number; z: number; rotationYDeg: number } | null>(null)
  // Rotation at drag start; the progressive snap always blends from it.
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

  // Listeners attach once per drag; the refs keep them on the latest closures.
  const moveToRef = useRef(moveTo)
  const endDragRef = useRef(endDrag)
  useEffect(() => {
    moveToRef.current = moveTo
    endDragRef.current = endDrag
  })

  useEffect(() => {
    if (!draggingInstanceId) return

    // A maths plane, not a mesh: a mesh would need to win the raycast, so a
    // wall between cursor and floor would stall the drag.
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
