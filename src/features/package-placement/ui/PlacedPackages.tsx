'use client'

import { Html, useGLTF } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ChevronUp, RotateCw, Trash2 } from 'lucide-react'
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
  type Camera,
  type Group,
  type Object3D,
} from 'three'

import type { BuildingScene, Room } from '@/entities/building'
import {
  clampPoseToRegion,
  progressiveEdgeSnapRegion,
  reachableFloor,
  roomFloorTopY,
  roomsOnFloor,
} from '@/entities/building'
import { useConfiguration, type PlacedPackage } from '@/entities/configuration'
import { useConfiguratorSession } from '@/entities/configurator-session'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
import { cn } from '@/shared/lib'
import { HIGHLIGHT } from '@/shared/three/scene-tokens'
import { FloatingBar, Pill } from '@/shared/ui/boxx'
import { For, Show } from '@/shared/ui/control-flow'
import { setSceneCursor } from '@/shared/ui/scene-cursor'

import { collidesWithAny } from '../lib/placement-geometry'
import { footprintOf, setMeasuredFootprint } from '../lib/measured-footprints'

const ROTATION_TICKS = [-180, -90, 0, 90, 180] as const

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

/**
 * Obstacles grouped by room, built once per list render.
 *
 * Asking each item to scan the whole placement array for its neighbours made
 * the list quadratic in furniture, on every session change.
 */
function obstaclesByRoom(
  placed: PlacedPackage[],
  packagesById: Map<number, FurniturePackageEntity>,
): Map<string, Array<Obstacle & { instanceId: string }>> {
  const rooms = new Map<string, Array<Obstacle & { instanceId: string }>>()

  for (const p of placed) {
    const pkg = packagesById.get(p.packageId)
    if (!pkg) continue
    const room = rooms.get(p.roomKey) ?? []
    room.push({
      instanceId: p.instanceId,
      x: p.x,
      z: p.z,
      rotationYDeg: p.rotationYDeg,
      footprint: footprintOf(p.packageId, pkg.footprint),
    })
    rooms.set(p.roomKey, room)
  }

  return rooms
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
  const selectedFloorKey = useConfiguratorSession((s) => s.selectedFloorKey)
  const packagesById = useMemo(() => new Map(packages.map((pkg) => [pkg.id, pkg])), [packages])
  const roomsByKey = useMemo(
    () => new Map(building.rooms.map((room) => [room.key, room])),
    [building.rooms],
  )
  // Furniture on a storey that has been cut away would otherwise hang in the air.
  const roomsOnView = useMemo(
    () => new Set(roomsOnFloor(building.rooms, building.floors, selectedFloorKey).map((r) => r.key)),
    [building.rooms, building.floors, selectedFloorKey],
  )
  const neighbours = useMemo(
    () => obstaclesByRoom(placed, packagesById),
    [placed, packagesById],
  )

  return (
    <>
      <For each={placed} getKey={(p) => p.instanceId}>
        {(placement) => {
          const pkg = packagesById.get(placement.packageId)
          const room = roomsByKey.get(placement.roomKey)
          if (!pkg || !room) return null

          if (focusedRoomKey && placement.roomKey !== focusedRoomKey) return null
          if (!focusedRoomKey && !roomsOnView.has(placement.roomKey)) return null

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
                obstacles={(neighbours.get(placement.roomKey) ?? []).filter(
                  (other) => other.instanceId !== placement.instanceId,
                )}
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
          color={HIGHLIGHT.ghost}
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
  room: Room
  grabOffsetRef: MutableRefObject<GrabOffset>
  obstacles: Obstacle[]
}

const OUTLINE_VALID = new Color(HIGHLIGHT.selected)
const OUTLINE_INVALID = new Color(HIGHLIGHT.blocked)

const TOOLBAR_MARGIN_X = 130
/**
 * Asymmetric, because the toolbar hangs off the bottom of its anchor point: it
 * grows upward, and the slider grows above it again, so all of that has to fit
 * over the anchor while almost nothing needs to fit under it.
 */
/**
 * Clears the header column, not just the header bar. When the selected item is
 * off-frame the toolbar parks at this margin — top-left — which is exactly where
 * the room's facts panel sits, and the header paints over the canvas.
 */
const TOOLBAR_MARGIN_TOP = 220
const TOOLBAR_MARGIN_BOTTOM = 16

const ANCHOR = new Vector3()
const CAMERA_POS = new Vector3()
const CAMERA_DIR = new Vector3()
const TO_ANCHOR = new Vector3()

/**
 * drei pins <Html> to a projected world point, so zooming in walks the toolbar
 * off the edge and out of reach. Same projection, then clamped into the
 * viewport so it slides along the border instead of leaving.
 */
function keepOnScreen(
  el: Object3D,
  camera: Camera,
  size: { width: number; height: number },
): number[] {
  const anchor = ANCHOR.setFromMatrixPosition(el.matrixWorld)
  const cameraPos = CAMERA_POS.setFromMatrixPosition(camera.matrixWorld)

  // Behind the near plane, project() mirrors the point through the origin,
  // which would pin the bar to the opposite edge from the item it belongs to.
  const inFront =
    TO_ANCHOR.subVectors(anchor, cameraPos).dot(camera.getWorldDirection(CAMERA_DIR)) > 0

  const projected = anchor.project(camera)
  const ndcX = inFront ? projected.x : -projected.x
  const ndcY = inFront ? projected.y : -projected.y

  const marginX = Math.min(TOOLBAR_MARGIN_X, size.width / 2)
  const marginTop = Math.min(TOOLBAR_MARGIN_TOP, size.height / 2)
  const marginBottom = Math.min(TOOLBAR_MARGIN_BOTTOM, size.height / 2)

  return [
    MathUtils.clamp(ndcX * (size.width / 2) + size.width / 2, marginX, size.width - marginX),
    MathUtils.clamp(
      -(ndcY * (size.height / 2)) + size.height / 2,
      marginTop,
      size.height - marginBottom,
    ),
  ]
}

/** Stored 0…360 rotation expressed as −180…180. */
function signedDegrees(rotationYDeg: number): number {
  const wrapped = ((Math.round(rotationYDeg) % 360) + 360) % 360
  return wrapped > 180 ? wrapped - 360 : wrapped
}

/**
 * Two inverted hulls at different scales, the outer one fainter, so the edge
 * fades outwards instead of ending as a hard stroke. Same colour in both, so
 * they composite order-independently and cannot flicker against each other.
 *
 * The whole clone is scaled by a parent group rather than each mesh being
 * inflated in place. Growing meshes individually was tried and is wrong: a
 * geometry-space scale moves any part whose own centre is offset, so thin legs
 * and panels came out as displaced copies floating beside the model.
 */
const OUTLINE_LAYERS = [
  { scale: 1.008, opacity: 0.8 },
  { scale: 1.022, opacity: 0.32 },
]

/** Clipped this far above the floor, so the hull never meets it and z-fights. */
const OUTLINE_FLOOR_LIFT = 0.006

type Outline = {
  layers: Array<{ shell: Object3D; material: MeshBasicMaterial; scale: number }>
  dispose: () => void
}

function buildOutline(source: Object3D, floorY: number): Outline {
  const clip = new Plane(new Vector3(0, 1, 0), -(floorY + OUTLINE_FLOOR_LIFT))

  const layers = OUTLINE_LAYERS.map(({ scale, opacity }) => {
    const material = new MeshBasicMaterial({
      color: OUTLINE_VALID.clone(),
      side: BackSide,
      toneMapped: false,
      transparent: true,
      opacity,
      depthWrite: false,
      clippingPlanes: [clip],
    })

    const shell = source.clone(true)
    shell.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.material = material
      object.castShadow = false
      object.receiveShadow = false
      object.raycast = () => {}
    })

    return { shell, material, scale }
  })

  return {
    layers,
    dispose: () => {
      for (const { material } of layers) material.dispose()
    },
  }
}

function PlacedPackageItem({ placement, pkg, room, grabOffsetRef, obstacles }: ItemProps) {
  const { scene } = useGLTF(pkg.modelUrl, false, true)
  const groupRef = useRef<Group>(null)
  const rotationRef = useRef<Group>(null)
  const [rotateOpen, setRotateOpen] = useState(false)

  const floorY = roomFloorTopY(room)

  const { object, height } = useMemo(() => {
    const clone = scene.clone(true)

    const bounds = new Box3().setFromObject(clone)
    const size = bounds.getSize(new Vector3())
    const centre = bounds.getCenter(new Vector3())

    // Clamping and collision assume a footprint centred on the placement point.
    // Y is left alone: the model stands on the floor, so its base sits there.
    clone.position.x -= centre.x
    clone.position.z -= centre.z

    setMeasuredFootprint(pkg.id, { width: size.x, depth: size.z })

    return { object: clone, height: size.y }
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

  // Two more deep clones of the model, and it is only ever drawn around the
  // item under the pointer — building one per placement meant leaving a room
  // paid for the whole storey's worth at once.
  const outline = useMemo(
    () => (isSelected || isDragging ? buildOutline(object, floorY) : null),
    [isSelected, isDragging, object, floorY],
  )

  useEffect(() => () => outline?.dispose(), [outline])

  const tint = isInvalid ? OUTLINE_INVALID : OUTLINE_VALID

  // In an effect, not the render body: mutating three objects while rendering
  // is a hazard under a concurrent renderer.
  useEffect(() => {
    if (!outline) return
    for (const layer of outline.layers) layer.material.color.copy(tint)
  }, [outline, tint])

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

  /** Where a turn would land, or null when there is something in the way. */
  const resolveRotation = (nextDeg: number) => {
    const detented =
      Math.abs(nextDeg - Math.round(nextDeg / 90) * 90) <= 5
        ? (Math.round(nextDeg / 90) * 90 + 360) % 360
        : nextDeg

    const clamped = clampPoseToRegion(
      placement.x,
      placement.z,
      detented,
      footprint,
      reachableFloor(room, pkg.compatibleRoomTypes, placement.x, placement.z),
    )

    return collidesWithAny({ ...clamped, rotationYDeg: detented, footprint }, obstacles)
      ? null
      : { ...clamped, rotationYDeg: detented }
  }

  const applyRotation = (nextDeg: number) => {
    const pose = resolveRotation(nextDeg)
    if (!pose) return

    rotatePackage(placement.instanceId, pose.rotationYDeg)
    movePackage(placement.instanceId, pose.x, pose.z)
  }

  // Asked before the button is drawn rather than after it is pressed: a quarter
  // turn is far more likely to be blocked than the slider's one degree was, and
  // a control that silently does nothing is worse than one that says it cannot.
  const nextQuarter = signedDegrees(placement.rotationYDeg) + 90
  const canTurn = isSelected && !isDragging && resolveRotation(nextQuarter) !== null

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
        <Show when={isSelected && outline ? outline : null}>
          {(shells) => (
          <For each={shells.layers} getKey={(_, index) => index}>
            {(layer) => (
              // Scaled by a group: the shell carries the recentring offset in
              // its own transform, which scaling it directly would multiply too.
              <group scale={layer.scale}>
                <primitive object={layer.shell} />
              </group>
            )}
          </For>
          )}
        </Show>
      </group>

      <Show when={isSelected && !isDragging}>
        <Html
          position={[0, height + 0.25, 0]}
          zIndexRange={[20, 0]}
          calculatePosition={keepOnScreen}
          // drei's own wrapper sits *at* the anchor and takes the size of what
          // is inside it, while the bar below is shifted off that anchor by
          // half its width and all of its height. The wrapper is therefore an
          // invisible box hanging down and to the right of the toolbar, over
          // bare canvas — and it swallowed every orbit drag that began there.
          // The bar takes its events back on the line below.
          style={{ pointerEvents: 'none' }}
        >
          {/* Anchored by its bottom edge, not its middle. Centred, half the bar
              hung down over the top of the furniture it was there to change,
              which meant clicking away to see what a change had done. drei puts
              `center` on a wrapper it owns, so the shift has to be done here. */}
          <div
            className="pointer-events-auto flex -translate-x-1/2 -translate-y-full flex-col items-center gap-2"
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
              <FloatingBar tone="ink" className="gap-2 px-3 desktop:gap-3 desktop:px-4">
                <div className="relative flex h-5 w-32 items-center desktop:w-44">
                  <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-0.5">
                    <For each={ROTATION_TICKS} getKey={(tick) => tick}>
                      {() => <span className="h-2.5 w-0.5 rounded-full bg-surface/40" />}
                    </For>
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
                <span className="min-w-10 rounded-sm bg-surface/15 px-1.5 py-0.5 text-center text-xs font-medium text-surface tabular-nums">
                  {signedDegrees(placement.rotationYDeg)}°
                </span>
              </FloatingBar>
            </Show>

            <FloatingBar tone="ink">
              {/* The button turns; the chevron beside it opens the slider. It
                  used to be one control that only ever opened the slider, so
                  the obvious thing to click did nothing on its own. */}
              <Pill
                size="sm"
                variant="ghost-inverted"
                labelFrom="desktop"
                disabled={!canTurn}
                title={canTurn ? 'Turn a quarter' : 'No room to turn it here'}
                leadingIcon={<RotateCw size={16} />}
                onClick={() => applyRotation(nextQuarter)}
              >
                Rotate
              </Pill>
              <Pill
                size="sm"
                variant="ghost-inverted"
                selected={rotateOpen}
                aria-expanded={rotateOpen}
                aria-label="Set the angle by hand"
                title="Set the angle by hand"
                leadingIcon={
                  <ChevronUp
                    size={16}
                    className={cn('transition-transform', rotateOpen && 'rotate-180')}
                  />
                }
                onClick={() => setRotateOpen((v) => !v)}
              />
              <FloatingBar.Divider />
              <Pill
                size="sm"
                variant="ghost-inverted"
                labelFrom="desktop"
                leadingIcon={<Trash2 size={16} />}
                onClick={() => removePackage(placement.instanceId)}
              >
                Remove
              </Pill>
            </FloatingBar>
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

    // Worked out from where the thing already stands, every move: the zones it
    // may cross into depend on which one it is in, and a drag that reaches a
    // friendly zone through an unfriendly one has to be stopped at the line
    // rather than allowed to land on the far side of it.
    const snapped = progressiveEdgeSnapRegion(
      pointX + grabOffsetRef.current.x,
      pointZ + grabOffsetRef.current.z,
      freeRotationRef.current.rotationYDeg,
      footprint,
      reachableFloor(room, pkg.compatibleRoomTypes, placement.x, placement.z),
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
