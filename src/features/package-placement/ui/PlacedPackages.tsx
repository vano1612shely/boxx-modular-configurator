'use client'
import { Html } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ChevronUp, RotateCw, Trash2 } from 'lucide-react'
import { damp, dampAngle } from 'maath/easing'
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import {
  BackSide,
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

import type { BuildingScene, Room, RoomPart } from '@/entities/building'
import {
  clampPoseToRegion,
  fittedSetOf,
  partGeometryKey,
  poseInsideRegion,
  progressiveEdgeSnapRegion,
  reachableFloor,
  type Region,
  RoomParts,
  roomFloorTopY,
  roomsOnFloor,
} from '@/entities/building'
import { useConfiguration, type PlacedPackage } from '@/entities/configuration'
import { useConfiguratorSession } from '@/entities/configurator-session'
import {
  footprintOf,
  shapeOf,
  useCentredPackage,
  type FurniturePackageEntity,
  type PackageShape,
} from '@/entities/furniture-package'
import { cn } from '@/shared/lib'
import { HIGHLIGHT } from '@/shared/three/scene-tokens'
import { FloatingBar, Pill } from '@/shared/ui/boxx'
import { For, Show } from '@/shared/ui/control-flow'
import { setSceneCursor } from '@/shared/ui/scene-cursor'

import { framePose } from '../lib/drag-pose'
import { partObstacleOf, partObstaclesVersion } from '../lib/part-obstacles'
import { collidesWithAny } from '../lib/placement-geometry'
import { PartMeasurements } from './PartMeasurements'
import { nearestFittingAngle, nextFittingQuarter } from '../lib/rotation-fit'
import { FLOOR_INSETS, toolbarPositioner } from '../lib/toolbar-position'
import { measureInsets, readChrome, type Insets } from '../lib/scene-insets'

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
  /** What the model really fills, once measured. Null until its glb arrives. */
  shape: PackageShape | null
}

/**
 * What a list of fittings fills, for the ones that have been measured.
 *
 * An unmeasured fitting is left out rather than guessed at. It stops nothing
 * for the handful of frames before its model lands, which is the failure that
 * lets a visitor put a chair somewhere odd — the other one refuses poses that
 * are perfectly legal, which is the failure they report as a bug.
 */
function fittingObstacles(
  parts: ReadonlyArray<RoomPart>,
  buildingModelUrl: string,
): Obstacle[] {
  return parts.flatMap((part) => {
    const measured = partObstacleOf(partGeometryKey(part, buildingModelUrl))
    return measured ? [measured] : []
  })
}

/**
 * What one placement fills: a package, or the whole arrangement it stands for.
 *
 * A fitted placement is one row in the configuration and a dozen things on the
 * floor, and a chair has to be stopped by each of them rather than by a
 * rectangle around the lot — the gap between the fridge and the counter is
 * exactly where somebody will try to put a bin.
 */
function placementObstacles(
  placement: PlacedPackage,
  packagesById: Map<number, FurniturePackageEntity>,
  room: Room | undefined,
  buildingModelUrl: string,
): Obstacle[] {
  const set = room ? fittedSetOf(room, placement.packageId) : null
  if (set) return fittingObstacles(set.parts, buildingModelUrl)

  const pkg = packagesById.get(placement.packageId)
  if (!pkg) return []

  return [
    {
      x: placement.x,
      z: placement.z,
      rotationYDeg: placement.rotationYDeg,
      footprint: footprintOf(placement.packageId, pkg.footprint),
      shape: shapeOf(placement.packageId),
    },
  ]
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
  roomsByKey: Map<string, Room>,
  buildingModelUrl: string,
): Map<string, Array<Obstacle & { instanceId: string }>> {
  const rooms = new Map<string, Array<Obstacle & { instanceId: string }>>()

  for (const p of placed) {
    const found = placementObstacles(p, packagesById, roomsByKey.get(p.roomKey), buildingModelUrl)
    if (found.length === 0) continue
    const room = rooms.get(p.roomKey) ?? []
    for (const obstacle of found) room.push({ ...obstacle, instanceId: p.instanceId })
    rooms.set(p.roomKey, room)
  }

  // The counter a room came with stops a chair exactly as a bought fridge does.
  // Under an id no placement can have, so nothing excludes itself from it.
  for (const [roomKey, list] of rooms) {
    for (const fixture of fittingObstacles(
      roomsByKey.get(roomKey)?.builtIns ?? [],
      buildingModelUrl,
    )) {
      list.push({ ...fixture, instanceId: `built-in:${roomKey}` })
    }
  }

  return rooms
}

function obstaclesFor(
  placed: PlacedPackage[],
  packagesById: Map<number, FurniturePackageEntity>,
  roomsByKey: Map<string, Room>,
  buildingModelUrl: string,
  roomKey: string,
  excludeInstanceId: string,
): Obstacle[] {
  return [
    ...placed
      .filter((p) => p.instanceId !== excludeInstanceId && p.roomKey === roomKey)
      .flatMap((p) =>
        placementObstacles(p, packagesById, roomsByKey.get(roomKey), buildingModelUrl),
      ),
    ...fittingObstacles(roomsByKey.get(roomKey)?.builtIns ?? [], buildingModelUrl),
  ]
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
    () =>
      new Set(roomsOnFloor(building.rooms, building.floors, selectedFloorKey).map((r) => r.key)),
    [building.rooms, building.floors, selectedFloorKey],
  )
  const neighbours = useMemo(
    () => obstaclesByRoom(placed, packagesById, roomsByKey, building.modelUrl),
    [placed, packagesById, roomsByKey, building.modelUrl],
  )

  /**
   * Everything standing still in the room the visitor is in.
   *
   * Measured, not drawn — the room draws its own built-ins and the list above
   * draws the arrangement. Only the focused room: measuring every fitting in
   * the building would read a dozen models nobody is anywhere near.
   */
  const fittingsHere = useMemo(() => {
    const room = focusedRoomKey ? roomsByKey.get(focusedRoomKey) : null
    if (!room) return []
    return [...room.builtIns, ...room.fittedSets.flatMap((set) => set.parts)]
  }, [focusedRoomKey, roomsByKey])

  return (
    <>
      <PartMeasurements parts={fittingsHere} buildingModelUrl={building.modelUrl} />
      <For each={placed} getKey={(p) => p.instanceId}>
        {(placement) => {
          const pkg = packagesById.get(placement.packageId)
          const room = roomsByKey.get(placement.roomKey)
          if (!pkg || !room) return null

          if (focusedRoomKey && placement.roomKey !== focusedRoomKey) return null
          if (!focusedRoomKey && !roomsOnView.has(placement.roomKey)) return null

          // An arrangement the building holds rather than a package carried in.
          // Recognised from the room, not from a flag on the placement, so a
          // saved order reopened months later draws it from the same answer.
          const set = fittedSetOf(room, placement.packageId)
          if (set) {
            return (
              <RoomParts
                parts={set.parts}
                buildingModelUrl={building.modelUrl}
                floorY={roomFloorTopY(room)}
              />
            )
          }

          const modelUrl = pkg.modelUrl
          if (!modelUrl) return null

          return (
            <Suspense
              fallback={
                <PlacementGhost placement={placement} pkg={pkg} floorY={roomFloorTopY(room)} />
              }
            >
              <PlacedPackageItem
                placement={placement}
                pkg={{ ...pkg, modelUrl }}
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
  /** Narrowed: a package with no model of its own is drawn from the room instead. */
  pkg: FurniturePackageEntity & { modelUrl: string }
  room: Room
  grabOffsetRef: MutableRefObject<GrabOffset>
  obstacles: Obstacle[]
}

const OUTLINE_VALID = new Color(HIGHLIGHT.selected)
const OUTLINE_INVALID = new Color(HIGHLIGHT.blocked)

/**
 * How long the frame loop takes to catch up, as maath smoothTime in seconds.
 *
 * Critically damped, so a piece is within a whisker of its target after roughly
 * twice these figures: about 140 ms of travel and 240 ms of turn.
 *
 * `FOLLOW` is the one that decides whether dragging feels like moving a thing
 * or like sending it instructions. It has to be short enough that the piece
 * reads as being under the finger, and long enough to absorb the gaps between
 * pointer events — the whole reason the pose is eased rather than assigned.
 *
 * `TURN` is longer because a quarter turn is a jump the eye needs help
 * following; a piece that arrived at the new angle instantly would look like a
 * different piece.
 */
const FOLLOW = 0.07
const TURN = 0.12
/** The little swell as a piece arrives. Its own thing, not a response to input. */
const POP_IN = 0.14

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
  const { object, height } = useCentredPackage(pkg)
  const groupRef = useRef<Group>(null)
  const rotationRef = useRef<Group>(null)
  const [rotateOpen, setRotateOpen] = useState(false)
  /** Whether the bar hangs under the piece rather than sitting over it. */
  const [barBelow, setBarBelow] = useState(false)
  const domElement = useThree((state) => state.gl.domElement)
  const viewport = useThree((state) => state.size)

  const floorY = roomFloorTopY(room)

  const selectedInstanceId = useConfiguration((s) => s.selectedInstanceId)
  const draggingInstanceId = useConfiguration((s) => s.draggingInstanceId)
  const selectPackage = useConfiguration((s) => s.selectPackage)
  const startDrag = useConfiguration((s) => s.startDrag)
  const rotatePackage = useConfiguration((s) => s.rotatePackage)
  const movePackage = useConfiguration((s) => s.movePackage)
  const removePackage = useConfiguration((s) => s.removePackage)
  const setInteractionLock = useConfiguratorSession((s) => s.setInteractionLock)
  const panelCollapsed = useConfiguratorSession((s) => s.panelCollapsed)

  // Asked about this piece rather than read wholesale: validity is a statement
  // about whichever piece is in the air, and subscribing to the flag itself made
  // every other piece in the room re-render each time that piece crossed a wall.
  const isInvalid = useConfiguration(
    (s) => s.draggingInstanceId === placement.instanceId && !s.dragValid,
  )

  const isSelected = selectedInstanceId === placement.instanceId
  const isDragging = draggingInstanceId === placement.instanceId

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

  /**
   * The frame loop owns where this piece sits and which way it faces, and React
   * must not also write them.
   *
   * `position` and `rotation` props are re-applied on every render, and a drag
   * renders on every pointer move — so the piece was being snapped to the raw
   * pointer while the damping below was left with nothing to smooth. Some frames
   * got a snap and some got an eased step, which is what a stuttering drag is
   * made of. The turn had it worse: the progressive edge snap nudges the angle
   * continuously, so it was being jumped every move too.
   *
   * Seeded once on the way in; after that the loop eases to whatever the store
   * says, which is the whole reason the damping is there.
   */
  useLayoutEffect(() => {
    groupRef.current?.position.set(placement.x, floorY, placement.z)
    rotationRef.current?.rotation.set(0, MathUtils.degToRad(placement.rotationYDeg), 0)
    // Mount only. Later changes are the frame loop's business, and listing them
    // here would put the snap straight back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_, delta) => {
    const group = groupRef.current
    const rotation = rotationRef.current
    if (!group || !rotation) return

    if (!introPlayedRef.current) {
      group.scale.setScalar(0.75)
      introPlayedRef.current = true
    }

    damp(group.scale, 'x', 1, POP_IN, delta)
    damp(group.scale, 'y', 1, POP_IN, delta)
    damp(group.scale, 'z', 1, POP_IN, delta)

    // The live pose is read from the store rather than taken off a prop: it is
    // rewritten on every pointer move, and putting it through React would
    // re-render the panel, the quote and the bar for a change nothing outside
    // this mesh can see. Null means leave the piece where it stands — see
    // `framePose` for the two frames of a drag where that is the right answer.
    const pose = framePose(placement, isDragging, useConfiguration.getState().dragPose)
    if (!pose) return

    // Under the finger it goes exactly where the finger is. The easing is for
    // moves the visitor did not make by hand — a turn nudging a piece off a
    // wall, a blocked drag being put back — where a jump would read as a glitch.
    // Applied to a drag it only added lag to a position that was already right.
    if (pose.snap) {
      group.position.x = pose.x
      group.position.z = pose.z
    } else {
      damp(group.position, 'x', pose.x, FOLLOW, delta)
      damp(group.position, 'z', pose.z, FOLLOW, delta)
    }
    group.position.y = floorY
    dampAngle(rotation.rotation, 'y', MathUtils.degToRad(pose.rotationYDeg), TURN, delta)
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
  // Measured by this very component's own model load, so by the time anything
  // here can be turned it is there.
  const shape = shapeOf(pkg.id)

  // Where the panels drawn over the scene leave room, read when the bar appears
  // and when the frame changes shape — never per frame, since each read is a
  // forced layout and the panels do not move in between.
  //
  // Held in a box the positioner reads live, rather than in state: nothing in
  // the markup depends on it, so there is nothing to re-render for, and
  // rebuilding the positioner would throw away the deadband it carries.
  const insets = useMemo<Insets>(() => ({ ...FLOOR_INSETS }), [])
  useEffect(() => {
    if (!isSelected) return

    const read = () => {
      const { size, panels } = readChrome(domElement)
      Object.assign(insets, measureInsets(size, panels, FLOOR_INSETS))
    }

    read()
    // Shrinking the sidebar to its rail hands back a third of the screen, and
    // the width it hands it back over is animated: read again once it has
    // settled, or the bar goes on avoiding a panel that is no longer there.
    const settled = setTimeout(read, 350)
    return () => clearTimeout(settled)
  }, [isSelected, domElement, viewport, insets, panelCollapsed])

  // Memoised on the measurements rather than on the footprint object, which is
  // rebuilt every render: the positioner carries the side it last reported and
  // the deadband it flips on, and a fresh one each render has neither.
  const positionToolbar = useMemo(
    () =>
      toolbarPositioner(
        { width: footprint.width, depth: footprint.depth },
        height,
        insets,
        setBarBelow,
      ),
    [footprint.width, footprint.depth, height, insets],
  )

  // Asked once per pose rather than once per render: the turn button re-reads
  // it on every commit, and working out the reachable floor classifies every
  // zone edge in the room.
  const turnFloor = useMemo(
    () => reachableFloor(room, pkg.compatibleRoomTypes, placement.x, placement.z),
    [room, pkg.compatibleRoomTypes, placement.x, placement.z],
  )

  /** Where a turn would land, or null when there is something in the way. */
  const resolveRotation = (nextDeg: number) => {
    const detented =
      Math.abs(nextDeg - Math.round(nextDeg / 90) * 90) <= 5
        ? (Math.round(nextDeg / 90) * 90 + 360) % 360
        : nextDeg

    const clamped = clampPoseToRegion(placement.x, placement.z, detented, footprint, turnFloor)

    // Clamping is a best effort, not a promise. It walks the piece towards the
    // room for ten passes and hands back wherever it got to — for a six-metre
    // package turned across a two-and-a-half-metre room, that is still through
    // the wall. Asking whether it actually landed inside is what this was
    // missing: the only other question was whether it hit other furniture, and
    // in an otherwise empty room the answer was no, so a turn that plainly did
    // not fit was allowed and the table ended up outside the building.
    if (!poseInsideRegion(clamped.x, clamped.z, detented, footprint, turnFloor)) return null

    return collidesWithAny({ ...clamped, rotationYDeg: detented, footprint, shape }, obstacles)
      ? null
      : { ...clamped, rotationYDeg: detented }
  }

  const applyRotation = (nextDeg: number) => {
    const pose = resolveRotation(nextDeg)
    if (!pose) return

    rotatePackage(placement.instanceId, pose.rotationYDeg)
    movePackage(placement.instanceId, pose.x, pose.z)
  }

  const fitsAt = (deg: number) => resolveRotation(deg) !== null

  /**
   * Turns the piece by the hand rather than by the rules.
   *
   * The slider is allowed through positions the piece does not fit in — a long
   * desk in a narrow room passes through every one of them on its way from one
   * end to the other, and a slider that stopped dead at the first would be a
   * slider with two positions. It is straightened out on release. The piece is
   * still kept inside the room it belongs to, which is not a matter of taste.
   */
  const previewRotation = (nextDeg: number) => {
    const clamped = clampPoseToRegion(placement.x, placement.z, nextDeg, footprint, turnFloor)
    rotatePackage(placement.instanceId, nextDeg)
    movePackage(placement.instanceId, clamped.x, clamped.z)
  }

  /** Let go: the nearest angle it actually fits at, which is often where it is. */
  const settleRotation = () => {
    const landed = nearestFittingAngle(placement.rotationYDeg, fitsAt)
    if (landed !== null) applyRotation(landed)
  }

  // Not the next quarter but the next one it fits at. A desk that only lies
  // along the room has two positions rather than four, and a button that
  // refused to move it between them read as a broken button.
  //
  // Only asked for the piece that is actually picked up. It costs three trial
  // poses against every neighbour in the room, and it used to be asked in the
  // render body of every piece of furniture on the storey — for a button only
  // one of them can be showing.
  const nextQuarter = isSelected ? nextFittingQuarter(placement.rotationYDeg, fitsAt) : null
  const canTurn = isSelected && !isDragging && nextQuarter !== null

  // Neither group carries a `position` or `rotation` prop — see the layout
  // effect above for why the frame loop has to be the only writer.
  return (
    <group ref={groupRef}>
      <group ref={rotationRef}>
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
          // The top of the piece, with no cushion of its own: the clearance is
          // measured on screen now, and a world-space lift on top of it just
          // added a quarter of a metre of parallax to the answer.
          position={[0, height, 0]}
          zIndexRange={[20, 0]}
          calculatePosition={positionToolbar}
          // drei's own wrapper sits *at* the anchor and takes the size of what
          // is inside it, while the bar below is shifted off that anchor by
          // half its width and all of its height. The wrapper is therefore an
          // invisible box hanging down and to the right of the toolbar, over
          // bare canvas — and it swallowed every orbit drag that began there.
          // The bar takes its events back on the line below.
          style={{ pointerEvents: 'none' }}
        >
          {/* Anchored by the edge that faces the piece, not by its middle, so
              the point handed back above is the one edge that has to clear it.
              drei puts `center` on a wrapper it owns, so the shift is done here.

              Which edge that is flips with the side, and so does the stacking
              order: the slider always opens away from the piece. Growing it
              towards the piece instead is what used to make the bar move — it
              needed room on the side already in short supply, and moved to the
              other side of the piece to find it. */}
          <div
            className={cn(
              'pointer-events-auto flex -translate-x-1/2 items-center gap-2',
              barBelow ? 'flex-col-reverse' : '-translate-y-full flex-col',
            )}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
              event.stopPropagation()
              setInteractionLock(true)
              // Slider drags leave the bar, so the release lands anywhere. A
              // touch the browser takes over ends in `pointercancel` and never
              // in `pointerup`, which left the camera locked for the rest of
              // the visit, so both endings have to be listened for.
              const release = () => {
                setInteractionLock(false)
                window.removeEventListener('pointerup', release)
                window.removeEventListener('pointercancel', release)
              }
              window.addEventListener('pointerup', release)
              window.addEventListener('pointercancel', release)
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
                    onChange={(event) => previewRotation(Number(event.target.value))}
                    // Every way a range input can be let go of: the pointer, the
                    // keyboard, or the focus moving on with the value changed.
                    onPointerUp={settleRotation}
                    onKeyUp={settleRotation}
                    onBlur={settleRotation}
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
                onClick={() => nextQuarter !== null && applyRotation(nextQuarter)}
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
                  // Points at where the slider will appear, which is the far
                  // side of the bar from the piece — so under the piece the
                  // shut chevron points down, not up.
                  <ChevronUp
                    size={16}
                    className={cn('transition-transform', rotateOpen !== barBelow && 'rotate-180')}
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
  // The floor this piece may cover, worked out once. It cannot change while the
  // drag runs — the reachable zones are exactly the ones it cannot be carried
  // out of — and rebuilding it per pointer move classified every zone edge
  // twice for an answer that was already known.
  const dragFloorRef = useRef<{ instanceId: string; region: Region } | null>(null)
  // And what it has to get past, for the same reason.
  const obstaclesRef = useRef<{
    instanceId: string
    measurements: number
    list: Obstacle[]
  } | null>(null)
  const roomsByKey = useMemo(
    () => new Map(building.rooms.map((room) => [room.key, room])),
    [building.rooms],
  )

  const endDrag = () => {
    const state = useConfiguration.getState()

    // Where it actually landed, or the last place it was allowed to be. The
    // configuration is written once, here — everything before this was the
    // frame loop's business alone.
    const landed = state.dragValid ? state.dragPose : lastValidRef.current
    state.dropDrag(landed)

    lastValidRef.current = null
    freeRotationRef.current = null
    dragFloorRef.current = null
    // Cleared with the rest, and it has to be: it is keyed on the piece being
    // dragged, so picking the same one up a second time would otherwise be
    // judged against the room as it stood during the first drag — including the
    // piece's own old position, which it would then refuse to be moved back to.
    obstaclesRef.current = null
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

    // Anchored on where the piece stood when the drag began: a drag that reaches
    // a friendly zone through an unfriendly one has to be stopped at the line
    // rather than allowed to land on the far side of it.
    if (dragFloorRef.current?.instanceId !== dragging) {
      dragFloorRef.current = {
        instanceId: dragging,
        region: reachableFloor(room, pkg.compatibleRoomTypes, placement.x, placement.z),
      }
    }

    const snapped = progressiveEdgeSnapRegion(
      pointX + grabOffsetRef.current.x,
      pointZ + grabOffsetRef.current.z,
      freeRotationRef.current.rotationYDeg,
      footprint,
      dragFloorRef.current.region,
    )

    // Built once for the whole drag rather than per pointer move: it takes the
    // building's entire placement list apart to make it, and nothing can move
    // while a piece is in the air — `placed` is only written on the way down.
    //
    // Except for one thing that is not a move: a fitting finishing its
    // measurement. Held against the version rather than rebuilt every frame, so
    // a kitchen that lands mid-drag is picked up on the next frame and nothing
    // is rebuilt on any of the frames after that.
    const measurements = partObstaclesVersion()
    if (
      obstaclesRef.current?.instanceId !== dragging ||
      obstaclesRef.current.measurements !== measurements
    ) {
      obstaclesRef.current = {
        instanceId: dragging,
        measurements,
        list: obstaclesFor(
          state.placed,
          packages,
          roomsByKey,
          building.modelUrl,
          placement.roomKey,
          placement.instanceId,
        ),
      }
    }

    const valid = !collidesWithAny(
      {
        x: snapped.x,
        z: snapped.z,
        rotationYDeg: snapped.rotationYDeg,
        footprint,
        shape: shapeOf(pkg.id),
      },
      obstaclesRef.current.list,
    )

    if (valid) {
      lastValidRef.current = { x: snapped.x, z: snapped.z, rotationYDeg: snapped.rotationYDeg }
    }

    // Not into `placed`: the mesh under the finger reads this in the frame loop,
    // and the configuration is only written when the piece is put down.
    state.setDragPose({
      instanceId: dragging,
      x: snapped.x,
      z: snapped.z,
      rotationYDeg: snapped.rotationYDeg,
    })
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
