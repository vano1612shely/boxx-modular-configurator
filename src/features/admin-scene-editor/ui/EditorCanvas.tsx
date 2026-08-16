'use client'

// Before any Canvas: r3f builds a THREE.Clock the moment a store is created.
import '@/shared/three/quiet-deprecations'

import { CameraControls, Edges, Grid, Line, OrthographicCamera } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import CameraControlsImpl from 'camera-controls'
import {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import {
  Box3,
  DoubleSide,
  MathUtils,
  MeshBasicMaterial,
  Raycaster,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  type Material,
  type Mesh,
  type Object3D,
  type OrthographicCamera as ThreeOrthographicCamera,
  type Ray,
} from 'three'

import {
  fitDistance,
  hiddenExteriorNodes,
  locateOnWalls,
  onOutline,
  mapRoom,
  planOpeningPlacements,
  RoomShell,
  roomVertices,
  SceneLighting,
  zoneNodePaths,
  type OpeningPlacement,
  type RoomDoc,
  type Room,
  type WallSide,
} from '@/entities/building'
import { createNodeResolver, isTreeVisible, nodePathOf } from '@/shared/three/node-path'
import { applyOverviewClipping } from '@/shared/three/overview-clipping'
import { For, Show } from '@/shared/ui/control-flow'

import { defaultYRange, planCutY } from '../lib/blocks'
import { floorPlaneBounds } from '../lib/floor-plane'
import { bearingDeg, draggedYaw, slotToWorld, worldToSlot } from '../lib/slot-drag'

import { SIDE_COLORS } from './editor-styles'

import {
  blockRefKey,
  sameBlockRef,
  type BlockRef,
  type EditorBox,
  type ModelNode,
  type SceneEditorVm,
} from '../model/use-scene-editor-model'

import { CompassProbe, CompassRose } from './canvas/Compass'
import { ExteriorSpots } from './canvas/ExteriorSpots'
import { FloorPlaneGizmo } from './canvas/FloorPlaneGizmo'
import { RoofModelGizmo } from './canvas/RoofModelGizmo'
import { SunMarker } from './canvas/SunMarker'
import { OpeningGizmo, type OpeningGrip } from './canvas/OpeningGizmo'
import {
  handleHoverProps,
  HandlePoint,
  ScreenScaled,
  type RegisterHandle,
} from './canvas/handles'
import { EditorMenuPopup, type EditorMenuItem, type EditorMenuState } from './EditorMenu'
import { blockMenuItems, nodeMenuItems } from './menu-items'
import { useModel } from '@/shared/three/use-model'

type VmProps = { vm: SceneEditorVm }

const ROOF_COLOR = '#ef4444'
const STOREY_COLOR = '#f59e0b'

/** Matches the Canvas below, so a reset frames what the lens actually sees. */
const EDITOR_FOV = 50
/** The three-quarter direction the editor opens on. */
const HOME_VIEW_DIR = new Vector3(1, 0.85, 1.15).normalize()

/** Stays raycastable: the floor-level pick needs a surface to hit. */
const GHOST_MATERIAL = new MeshBasicMaterial({
  color: '#94a3b8',
  transparent: true,
  opacity: 0.12,
  depthWrite: false,
  side: DoubleSide,
  toneMapped: false,
})

type CornerId = 0 | 1 | 2 | 3

type OpeningDragBase = { along: number; width: number; height: number; sill: number }

type DragState =
  | { kind: 'create-block'; startX: number; startZ: number }
  | { kind: 'floor-plane'; cx: number; cz: number }
  | { kind: 'roof-move'; grabDX: number; grabDZ: number; y: number }
  | { kind: 'roof-height'; cx: number; cz: number; grabDY: number }
  // `held` is the previewed choice's model; false is the spot itself — the same
  // three gestures either way, so they share the state.
  | {
      kind: 'slot-move'
      index: number
      held: boolean
      grabDX: number
      grabDZ: number
      y: number
    }
  | { kind: 'slot-height'; index: number; held: boolean; cx: number; cz: number; grabDY: number }
  | {
      kind: 'slot-scale'
      index: number
      /** Null stretches every axis together, which is what a corner does. */
      axis: 'x' | 'y' | 'z' | null
      /** Ground plane the reach is measured on, and the centre it is measured from. */
      y: number
      cx: number
      cz: number
      /** World direction of the axis being stretched, for a single-axis drag. */
      dirX: number
      dirZ: number
      startScale: { x: number; y: number; z: number }
      startReach: number
    }
  | {
      kind: 'slot-yaw'
      index: number
      held: boolean
      cx: number
      cz: number
      y: number
      /** Bearing the grip was taken at, and the facing it belonged to. */
      startBearing: number
      startYaw: number
    }
  | {
      kind: 'opening'
      id: string
      grip: OpeningGrip
      center: { x: number; y: number; z: number }
      normal: { x: number; z: number }
      tangent: { x: number; z: number }
      base: OpeningDragBase
      grabAlong: number
      grabY: number
    }
  | { kind: 'room-point'; roomIndex: number; pointIndex: number }
  | { kind: 'block-move'; ref: BlockRef; grabDX: number; grabDZ: number; box: EditorBox }
  | { kind: 'block-corner'; ref: BlockRef; corner: CornerId; y: number; box: EditorBox }
  | { kind: 'block-height'; ref: BlockRef; side: 'min' | 'max'; box: EditorBox }
  | null

function toZone(box: EditorBox) {
  return {
    min: [box.min.x, box.min.y, box.min.z] as [number, number, number],
    max: [box.max.x, box.max.y, box.max.z] as [number, number, number],
  }
}

/** Metres; below this the shell drops the opening. */
const MIN_OPENING = 0.1

type RoomOpeningPatch = { along: number; width: number; height: number; sill: number }

/** Snap grid, in metres. */
const GRID = 0.05
function snap(value: number): number {
  return Math.round(value / GRID) * GRID
}

/** The point a click at this spot would actually use. */
function snapPoint(p: { x: number; z: number }): { x: number; z: number } {
  return { x: snap(p.x), z: snap(p.z) }
}

function isPrimaryButton(event: ThreeEvent<PointerEvent>): boolean {
  return event.nativeEvent.button === 0
}

function pointInPoly(x: number, z: number, poly: Array<{ x: number; z: number }>): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

function rayAtY(ray: Ray, h: number): { x: number; z: number } | null {
  if (Math.abs(ray.direction.y) < 1e-6) return null
  const t = (h - ray.origin.y) / ray.direction.y
  if (t < 0) return null
  return { x: ray.origin.x + ray.direction.x * t, z: ray.origin.z + ray.direction.z * t }
}

/** Uses the wall's own plane, unlike `rayAtVertical`, whose plane faces the camera. */
function rayOnWall(
  ray: Ray,
  at: { x: number; z: number },
  normal: { x: number; z: number },
): { x: number; y: number; z: number } | null {
  const denom = ray.direction.x * normal.x + ray.direction.z * normal.z
  if (Math.abs(denom) < 1e-6) return null
  const t = ((at.x - ray.origin.x) * normal.x + (at.z - ray.origin.z) * normal.z) / denom
  if (t < 0) return null
  return {
    x: ray.origin.x + ray.direction.x * t,
    y: ray.origin.y + ray.direction.y * t,
    z: ray.origin.z + ray.direction.z * t,
  }
}

/** Height where the pointer ray crosses a camera-facing vertical plane at (px, pz). */
function rayAtVertical(ray: Ray, px: number, pz: number): number | null {
  const nx = -ray.direction.x
  const nz = -ray.direction.z
  const len = Math.hypot(nx, nz)
  if (len < 1e-6) return null
  const denom = (ray.direction.x * nx + ray.direction.z * nz) / len
  if (Math.abs(denom) < 1e-6) return null
  const t = (((px - ray.origin.x) * nx + (pz - ray.origin.z) * nz) / len) / denom
  if (t < 0) return null
  return ray.origin.y + ray.direction.y * t
}

function BuildingGlb({
  vm,
  rootRef,
  resolveRef,
  onPick,
}: VmProps & {
  rootRef: MutableRefObject<Object3D | null>
  resolveRef: MutableRefObject<(path: string) => Object3D | null>
  onPick: (event: ThreeEvent<MouseEvent>) => void
}) {
  const scene = useModel(vm.modelUrl ?? '')
  const preparedRef = useRef<Object3D>(null)

  const { prepared, controller, resolveNode } = useMemo(() => {
    scene.updateMatrixWorld(true)
    return {
      prepared: scene,
      controller: applyOverviewClipping(scene),
      resolveNode: createNodeResolver(scene),
    }
  }, [scene])

  const resolveAny = useCallback(
    (path: string): Object3D | null => resolveNode(path),
    [resolveNode],
  )

  useEffect(() => {
    resolveRef.current = resolveAny
  }, [resolveAny, resolveRef])

  const selectedPathsKey = vm.selectedNodePaths.join('|')
  const modelNodes = vm.modelNodes
  const overlays = useMemo(() => {
    const paths = selectedPathsKey ? selectedPathsKey.split('|') : []
    const clones: Object3D[] = []
    paths.forEach((path, index) => {
      if (!modelNodes.some((node) => node.path === path)) return
      const source = resolveAny(path)
      if (!source) return
      const material = new MeshBasicMaterial({
        color: '#a78bfa',
        transparent: true,
        opacity: index === paths.length - 1 ? 0.45 : 0.22,
        depthTest: false,
        toneMapped: false,
      })
      const clone = source.clone(true)
      clone.traverse((object) => {
        const mesh = object as Mesh
        if (mesh.isMesh) {
          mesh.material = material
          mesh.renderOrder = 50
          mesh.raycast = () => {}
        }
      })
      clone.matrixAutoUpdate = false
      clone.matrix.copy(source.matrixWorld)
      clones.push(clone)
    })
    return clones
  }, [selectedPathsKey, resolveAny, modelNodes])

  useEffect(() => {
    rootRef.current = prepared
    return () => {
      rootRef.current = null
    }
  }, [prepared, rootRef])

  useEffect(() => {
    const bounds = new Box3().setFromObject(prepared)
    vm.onModelBounds({
      height: Math.max(bounds.max.y, 2.5),
      footprint: {
        minX: bounds.min.x,
        minZ: bounds.min.z,
        maxX: bounds.max.x,
        maxZ: bounds.max.z,
      },
    })

    const boxes = new Map<Object3D, Box3>()
    const scratch = new Box3()
    const collect = (obj: Object3D): Box3 => {
      const box = new Box3()
      const mesh = obj as Mesh
      if (mesh.isMesh && mesh.geometry) {
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
        if (mesh.geometry.boundingBox) {
          scratch.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld)
          box.union(scratch)
        }
      }
      for (const child of obj.children) box.union(collect(child))
      boxes.set(obj, box)
      return box
    }
    prepared.updateMatrixWorld(true)
    collect(prepared)

    const nodes: ModelNode[] = []
    let nextId = 0
    const round = (v: number) => Math.round(v * 100) / 100
    const displayName = (obj: Object3D, id: number): string => {
      const own = obj.name?.trim()
      if (own) return own
      const mesh = obj as Mesh
      if (mesh.isMesh) {
        const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
        const materialName = material?.name?.trim()
        if (materialName) return `Mesh · ${materialName}`
        return `Mesh ${id}`
      }
      return `Group ${id}`
    }
    const walk = (obj: Object3D, parentId: number | null, depth: number, path: string) => {
      const id = nextId++
      const box = boxes.get(obj)
      nodes.push({
        id,
        parentId,
        depth,
        name: displayName(obj, id),
        kind: (obj as Mesh).isMesh ? 'mesh' : 'group',
        hasChildren: obj.children.length > 0,
        path,
        box:
          box && !box.isEmpty()
            ? {
                min: { x: round(box.min.x), y: round(box.min.y), z: round(box.min.z) },
                max: { x: round(box.max.x), y: round(box.max.y), z: round(box.max.z) },
              }
            : null,
      })
      obj.children.forEach((child, index) => walk(child, id, depth + 1, `${path}/${index}`))
    }
    prepared.children.forEach((child, index) => walk(child, null, 0, `${index}`))

    vm.onModelNodes(nodes)
    ;(window as unknown as { __editorNodes?: ModelNode[] }).__editorNodes = nodes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared])

  /**
   * Objects an exterior spot owns but the previewed choice is not showing.
   *
   * Run through the same rule the client uses rather than a second copy of it,
   * so what an admin previews here is what a visitor gets — the sharing between
   * choices especially, where a deck listed by two of them must not blink as
   * the preview steps past.
   */
  const exteriorHidden = useMemo(() => {
    const slots = vm.exteriorSlots.map((slot, index) => ({
      key: slot.key || String(index),
      name: '',
      position: [0, 0, 0] as [number, number, number],
      yawDeg: 0,
      defaultVariantKey: slot.defaultVariantKey ?? '',
      variants: (slot.variants ?? []).map((variant, i) => ({
        key: variant.key || String(i),
        title: '',
        description: null,
        price: null,
        thumbnailUrl: null,
        nodes: zoneNodePaths(variant.nodes),
        // Only the node claims matter here — this asks which of the building's
        // own objects a choice covers, and a choice's own model is not one.
        modelUrl: null,
        placement: {
          position: [0, 0, 0] as [number, number, number],
          yawDeg: 0,
          scale: [1, 1, 1] as [number, number, number],
        },
      })),
    }))

    const chosen = vm.selectedSlotIndex === null ? null : slots[vm.selectedSlotIndex]
    const previewed = chosen?.variants[vm.previewVariantIndex ?? 0]

    return hiddenExteriorNodes(
      slots,
      chosen && previewed ? { [chosen.key]: previewed.key } : {},
    )
  }, [vm.exteriorSlots, vm.selectedSlotIndex, vm.previewVariantIndex])

  useEffect(() => {
    const removed: Object3D[] = []
    for (const path of [...vm.hiddenNodePaths, ...exteriorHidden]) {
      const object = resolveAny(path)
      if (object) {
        object.visible = false
        removed.push(object)
      }
    }
    return () => {
      for (const object of removed) object.visible = true
    }
  }, [vm.hiddenNodePaths, exteriorHidden, resolveAny])

  const ghost = vm.roomMode && vm.ghostModel
  const hiddenInRoom = vm.roomMode && !vm.ghostModel

  useEffect(() => {
    const root = preparedRef.current
    if (!root) return

    root.visible = !hiddenInRoom
    if (!ghost) return

    const saved = new Map<Mesh, Material | Material[]>()
    root.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      // Never record the ghost as the thing to come back to. If this ever runs
      // twice without its own cleanup in between, the model would be restored
      // to the ghost and stay there — a building that reads as a dark silhouette
      // with its insides showing through, for the rest of the session.
      if (mesh.material !== GHOST_MATERIAL) saved.set(mesh, mesh.material)
      mesh.material = GHOST_MATERIAL
    })

    return () => {
      for (const [mesh, material] of saved) mesh.material = material
      root.visible = true
    }
  }, [prepared, ghost, hiddenInRoom])

  useFrame(() => {
    const draft = vm.draft
    if (!draft) return

    // Exactly what the visitor's storey picker does, so what the admin drags is
    // what the admin sees. Opened back out inside a room: the ghost is there to
    // snap floor levels against, and a cut one would hide the level being set.
    const storey = vm.roomMode ? null : vm.previewFloorBox
    controller.setKeepBox(storey ? toZone(storey) : null)

    if (vm.roomMode) return

    if (vm.planMode) {
      const cutY = storey
        ? planCutY(storey.min.y, storey.max.y - storey.min.y)
        : planCutY(0, vm.modelHeight)
      controller.setHideBoxes([{ min: [-500, cutY, -500], max: [500, 500, 500] }])
      return
    }

    controller.setHideBoxes(
      !storey && vm.roofHidden ? (draft.sceneConfig?.roofBlocks ?? []).map(toZone) : [],
    )
  })

  return (
    <>
      <primitive ref={preparedRef} object={prepared} onClick={onPick} />
      <For each={overlays} getKey={(_, i) => i}>
        {(object) => <primitive object={object} />}
      </For>
    </>
  )
}

/** How far off a wall a click may land and still count as hitting it, in metres. */
const OPENING_PICK_SLACK = 0.2

/** The across-wall axis must be checked too, or a click matches an opening on another wall. */
function openingAt(
  placements: OpeningPlacement[],
  point: { x: number; y: number; z: number },
): OpeningPlacement | null {
  for (const placement of placements) {
    const { center, tangent, normal, opening, wallThickness } = placement
    const across = (point.x - center.x) * normal.x + (point.z - center.z) * normal.z
    if (Math.abs(across) > wallThickness / 2 + OPENING_PICK_SLACK) continue

    const along = (point.x - center.x) * tangent.x + (point.z - center.z) * tangent.z
    const up = point.y - center.y
    if (Math.abs(along) <= opening.width / 2 && Math.abs(up) <= opening.height / 2) {
      return placement
    }
  }
  return null
}

function ShellPreview({
  zone,
  placements,
  placing,
  onPlace,
  onSelect,
}: {
  zone: Room
  placements: OpeningPlacement[]
  placing: boolean
  onPlace: (side: WallSide, along: number) => void
  onSelect: (id: string | null) => void
}) {
  return (
    <group
      onClick={(event) => {
        if (event.delta > 4) return

        if (placing) {
          const hit = locateOnWalls(zone.floorPolygon, { x: event.point.x, z: event.point.z })
          if (!hit) return
          event.stopPropagation()
          onPlace(hit.side, hit.along)
          return
        }

        event.stopPropagation()
        onSelect(openingAt(placements, event.point)?.opening.id ?? null)
      }}
    >
      <RoomShell room={zone} />
    </group>
  )
}

function wallEdgesOf(room: RoomDoc, y: number) {
  const vertices = roomVertices(room)
  return vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length]
    return {
      side: vertex.side,
      points: [
        [vertex.x, y + 0.05, vertex.z],
        [next.x, y + 0.05, next.z],
      ] as [number, number, number][],
    }
  })
}

function floorYOf(room: { shell?: unknown } | null | undefined): number {
  const shell = room?.shell as { floorY?: number | null } | null | undefined
  return typeof shell?.floorY === 'number' ? shell.floorY : 0
}

function RoomShape({
  polygon,
  color,
  opacity,
  y = 0.03,
}: {
  polygon: Array<{ x: number; z: number }>
  color: string
  opacity: number
  y?: number
}) {
  const geometry = useMemo(() => {
    if (polygon.length < 3) return null
    const shape = new Shape()
    shape.moveTo(polygon[0].x, -polygon[0].z)
    for (let i = 1; i < polygon.length; i++) shape.lineTo(polygon[i].x, -polygon[i].z)
    shape.closePath()
    const geo = new ShapeGeometry(shape)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [polygon])

  if (!geometry) return null

  return (
    <mesh geometry={geometry} position={[0, y, 0]} raycast={() => {}}>
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  )
}

function ZoneBlockMesh({
  box,
  blockRef,
  color,
  selected,
  pickable = true,
  onPick,
}: {
  box: EditorBox
  blockRef: BlockRef
  color: string
  selected: boolean
  /** A storey volume wraps the whole model, so it must not swallow every click. */
  pickable?: boolean
  onPick: (event: ThreeEvent<MouseEvent>) => void
}) {
  const size: [number, number, number] = [
    Math.max(box.max.x - box.min.x, 0.01),
    Math.max(box.max.y - box.min.y, 0.01),
    Math.max(box.max.z - box.min.z, 0.01),
  ]
  const center: [number, number, number] = [
    (box.min.x + box.max.x) / 2,
    (box.min.y + box.max.y) / 2,
    (box.min.z + box.max.z) / 2,
  ]

  return (
    <mesh
      position={center}
      userData={{ blockRef }}
      onClick={onPick}
      raycast={pickable ? undefined : () => {}}
    >
      <boxGeometry args={size} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={selected ? 0.1 : 0.04}
        depthWrite={false}
      />
      <Edges color={color} threshold={15} scale={1} renderOrder={2}>
        <lineBasicMaterial
          color={selected ? '#ffffff' : color}
          transparent
          opacity={selected ? 1 : 0.75}
        />
      </Edges>
    </mesh>
  )
}

const CORNERS: Array<{ id: CornerId; xKey: 'min' | 'max'; zKey: 'min' | 'max' }> = [
  { id: 0, xKey: 'min', zKey: 'min' },
  { id: 1, xKey: 'max', zKey: 'min' },
  { id: 2, xKey: 'max', zKey: 'max' },
  { id: 3, xKey: 'min', zKey: 'max' },
]

function BlockHandles({
  box,
  register,
  onStartCorner,
  onStartHeight,
  onStartMove,
}: {
  box: EditorBox
  register: RegisterHandle
  onStartCorner: (corner: CornerId, y: number) => void
  onStartHeight: (side: 'min' | 'max') => void
  onStartMove: (grabDX: number, grabDZ: number) => void
}) {
  const cx = (box.min.x + box.max.x) / 2
  const cz = (box.min.z + box.max.z) / 2

  return (
    <group>
      <HandlePoint
        position={[cx, box.min.y + 0.02, cz]}
        hitRadius={0.2}
        register={register}
        begin={(ray) => {
          const hit = rayAtY(ray, box.min.y)
          if (hit) onStartMove(hit.x - cx, hit.z - cz)
        }}
      >
        <mesh>
          <cylinderGeometry args={[0.14, 0.14, 0.04, 20]} />
          <meshBasicMaterial color="#ffffff" depthTest={false} transparent />
        </mesh>
      </HandlePoint>

      <For each={CORNERS} getKey={(c) => `t-${c.id}`}>
        {(corner) => (
          <HandlePoint
            position={[box[corner.xKey].x, box.max.y, box[corner.zKey].z]}
            register={register}
            begin={() => onStartCorner(corner.id, box.max.y)}
          >
            <mesh>
              <boxGeometry args={[0.12, 0.12, 0.12]} />
              <meshBasicMaterial color="#22d3ee" depthTest={false} transparent />
            </mesh>
          </HandlePoint>
        )}
      </For>
      <For each={CORNERS} getKey={(c) => `b-${c.id}`}>
        {(corner) => (
          <HandlePoint
            position={[box[corner.xKey].x, box.min.y, box[corner.zKey].z]}
            register={register}
            begin={() => onStartCorner(corner.id, box.min.y)}
          >
            <mesh>
              <boxGeometry args={[0.12, 0.12, 0.12]} />
              <meshBasicMaterial color="#22d3ee" depthTest={false} transparent />
            </mesh>
          </HandlePoint>
        )}
      </For>

      <HandlePoint
        position={[cx, box.max.y + 0.18, cz]}
        register={register}
        begin={() => onStartHeight('max')}
      >
        <mesh>
          <coneGeometry args={[0.1, 0.22, 16]} />
          <meshBasicMaterial color="#facc15" depthTest={false} transparent />
        </mesh>
      </HandlePoint>
      <HandlePoint
        position={[cx, box.min.y - 0.18, cz]}
        rotation={[Math.PI, 0, 0]}
        register={register}
        begin={() => onStartHeight('min')}
      >
        <mesh>
          <coneGeometry args={[0.1, 0.22, 16]} />
          <meshBasicMaterial color="#facc15" depthTest={false} transparent />
        </mesh>
      </HandlePoint>
    </group>
  )
}

const PlanCamera = memo(function PlanCamera({
  rootRef,
  resetId,
}: {
  rootRef: MutableRefObject<Object3D | null>
  resetId: number
}) {
  const cameraRef = useRef<ThreeOrthographicCamera>(null)
  const { gl } = useThree()
  const [frame, setFrame] = useState<{ x: number; z: number; span: number } | null>(null)

  // A fresh object every time, so a reset re-applies the pose below even when
  // the framing itself has not moved.
  useEffect(() => {
    const root = rootRef.current
    const box = root ? new Box3().setFromObject(root) : null
    if (box && !box.isEmpty()) {
      setFrame({
        x: (box.min.x + box.max.x) / 2,
        z: (box.min.z + box.max.z) / 2,
        span: Math.max(box.max.x - box.min.x, box.max.z - box.min.z, 6),
      })
    } else {
      setFrame({ x: 0, z: 0, span: 30 })
    }
  }, [rootRef, resetId])

  useEffect(() => {
    const camera = cameraRef.current
    if (!camera || !frame) return
    camera.position.set(frame.x, 60, frame.z)
    const rect = gl.domElement.getBoundingClientRect()
    camera.zoom = Math.min(rect.width, rect.height) / (frame.span * 1.25)
    camera.updateProjectionMatrix()
  }, [frame, gl])

  useEffect(() => {
    const el = gl.domElement
    let panning = false
    let lastX = 0
    let lastY = 0

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 1 && event.button !== 2) return
      panning = true
      lastX = event.clientX
      lastY = event.clientY
      event.preventDefault()
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!panning) return
      const camera = cameraRef.current
      if (!camera) return
      // Looking straight down: screen right = +x, screen down = +z.
      camera.position.x -= (event.clientX - lastX) / camera.zoom
      camera.position.z -= (event.clientY - lastY) / camera.zoom
      lastX = event.clientX
      lastY = event.clientY
    }
    const onPointerUp = () => {
      panning = false
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const camera = cameraRef.current
      if (!camera) return
      camera.zoom = MathUtils.clamp(camera.zoom * Math.exp(-event.deltaY * 0.0012), 4, 500)
      camera.updateProjectionMatrix()
    }
    const onContextMenu = (event: Event) => event.preventDefault()

    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('contextmenu', onContextMenu)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('contextmenu', onContextMenu)
    }
  }, [gl])

  if (!frame) return null

  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      rotation={[-Math.PI / 2, 0, 0]}
      near={0.1}
      far={300}
    />
  )
})

function EditorScene({
  vm,
  onOpenMenu,
}: VmProps & { onOpenMenu: (menu: EditorMenuState) => void }) {
  const [drag, setDrag] = useState<DragState>(null)
  const [ghostRect, setGhostRect] = useState<{
    minX: number
    minZ: number
    maxX: number
    maxZ: number
  } | null>(null)
  const [cursor, setCursor] = useState<{ x: number; z: number } | null>(null)

  const controlsRef = useRef<CameraControls>(null)
  const buildingRootRef = useRef<Object3D | null>(null)
  const resolveRef = useRef<(path: string) => Object3D | null>(() => null)
  const handleMapRef = useRef(
    new Map<Object3D, { begin: (ray: Ray) => void; priority: number }>(),
  )
  const lastDragEndRef = useRef(0)
  const rightDownRef = useRef<{ x: number; y: number } | null>(null)
  const contextMenuRef = useRef<(event: MouseEvent) => void>(() => {})
  const lastPickKeyRef = useRef<string | null>(null)

  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new Raycaster(), [])
  const pointerNdc = useMemo(() => new Vector2(), [])

  const registerHandle = useCallback<RegisterHandle>((mesh, begin, priority = 0) => {
    handleMapRef.current.set(mesh, { begin, priority })
    return () => {
      handleMapRef.current.delete(mesh)
    }
  }, [])

  const rayFromEvent = useCallback(
    (event: { clientX: number; clientY: number }): Ray => {
      const rect = gl.domElement.getBoundingClientRect()
      pointerNdc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointerNdc, camera)
      return raycaster.ray
    },
    [camera, gl, pointerNdc, raycaster],
  )

  useEffect(() => {
    vm.onRegisterCameraGetter(() => {
      const controls = controlsRef.current
      if (!controls) return null
      const position = new Vector3()
      const target = new Vector3()
      controls.getPosition(position)
      controls.getTarget(target)
      const round = (v: number) => Math.round(v * 100) / 100
      return {
        position: { x: round(position.x), y: round(position.y), z: round(position.z) },
        target: { x: round(target.x), y: round(target.y), z: round(target.z) },
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The editor deliberately lets the camera go anywhere, which means it can be
  // taken somewhere useless. This is the way back, without a reload.
  const viewResetId = vm.viewResetId
  useEffect(() => {
    if (viewResetId === 0) return
    // Null in plan mode, where the orthographic camera resets itself instead.
    const controls = controlsRef.current
    if (!controls) return

    const root = buildingRootRef.current
    const box = root ? new Box3().setFromObject(root) : null
    if (!box || box.isEmpty()) {
      void controls.setLookAt(14, 12, 16, 0, 0, 0, true)
      return
    }

    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    const eye = center
      .clone()
      .addScaledVector(HOME_VIEW_DIR, fitDistance(Math.max(size.length() / 2, 1), EDITOR_FOV))

    void controls.setLookAt(eye.x, eye.y, eye.z, center.x, center.y, center.z, true)
  }, [viewResetId])

  const draft = vm.draft
  const rooms = draft?.rooms ?? []

  const openRoom = vm.roomMode ? (rooms[vm.selectedRoomIndex as number] ?? null) : null
  const openZone = useMemo(
    () => (openRoom ? mapRoom(openRoom) : null),
    [openRoom],
  )
  const openingPlacements = useMemo(
    () =>
      openZone && openZone.floorPolygon.length >= 3
        ? planOpeningPlacements(openZone.floorPolygon, openZone.shell, openZone.openings)
        : [],
    [openZone],
  )
  const selectedPlacement =
    openingPlacements.find((p) => p.opening.id === vm.selectedOpeningId) ?? null
  const [roofPlaneY, roofTopY] = defaultYRange(vm.modelHeight)

  const blockFor = (ref: BlockRef): EditorBox | null => vm.blockBox(ref)

  // Capture phase: runs before camera-controls and the R3F event layer.
  const pointerDownRef = useRef<(event: PointerEvent) => void>(() => {})
  const handlePointerDownCapture = (event: PointerEvent) => {
    if (event.button === 2) rightDownRef.current = { x: event.clientX, y: event.clientY }
    if (event.button === 1 || event.button === 2) {
      const controls = controlsRef.current
      if (!controls) return
      const ray = rayFromEvent(event)
      const root = buildingRootRef.current
      const hit = root ? raycaster.intersectObject(root, true)[0]?.point : undefined
      const ground = hit ? null : rayAtY(ray, 0)
      const point = hit ?? (ground ? new Vector3(ground.x, 0, ground.z) : null)
      if (point) controls.setOrbitPoint(point.x, point.y, point.z)
      return
    }

    if (event.button !== 0 || drag) return

    const ray = rayFromEvent(event)

    const handles = [...handleMapRef.current.keys()]
    if (handles.length) {
      // Priority before distance: a grip beats the surface it is drawn on
      // however far behind that surface it sits. Hits arrive nearest-first, so
      // a strict comparison keeps the closest of any equal rank.
      let taken: ((ray: Ray) => void) | null = null
      let rank = -Infinity
      for (const hit of raycaster.intersectObjects(handles, false)) {
        const entry = handleMapRef.current.get(hit.object)
        if (entry && entry.priority > rank) {
          rank = entry.priority
          taken = entry.begin
        }
      }

      if (taken) {
        event.preventDefault()
        event.stopImmediatePropagation()
        taken(ray)
        return
      }
    }

    if (vm.mode === 'block-roof') {
      const ground = rayAtY(ray, roofPlaneY)
      if (!ground) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setDrag({ kind: 'create-block', startX: ground.x, startZ: ground.z })
      setGhostRect({ minX: ground.x, minZ: ground.z, maxX: ground.x, maxZ: ground.z })
    }
  }

  useEffect(() => {
    const el = gl.domElement.parentElement ?? gl.domElement
    const onDown = (event: PointerEvent) => pointerDownRef.current(event)
    const onContextMenu = (event: MouseEvent) => contextMenuRef.current(event)
    el.addEventListener('pointerdown', onDown, true)
    el.addEventListener('contextmenu', onContextMenu, true)
    return () => {
      el.removeEventListener('pointerdown', onDown, true)
      el.removeEventListener('contextmenu', onContextMenu, true)
    }
  }, [gl])

  const handleContextMenuCapture = (event: MouseEvent) => {
    event.preventDefault()
    const down = rightDownRef.current
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return

    const items: EditorMenuItem[] = []
    rayFromEvent(event)

    const root = buildingRootRef.current
    let nodePath: string | null = null
    if (root) {
      const hit = raycaster
        .intersectObject(root, true)
        .find((entry) => isTreeVisible(entry.object))
      if (hit) nodePath = nodePathOf(root, hit.object)
    }

    if (nodePath) {
      if (!vm.selectedNodePaths.includes(nodePath)) vm.onSelectNodeByPath(nodePath)
      items.push(...nodeMenuItems(vm, nodePath))
    }

    if (vm.selectedBlock) items.push(...blockMenuItems(vm, vm.selectedBlock))

    if (items.length) onOpenMenu({ x: event.clientX, y: event.clientY, items })
  }

  /** Where a spot stands and which way it faces, for converting a drag back. */
  const slotFrame = (index: number) => {
    const slot = vm.exteriorSlots[index]
    return {
      x: slot?.position?.x ?? 0,
      y: slot?.position?.y ?? 0,
      z: slot?.position?.z ?? 0,
      yawDeg: slot?.yawDeg ?? 0,
    }
  }

  /** Where the previewed choice's model stands, and which choice that is. */
  const heldAt = (index: number) => {
    const variantIndex = vm.previewVariantIndex
    if (variantIndex === null) return null

    const variant = (vm.exteriorSlots[index]?.variants ?? [])[variantIndex]
    if (!variant) return null

    const placement = variant.placement
    return {
      variantIndex,
      x: placement?.position?.x ?? 0,
      y: placement?.position?.y ?? 0,
      z: placement?.position?.z ?? 0,
      yawDeg: placement?.yawDeg ?? 0,
    }
  }

  /**
   * How far the pointer is from the model's centre, along whatever is being
   * stretched: the axis itself for a face pad, any direction on the ground for
   * a corner. Null when the ray misses the plane it is measured on.
   */
  const scaleReach = (
    ray: Ray,
    drag: { axis: 'x' | 'y' | 'z' | null; y: number; cx: number; cz: number; dirX: number; dirZ: number },
  ): number | null => {
    if (drag.axis === 'y') {
      const y = rayAtVertical(ray, drag.cx, drag.cz)
      return y === null ? null : Math.abs(y - drag.y)
    }

    const hit = rayAtY(ray, drag.y)
    if (!hit) return null

    const dx = hit.x - drag.cx
    const dz = hit.z - drag.cz
    if (drag.axis === null) return Math.hypot(dx, dz)
    return Math.abs(dx * drag.dirX + dz * drag.dirZ)
  }

  const applyDragRef = useRef<(ray: Ray) => void>(() => {})
  const applyDrag = (ray: Ray) => {
    if (!drag) return

    if (drag.kind === 'create-block') {
      const hit = rayAtY(ray, roofPlaneY)
      if (!hit) return
      setGhostRect({
        minX: snap(Math.min(drag.startX, hit.x)),
        minZ: snap(Math.min(drag.startZ, hit.z)),
        maxX: snap(Math.max(drag.startX, hit.x)),
        maxZ: snap(Math.max(drag.startZ, hit.z)),
      })
      return
    }

    if (drag.kind === 'floor-plane') {
      const y = rayAtVertical(ray, drag.cx, drag.cz)
      if (y === null) return
      // patchDraft's 300 ms checkpoint throttle collapses the drag into one undo step.
      vm.onSetFloorLevel(snap(y))
      return
    }

    if (drag.kind === 'roof-move') {
      const hit = rayAtY(ray, drag.y)
      if (!hit) return
      const { position } = vm.roofPlacement
      vm.onMoveRoofModel(snap(hit.x - drag.grabDX), position.y, snap(hit.z - drag.grabDZ))
      return
    }

    if (drag.kind === 'roof-height') {
      const y = rayAtVertical(ray, drag.cx, drag.cz)
      if (y === null) return
      const { position } = vm.roofPlacement
      // Absolute, against the offset measured once when the grip was taken. The
      // old form added a delta and rewrote the drag state every pointermove,
      // which re-rendered the scene mid-gesture and let the error accumulate.
      vm.onMoveRoofModel(position.x, snap(y - drag.grabDY), position.z)
      return
    }

    if (drag.kind === 'slot-move') {
      const hit = rayAtY(ray, drag.y)
      if (!hit) return

      const x = snap(hit.x - drag.grabDX)
      const z = snap(hit.z - drag.grabDZ)

      if (!drag.held) {
        const position = vm.exteriorSlots[drag.index]?.position
        vm.onMoveSlot(drag.index, x, position?.y ?? 0, z)
        return
      }

      const held = heldAt(drag.index)
      if (!held) return
      // Dragged in the world, stored against the spot — so a spot moved later
      // carries its model with it.
      const local = worldToSlot(slotFrame(drag.index), { x, y: drag.y, z })
      vm.onMoveVariant(drag.index, held.variantIndex, snap(local.x), held.y, snap(local.z))
      return
    }

    if (drag.kind === 'slot-height') {
      const y = rayAtVertical(ray, drag.cx, drag.cz)
      if (y === null) return

      if (!drag.held) {
        const position = vm.exteriorSlots[drag.index]?.position
        vm.onMoveSlot(drag.index, position?.x ?? 0, snap(y - drag.grabDY), position?.z ?? 0)
        return
      }

      const held = heldAt(drag.index)
      if (!held) return
      const lift = snap(y - drag.grabDY - slotFrame(drag.index).y)
      vm.onMoveVariant(drag.index, held.variantIndex, held.x, lift, held.z)
      return
    }

    if (drag.kind === 'slot-scale') {
      const held = heldAt(drag.index)
      if (!held) return

      const reach = scaleReach(ray, drag)
      if (reach === null || reach < 1e-4) return

      // Measured out from the model's own centre, so pulling a grip away grows
      // it and pushing in shrinks it, whichever grip was taken and wherever the
      // camera is standing. A corner takes every axis with it; a face pad takes
      // only its own, which is how a deck gets longer without getting taller.
      const factor = reach / drag.startReach
      const clamp = (value: number) =>
        Math.round(Math.min(50, Math.max(0.02, value)) * 1000) / 1000

      vm.onSetVariantScale(drag.index, held.variantIndex, {
        x: clamp(drag.startScale.x * (drag.axis === null || drag.axis === 'x' ? factor : 1)),
        y: clamp(drag.startScale.y * (drag.axis === null || drag.axis === 'y' ? factor : 1)),
        z: clamp(drag.startScale.z * (drag.axis === null || drag.axis === 'z' ? factor : 1)),
      })
      return
    }

    if (drag.kind === 'slot-yaw') {
      const hit = rayAtY(ray, drag.y)
      if (!hit) return

      const bearing = bearingDeg(hit.x - drag.cx, hit.z - drag.cz)
      const held = drag.held ? heldAt(drag.index) : null

      // The spot's own facing is constant through the gesture, so measuring the
      // model's turn in world bearings costs nothing — the offset cancels in
      // the delta.
      const turned = Math.round(
        draggedYaw({
          startYaw: drag.startYaw,
          startBearing: drag.startBearing,
          bearing,
          currentYaw: held ? held.yawDeg : (vm.exteriorSlots[drag.index]?.yawDeg ?? 0),
        }),
      )

      if (held) vm.onSetVariantYaw(drag.index, held.variantIndex, turned)
      else vm.onSetSlotYaw(drag.index, turned)
      return
    }

    if (drag.kind === 'opening') {
      const hit = rayOnWall(ray, drag.center, drag.normal)
      if (!hit) return

      const along =
        (hit.x - drag.center.x) * drag.tangent.x + (hit.z - drag.center.z) * drag.tangent.z
      const dAlong = along - drag.grabAlong
      const dUp = hit.y - drag.grabY
      const base = drag.base

      const patch: Partial<RoomOpeningPatch> = {}
      switch (drag.grip) {
        case 'move':
          patch.along = Math.max(snap(base.along + dAlong), 0)
          break
        case 'end':
          patch.width = Math.max(snap(base.width + dAlong), MIN_OPENING)
          break
        case 'start': {
          // The far jamb stays put, so `along` absorbs the width change.
          const width = Math.max(snap(base.width - dAlong), MIN_OPENING)
          patch.width = width
          patch.along = Math.max(base.along + (base.width - width), 0)
          break
        }
        case 'head':
          patch.height = Math.max(snap(base.height + dUp), MIN_OPENING)
          break
        case 'sill': {
          // The head stays put, so height absorbs the sill change.
          const sill = Math.max(snap(base.sill + dUp), 0)
          patch.sill = sill
          patch.height = Math.max(base.height - (sill - base.sill), MIN_OPENING)
          break
        }
      }

      vm.onUpdateOpening(vm.selectedRoomIndex as number, drag.id, patch)
      return
    }

    if (drag.kind === 'room-point') {
      const hit = rayAtY(ray, vm.floorPlaneY)
      if (!hit) return
      vm.onUpdateRoomPoint(drag.roomIndex, drag.pointIndex, snap(hit.x), snap(hit.z))
      return
    }

    if (drag.kind === 'block-move') {
      const hit = rayAtY(ray, drag.box.min.y)
      if (!hit) return
      const width = drag.box.max.x - drag.box.min.x
      const depth = drag.box.max.z - drag.box.min.z
      const minX = snap(hit.x - drag.grabDX - width / 2)
      const minZ = snap(hit.z - drag.grabDZ - depth / 2)
      vm.onUpdateBlock(drag.ref, {
        min: { x: minX, y: drag.box.min.y, z: minZ },
        max: { x: minX + width, y: drag.box.max.y, z: minZ + depth },
      })
      return
    }

    if (drag.kind === 'block-corner') {
      const hit = rayAtY(ray, drag.y)
      if (!hit) return
      const corner = CORNERS[drag.corner]
      const next = { min: { ...drag.box.min }, max: { ...drag.box.max } }
      next[corner.xKey].x = snap(hit.x)
      next[corner.zKey].z = snap(hit.z)
      // updateBlock normalizes min/max, so a corner dragged past the opposite one flips the box.
      vm.onUpdateBlock(drag.ref, next)
      return
    }

    if (drag.kind === 'block-height') {
      const cx = (drag.box.min.x + drag.box.max.x) / 2
      const cz = (drag.box.min.z + drag.box.max.z) / 2
      const y = rayAtVertical(ray, cx, cz)
      if (y === null) return
      const next = { min: { ...drag.box.min }, max: { ...drag.box.max } }
      if (drag.side === 'min') next.min.y = Math.min(snap(y), drag.box.max.y - 0.05)
      else next.max.y = Math.max(snap(y), drag.box.min.y + 0.05)
      vm.onUpdateBlock(drag.ref, next)
    }
  }

  const endDragRef = useRef<() => void>(() => {})
  const endActiveDrag = () => {
    if (drag?.kind === 'create-block' && ghostRect) {
      if (ghostRect.maxX - ghostRect.minX > 0.15 && ghostRect.maxZ - ghostRect.minZ > 0.15) {
        vm.onAddBlock(ghostRect)
      }
    }
    if (drag) lastDragEndRef.current = performance.now()
    setDrag(null)
    setGhostRect(null)
  }

  useEffect(() => {
    if (!drag) return
    const onMove = (event: PointerEvent) => applyDragRef.current(rayFromEvent(event))
    const onUp = () => endDragRef.current()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, rayFromEvent])

  const keyDownRef = useRef<(event: KeyboardEvent) => void>(() => {})
  const handleEditorKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      vm.onUndo()
      return
    }
    if (event.key === 'Escape') {
      vm.onEscape()
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selected = vm.selectedBlock
      if (selected) {
        event.preventDefault()
        vm.onRemoveBlock(selected)
      } else if (vm.selectedNodePaths.length) {
        // Model objects can't be removed from the glb, so Delete hides them instead.
        event.preventDefault()
        for (const path of vm.selectedNodePaths) vm.onHideNode(path)
      }
      return
    }
    if (event.key === 'f' || event.key === 'F') {
      const controls = controlsRef.current
      if (!controls) return
      const box = new Box3()
      const selectedBox = vm.selectedBlock ? blockFor(vm.selectedBlock) : null
      const room = vm.selectedRoomIndex !== null ? rooms[vm.selectedRoomIndex] : null
      const polygon = room?.floorPolygon ?? []
      if (selectedBox) {
        box.set(
          new Vector3(selectedBox.min.x, selectedBox.min.y, selectedBox.min.z),
          new Vector3(selectedBox.max.x, selectedBox.max.y, selectedBox.max.z),
        )
      } else if (polygon.length >= 3) {
        box.set(
          new Vector3(
            Math.min(...polygon.map((p) => p.x)),
            0,
            Math.min(...polygon.map((p) => p.z)),
          ),
          new Vector3(
            Math.max(...polygon.map((p) => p.x)),
            vm.modelHeight * 0.85,
            Math.max(...polygon.map((p) => p.z)),
          ),
        )
      } else if (buildingRootRef.current) {
        box.setFromObject(buildingRootRef.current)
      }
      if (!box.isEmpty()) {
        void controls.fitToBox(box, true, {
          paddingLeft: 0.5,
          paddingRight: 0.5,
          paddingTop: 0.5,
          paddingBottom: 0.5,
        })
      }
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => keyDownRef.current(event)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // No dep array: the stable DOM listeners above read fresh state through these refs.
  useEffect(() => {
    pointerDownRef.current = handlePointerDownCapture
    applyDragRef.current = applyDrag
    endDragRef.current = endActiveDrag
    keyDownRef.current = handleEditorKeyDown
    contextMenuRef.current = handleContextMenuCapture
  })

  const handleScenePick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 4) return
    if (performance.now() - lastDragEndRef.current < 200) return

    if (vm.mode === 'floor-level') {
      event.stopPropagation()
      vm.onSnapFloorLevel(event.point.y)
      return
    }

    if (vm.roomMode || vm.mode !== 'select') return
    event.stopPropagation()

    const root = buildingRootRef.current
    type Candidate =
      | { kind: 'block'; ref: BlockRef; key: string }
      | { kind: 'node'; path: string; key: string }
    const candidates: Candidate[] = []
    const seen = new Set<string>()

    for (const hit of event.intersections) {
      if (!isTreeVisible(hit.object)) continue
      const blockRef = hit.object.userData.blockRef as BlockRef | undefined
      if (blockRef) {
        if (event.nativeEvent.ctrlKey) continue
        const key = blockRefKey(blockRef)
        if (!seen.has(key)) {
          seen.add(key)
          candidates.push({ kind: 'block', ref: blockRef, key })
        }
        continue
      }
      if (root) {
        const path = nodePathOf(root, hit.object)
        if (path !== null) {
          const key = `n:${path}`
          if (!seen.has(key)) {
            seen.add(key)
            candidates.push({ kind: 'node', path, key })
          }
        }
      }
    }
    if (!candidates.length) return

    if (event.nativeEvent.shiftKey) {
      const first = candidates[0]
      if (first.kind === 'block') vm.onToggleBlockSelection(first.ref)
      else vm.onToggleNodeSelection(first.path)
      lastPickKeyRef.current = first.key
      return
    }

    let currentIndex = lastPickKeyRef.current
      ? candidates.findIndex((c) => c.key === lastPickKeyRef.current)
      : -1
    if (currentIndex === -1 && vm.selectedBlock) {
      const selected = vm.selectedBlock
      currentIndex = candidates.findIndex(
        (c) => c.kind === 'block' && sameBlockRef(c.ref, selected),
      )
    }
    if (currentIndex === -1 && vm.selectedNode) {
      const path = vm.selectedNode.path
      currentIndex = candidates.findIndex((c) => c.kind === 'node' && c.path === path)
    }
    const next = candidates[(currentIndex + 1) % candidates.length]
    lastPickKeyRef.current = next.key
    if (next.kind === 'block') vm.onSelectBlock(next.ref)
    else vm.onSelectNodeByPath(next.path)
  }

  const handleGroundPointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (vm.mode === 'draw-room' || vm.mode === 'cut-zone') {
      setCursor({ x: event.point.x, z: event.point.z })
    }
  }

  const handleGroundPointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (drag || event.delta > 4 || !isPrimaryButton(event)) return
    if (performance.now() - lastDragEndRef.current < 200) return
    if (vm.mode === 'floor-level') return
    if (vm.mode === 'select') {
      if (vm.roomMode) {
        vm.onSelectBlock(null)
        lastPickKeyRef.current = null
        return
      }

      const hitIndex = rooms.findIndex((room) =>
        pointInPoly(
          event.point.x,
          event.point.z,
          (room.floorPolygon ?? []).map((p) => ({ x: p.x, z: p.z })),
        ),
      )
      if (hitIndex >= 0) {
        vm.onEnterRoom(hitIndex)
      } else {
        vm.onSelectNode(null)
        lastPickKeyRef.current = null
      }
      return
    }

    vm.onFloorClick(snap(event.point.x), snap(event.point.z))
  }

  const nodeBox = vm.selectedNode?.box ?? null

  // The wall the next click would land on, or null while the pointer is out in
  // the middle of the floor. Drawn, and used by nothing else: the model asks
  // the same question of the click itself, so the two cannot disagree.
  const cutWall =
    vm.mode === 'cut-zone' && cursor ? onOutline(vm.cutOutline, snapPoint(cursor)) : null

  const floorPlane = floorPlaneBounds(vm.modelFootprint)

  return (
    <>
      <color attach="background" args={['#1c1e22']} />
      <SceneLighting bounds={null} focusedRoom={openZone} />
      <Show when={!vm.roomMode}>
        <Grid
          args={[80, 80]}
          position={[0, -0.02, 0]}
          cellColor="#2c2f36"
          sectionColor="#3a3e47"
          fadeDistance={70}
        />
      </Show>

      <Show when={vm.modelUrl}>
        <Suspense fallback={null}>
          <BuildingGlb
            vm={vm}
            rootRef={buildingRootRef}
            resolveRef={resolveRef}
            onPick={handleScenePick}
          />
        </Suspense>
      </Show>

      <mesh
        position={[0, vm.floorPlaneY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handleGroundPointerMove}
        onPointerUp={handleGroundPointerUp}
      >
        <planeGeometry args={[300, 300]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Show when={nodeBox}>
        {(b) => (
          <mesh
            position={[
              (b.min.x + b.max.x) / 2,
              (b.min.y + b.max.y) / 2,
              (b.min.z + b.max.z) / 2,
            ]}
            raycast={() => {}}
          >
            <boxGeometry
              args={[
                Math.max(b.max.x - b.min.x, 0.02),
                Math.max(b.max.y - b.min.y, 0.02),
                Math.max(b.max.z - b.min.z, 0.02),
              ]}
            />
            <meshBasicMaterial color="#a78bfa" transparent opacity={0.08} depthWrite={false} />
            <Edges color="#c4b5fd" threshold={15} renderOrder={3}>
              <lineBasicMaterial color="#c4b5fd" transparent opacity={0.95} />
            </Edges>
          </mesh>
        )}
      </Show>


      <Show when={!vm.planMode && openZone && openZone.floorPolygon.length >= 3 ? openZone : null}>
        {(zone) => (
          <ShellPreview
            zone={zone}
            placements={openingPlacements}
            placing={vm.mode === 'place-opening'}
            onPlace={(side, along) =>
              vm.onAddOpening(
                vm.selectedRoomIndex as number,
                vm.openingKind,
                side,
                Math.max(along - 0.45, 0),
              )
            }
            onSelect={vm.onSelectOpening}
          />
        )}
      </Show>

      <Show when={!vm.planMode && vm.mode === 'select' ? selectedPlacement : null}>
        {(placement) => (
          <OpeningGizmo
            placement={placement}
            register={registerHandle}
            onStart={(grip, ray) => {
              const hit = rayOnWall(ray, placement.center, placement.normal)
              if (!hit) return
              setDrag({
                kind: 'opening',
                id: placement.opening.id,
                grip,
                center: placement.center,
                normal: placement.normal,
                tangent: placement.tangent,
                base: {
                  along: placement.opening.along,
                  width: placement.opening.width,
                  height: placement.opening.height,
                  sill: placement.opening.sill,
                },
                grabAlong:
                  (hit.x - placement.center.x) * placement.tangent.x +
                  (hit.z - placement.center.z) * placement.tangent.z,
                grabY: hit.y,
              })
            }}
          />
        )}
      </Show>

      <For each={rooms} getKey={(_, i) => i}>
        {(room, roomIndex) => {
          if (vm.roomMode && roomIndex !== vm.selectedRoomIndex) return null
          // Outlines are overlays, so the storey cut does not reach them.
          if (!vm.roomMode && vm.previewRoomIndexes && !vm.previewRoomIndexes.has(roomIndex)) {
            return null
          }
          const polygon = (room.floorPolygon ?? []).map((p) => ({ x: p.x, z: p.z }))
          if (polygon.length < 3) return null
          const isSelected = roomIndex === vm.selectedRoomIndex
          const baseY = floorYOf(room)

          return (
            <group>
              <RoomShape
                polygon={polygon}
                color={isSelected ? '#4ade80' : '#38bdf8'}
                opacity={isSelected ? 0.22 : 0.1}
                y={baseY + 0.03}
              />
              <Show
                when={isSelected}
                fallback={
                  <Line
                    points={[...polygon, polygon[0]].map(
                      (p) => [p.x, baseY + 0.05, p.z] as [number, number, number],
                    )}
                    color="#38bdf8"
                    lineWidth={1.5}
                  />
                }
              >
                <For each={wallEdgesOf(room, baseY)} getKey={(_, i) => i}>
                  {(edge) => (
                    <Line points={edge.points} color={SIDE_COLORS[edge.side]} lineWidth={3} />
                  )}
                </For>
              </Show>
              <Show when={!vm.roomMode}>
              <ScreenScaled
                position={[
                  polygon.reduce((s, p) => s + p.x, 0) / polygon.length,
                  baseY + 0.02,
                  polygon.reduce((s, p) => s + p.z, 0) / polygon.length,
                ]}
              >
                <mesh
                  onClick={(event) => {
                    if (event.delta > 4 || vm.mode !== 'select') return
                    event.stopPropagation()
                    vm.onEnterRoom(roomIndex)
                  }}
                  {...handleHoverProps}
                >
                  <cylinderGeometry args={[0.3, 0.3, 0.03, 20]} />
                  <meshBasicMaterial
                    color={isSelected ? '#4ade80' : '#38bdf8'}
                    transparent
                    opacity={0.85}
                  />
                </mesh>
              </ScreenScaled>
              </Show>

              {/* Only the room being worked on: zone tints over every room at
                  once would repaint the whole plan. */}
              <Show when={isSelected && vm.roomMode}>
                <For each={vm.zones} getKey={(zone) => zone.key}>
                  {(zone) => (
                    <group>
                      <RoomShape
                        polygon={zone.polygon}
                        color={zone.color}
                        opacity={vm.selectedZoneKey === zone.key ? 0.34 : 0.16}
                        y={baseY + 0.04}
                      />
                      <Line
                        points={[...zone.polygon, zone.polygon[0]].map(
                          (p) => [p.x, baseY + 0.06, p.z] as [number, number, number],
                        )}
                        color={zone.color}
                        lineWidth={vm.selectedZoneKey === zone.key ? 3 : 1.5}
                      />
                    </group>
                  )}
                </For>
              </Show>

              <Show when={isSelected && vm.mode === 'select'}>
                <For each={polygon} getKey={(_, i) => i}>
                  {(point, pointIndex) => (
                    <HandlePoint
                      position={[point.x, baseY + 0.08, point.z]}
                      hitRadius={0.14}
                      register={registerHandle}
                      begin={() => setDrag({ kind: 'room-point', roomIndex, pointIndex })}
                    >
                      <mesh>
                        <sphereGeometry args={[0.09, 16, 16]} />
                        <meshBasicMaterial color="#4ade80" depthTest={false} transparent />
                      </mesh>
                    </HandlePoint>
                  )}
                </For>
                <For each={polygon} getKey={(_, i) => `mid-${i}`}>
                  {(point, edgeIndex) => {
                    const next = polygon[(edgeIndex + 1) % polygon.length]
                    const mx = (point.x + next.x) / 2
                    const mz = (point.z + next.z) / 2
                    return (
                      <ScreenScaled position={[mx, baseY + 0.06, mz]}>
                        <mesh
                          onClick={(event) => {
                            if (event.delta > 4) return
                            event.stopPropagation()
                            vm.onInsertRoomPoint(roomIndex, edgeIndex, mx, mz)
                          }}
                          {...handleHoverProps}
                        >
                          <sphereGeometry args={[0.06, 12, 12]} />
                          <meshBasicMaterial color="#a3e635" transparent opacity={0.7} />
                        </mesh>
                      </ScreenScaled>
                    )
                  }}
                </For>
              </Show>

            </group>
          )
        }}
      </For>

      <For
        each={vm.roomMode ? [] : (draft?.sceneConfig?.roofBlocks ?? [])}
        getKey={(_, i) => `r-${i}`}
      >
        {(block, blockIndex) => {
          const ref: BlockRef = { scope: 'roof', index: blockIndex }
          return (
            <ZoneBlockMesh
              box={block}
              blockRef={ref}
              color={ROOF_COLOR}
              selected={vm.selectedBlocks.some((r) => sameBlockRef(r, ref))}
              // A volume is picked only to select it. Any other tool has to
              // shoot straight through, or a press meant for the model — or for
              // a gizmo standing inside one — lands on the box instead.
              pickable={vm.mode === 'select'}
              onPick={handleScenePick}
            />
          )
        }}
      </For>

      {/* Only the storey being previewed: the volumes overlap the whole model,
          so drawing them all would bury it. */}
      <Show when={!vm.roomMode && vm.previewFloorIndex !== null ? vm.previewFloorBox : null}>
        {(box) => (
          <ZoneBlockMesh
            box={box}
            blockRef={{ scope: 'floor', index: vm.previewFloorIndex as number }}
            color={STOREY_COLOR}
            selected
            pickable={false}
            onPick={handleScenePick}
          />
        )}
      </Show>

      <Show when={vm.selectedBlock ? blockFor(vm.selectedBlock) : null}>
        {(box) => (
          <BlockHandles
            box={box}
            register={registerHandle}
            onStartCorner={(corner, y) =>
              setDrag({ kind: 'block-corner', ref: vm.selectedBlock!, corner, y, box })
            }
            onStartHeight={(side) =>
              setDrag({ kind: 'block-height', ref: vm.selectedBlock!, side, box })
            }
            onStartMove={(grabDX, grabDZ) =>
              setDrag({ kind: 'block-move', ref: vm.selectedBlock!, grabDX, grabDZ, box })
            }
          />
        )}
      </Show>

      <Show when={vm.mode === 'draw-room' && vm.drawingPoints.length > 0}>
        <For each={vm.drawingPoints} getKey={(_, i) => i}>
          {(point, i) => {
            const dot = (
              <mesh>
                <sphereGeometry args={[i === 0 ? 0.12 : 0.08, 16, 16]} />
                <meshBasicMaterial color={i === 0 ? '#fb923c' : '#fde047'} />
              </mesh>
            )
            const at: [number, number, number] = [point.x, vm.floorPlaneY + 0.08, point.z]

            // Closing goes through the handle layer, which wins the press over the
            // floor plane underneath; hitRadius is 1.25x the dot it wraps.
            if (i === 0 && vm.drawingPoints.length >= 3) {
              return (
                <HandlePoint
                  position={at}
                  hitRadius={0.15}
                  register={registerHandle}
                  begin={() => vm.onFinishRoom()}
                >
                  {dot}
                </HandlePoint>
              )
            }
            return <ScreenScaled position={at}>{dot}</ScreenScaled>
          }}
        </For>
        <Show when={vm.drawingPoints.length > 1}>
          <Line
            points={vm.drawingPoints.map(
              (p) => [p.x, vm.floorPlaneY + 0.07, p.z] as [number, number, number],
            )}
            color="#fde047"
            lineWidth={2}
          />
        </Show>
        <Show when={cursor !== null}>
          <Line
            points={[
              [
                vm.drawingPoints[vm.drawingPoints.length - 1]?.x ?? 0,
                vm.floorPlaneY + 0.07,
                vm.drawingPoints[vm.drawingPoints.length - 1]?.z ?? 0,
              ],
              [cursor?.x ?? 0, vm.floorPlaneY + 0.07, cursor?.z ?? 0],
            ]}
            color="#fde047"
            lineWidth={1}
            dashed
            dashSize={0.2}
            gapSize={0.15}
          />
        </Show>
      </Show>

      {/* The cut in progress. Drawn on top of the zone tints, in white, because
          it is the one line on the plan that will never be built. Pink is
          reserved for walls: the wall under the pointer, and the point already
          anchored to one. */}
      <Show when={vm.mode === 'cut-zone'}>
        <Show when={cutWall}>
          {(wall) => (
            <group>
              <Line
                points={[
                  [
                    vm.cutOutline[wall.index].x,
                    vm.floorPlaneY + 0.09,
                    vm.cutOutline[wall.index].z,
                  ],
                  [
                    vm.cutOutline[(wall.index + 1) % vm.cutOutline.length].x,
                    vm.floorPlaneY + 0.09,
                    vm.cutOutline[(wall.index + 1) % vm.cutOutline.length].z,
                  ],
                ]}
                color="#f472b6"
                lineWidth={5}
              />
              <ScreenScaled position={[wall.point.x, vm.floorPlaneY + 0.1, wall.point.z]}>
                <mesh>
                  <sphereGeometry args={[0.1, 16, 16]} />
                  <meshBasicMaterial color="#f472b6" />
                </mesh>
              </ScreenScaled>
            </group>
          )}
        </Show>

        <For each={vm.cutPoints} getKey={(_, i) => i}>
          {(point, i) => (
            <ScreenScaled position={[point.x, vm.floorPlaneY + 0.09, point.z]}>
              <mesh>
                <sphereGeometry args={[i === 0 ? 0.12 : 0.08, 16, 16]} />
                <meshBasicMaterial color={i === 0 ? '#f472b6' : '#ffffff'} />
              </mesh>
            </ScreenScaled>
          )}
        </For>
        <Show when={vm.cutPoints.length > 1}>
          <Line
            points={vm.cutPoints.map(
              (p) => [p.x, vm.floorPlaneY + 0.08, p.z] as [number, number, number],
            )}
            color="#ffffff"
            lineWidth={2}
            dashed
            dashSize={0.3}
            gapSize={0.12}
          />
        </Show>
        {/* Ends at the wall when there is one under the pointer, so the line
            shows exactly where the click will land — and that it will finish. */}
        <Show when={vm.cutPoints.length > 0 && cursor !== null}>
          <Line
            points={[
              [
                vm.cutPoints[vm.cutPoints.length - 1]?.x ?? 0,
                vm.floorPlaneY + 0.08,
                vm.cutPoints[vm.cutPoints.length - 1]?.z ?? 0,
              ],
              [
                cutWall?.point.x ?? cursor?.x ?? 0,
                vm.floorPlaneY + 0.08,
                cutWall?.point.z ?? cursor?.z ?? 0,
              ],
            ]}
            color={cutWall ? '#f472b6' : '#ffffff'}
            lineWidth={cutWall ? 2 : 1}
            dashed
            dashSize={0.15}
            gapSize={0.12}
          />
        </Show>
      </Show>

      <ExteriorSpots
        vm={vm}
        register={registerHandle}
        // The grab offset is taken on the spot's own ground plane, so a puck
        // caught off centre does not snap the spot under the cursor.
        onStartMove={(index, moving, ray, y) => {
          const t =
            Math.abs(ray.direction.y) < 1e-6 ? null : (y - ray.origin.y) / ray.direction.y
          if (t === null || t < 0) {
            setDrag({ kind: 'slot-move', index, held: moving, grabDX: 0, grabDZ: 0, y })
            return
          }

          // Offset from the grip to the thing's own centre, so it does not jump
          // to sit under the cursor.
          const held = moving ? heldAt(index) : null
          const frame = slotFrame(index)
          const centre =
            held === null
              ? frame
              : slotToWorld(frame, { x: held.x, y: held.y, z: held.z })

          setDrag({
            kind: 'slot-move',
            index,
            held: moving,
            grabDX: ray.origin.x + ray.direction.x * t - centre.x,
            grabDZ: ray.origin.z + ray.direction.z * t - centre.z,
            y,
          })
        }}
        onStartHeight={(index, moving, ray, grip) => {
          const y = rayAtVertical(ray, grip[0], grip[2])
          const held = moving ? heldAt(index) : null
          const frame = slotFrame(index)
          const base = held === null ? frame.y : frame.y + held.y

          setDrag({
            kind: 'slot-height',
            index,
            held: moving,
            cx: grip[0],
            cz: grip[2],
            grabDY: (y ?? grip[1]) - base,
          })
        }}
        onStartScale={(index, ray, axis) => {
          const held = heldAt(index)
          if (!held) return

          const frame = slotFrame(index)
          const centre = slotToWorld(frame, { x: held.x, y: held.y, z: held.z })
          // The model's own axes, turned by the spot's facing and its own.
          const yaw = ((frame.yawDeg + held.yawDeg) * Math.PI) / 180
          const dirX = axis === 'x' ? Math.cos(yaw) : Math.sin(yaw)
          const dirZ = axis === 'x' ? -Math.sin(yaw) : Math.cos(yaw)

          const stored = (vm.exteriorSlots[index]?.variants ?? [])[held.variantIndex]?.placement
            ?.scale
          const startScale = {
            x: stored?.x || 1,
            y: stored?.y || 1,
            z: stored?.z || 1,
          }

          const seed = { axis, y: centre.y, cx: centre.x, cz: centre.z, dirX, dirZ }
          const reach = scaleReach(ray, seed)
          // A grip taken exactly over the centre has no reach to scale by, and
          // dividing by it would send the model to infinity on the first move.
          if (reach === null || reach < 1e-3) return

          setDrag({ kind: 'slot-scale', index, ...seed, startScale, startReach: reach })
        }}
        onStartYaw={(index, moving, ray, centre) => {
          const hit = rayAtY(ray, centre[1])
          const held = moving ? heldAt(index) : null
          const facing = held ? held.yawDeg : (vm.exteriorSlots[index]?.yawDeg ?? 0)

          setDrag({
            kind: 'slot-yaw',
            index,
            held: moving,
            cx: centre[0],
            cz: centre[2],
            y: centre[1],
            startBearing: hit ? bearingDeg(hit.x - centre[0], hit.z - centre[2]) : facing,
            startYaw: facing,
          })
        }}
      />

      <Show when={vm.roofModelUrl}>
        {(url) => (
          <Suspense fallback={null}>
            <RoofModelGizmo
              url={url}
              placement={vm.roofPlacement}
              visible={!vm.roomMode && !vm.roofHidden}
              register={registerHandle}
              onMeasured={vm.onRoofModelBounds}
              // The grab plane is the puck's own, not the model origin's: those
              // are metres apart on a roof, and the mismatch slid it sideways.
              onStartMove={(grabDX, grabDZ, planeY) =>
                setDrag({ kind: 'roof-move', grabDX, grabDZ, y: planeY })
              }
              // The drag plane runs through the grip the pointer actually took,
              // not through the model origin — on a roof those are metres apart,
              // and the mismatch skews how fast the height follows the cursor.
              onStartHeight={(ray, grip) => {
                const y = rayAtVertical(ray, grip[0], grip[2])
                setDrag({
                  kind: 'roof-height',
                  cx: grip[0],
                  cz: grip[2],
                  grabDY: (y ?? grip[1]) - vm.roofPlacement.position.y,
                })
              }}
            />
          </Suspense>
        )}
      </Show>

      <Show when={openZone}>{(zone) => <SunMarker room={zone} />}</Show>

      <Show when={vm.mode === 'floor-level'}>
        <FloorPlaneGizmo
          y={vm.floorPlaneY}
          bounds={floorPlane}
          planMode={vm.planMode}
          register={registerHandle}
          onStartDrag={(cx, cz) => setDrag({ kind: 'floor-plane', cx, cz })}
        />
      </Show>

      <Show when={ghostRect}>
        {(rect) => (
          <mesh
            position={[
              (rect.minX + rect.maxX) / 2,
              (roofPlaneY + roofTopY) / 2,
              (rect.minZ + rect.maxZ) / 2,
            ]}
            raycast={() => {}}
          >
            <boxGeometry
              args={[
                Math.max(rect.maxX - rect.minX, 0.02),
                Math.max(roofTopY - roofPlaneY, 0.02),
                Math.max(rect.maxZ - rect.minZ, 0.02),
              ]}
            />
            <meshBasicMaterial
              color={ROOF_COLOR}
              transparent
              opacity={0.3}
              depthWrite={false}
            />
          </mesh>
        )}
      </Show>

      <Show
        when={vm.planMode}
        fallback={
          <CameraControls
            ref={controlsRef}
            makeDefault
            enabled={!drag}
            minDistance={0.35}
            maxDistance={90}
            infinityDolly
            dollyToCursor
            mouseButtons={{
              left: CameraControlsImpl.ACTION.ROTATE,
              middle: CameraControlsImpl.ACTION.ROTATE,
              right: CameraControlsImpl.ACTION.TRUCK,
              wheel: CameraControlsImpl.ACTION.DOLLY,
            }}
          />
        }
      >
        <PlanCamera rootRef={buildingRootRef} resetId={vm.viewResetId} />
      </Show>
    </>
  )
}

export function EditorCanvas({ vm }: VmProps) {
  const [menu, setMenu] = useState<EditorMenuState>(null)
  const compassDial = useRef<HTMLDivElement>(null)
  // Written straight to style: this runs every frame.
  const onHeading = useCallback((bearingDeg: number) => {
    const node = compassDial.current
    if (node) node.style.transform = `rotate(${-bearingDeg}deg)`
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [14, 12, 16], fov: 50 }}
        // Without it the glb's pure metals render black.
        scene={{ environmentIntensity: 0.35 }}
        dpr={[1, 2]}
        // Per-material clipping is off by default; the storey preview cuts the
        // model with it, shadow map included.
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true
        }}
        className="touch-none"
      >
        <EditorScene vm={vm} onOpenMenu={setMenu} />
        <CompassProbe onHeading={onHeading} />
      </Canvas>
      <CompassRose dial={compassDial} />
      <button
        type="button"
        title="Bring the camera back to where it started"
        onClick={vm.onResetView}
        style={{
          position: 'absolute',
          top: 76,
          right: 12,
          zIndex: 3,
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid #2a2e34',
          background: 'rgba(17,18,21,0.72)',
          backdropFilter: 'blur(4px)',
          color: '#c8cdd4',
          font: 'inherit',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        ⟲ Reset view
      </button>
      <EditorMenuPopup menu={menu} onClose={() => setMenu(null)} />
    </div>
  )
}
