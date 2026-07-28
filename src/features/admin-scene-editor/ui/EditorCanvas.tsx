'use client'

import { CameraControls, Edges, Grid, Line, OrthographicCamera, useGLTF } from '@react-three/drei'
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
  locateOnWalls,
  mapRoomZone,
  planOpeningPlacements,
  RoomShell,
  roomVertices,
  SceneLighting,
  type OpeningPlacement,
  type RoomDoc,
  type RoomZone,
  type WallSide,
} from '@/entities/building'
import { createNodeResolver, isTreeVisible, nodePathOf } from '@/shared/three/node-path'
import { applyOverviewClipping } from '@/shared/three/overview-clipping'
import { For, Show } from '@/shared/ui/control-flow'

import { defaultYRange } from '../lib/blocks'
import { floorPlaneBounds } from '../lib/floor-plane'

import { SIDE_COLORS } from './editor-styles'

import {
  sameBlockRef,
  type BlockRef,
  type EditorBox,
  type ModelNode,
  type SceneEditorVm,
} from '../model/use-scene-editor-model'

import { CompassProbe, CompassRose } from './canvas/Compass'
import { FloorPlaneGizmo } from './canvas/FloorPlaneGizmo'
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

type VmProps = { vm: SceneEditorVm }

/** Roof volumes are the only blocks left, so one colour says it all. */
const ROOF_COLOR = '#ef4444'

/**
 * What the real building fades to while a room is open.
 *
 * Shared and module-level so swapping it in costs one assignment per mesh. It
 * stays raycastable on purpose: "take the floor level from this surface" needs
 * something to hit.
 */
const GHOST_MATERIAL = new MeshBasicMaterial({
  color: '#94a3b8',
  transparent: true,
  opacity: 0.12,
  depthWrite: false,
  side: DoubleSide,
  toneMapped: false,
})

/** Which box corner a handle controls: [xSide, zSide] as min/max keys. */
type CornerId = 0 | 1 | 2 | 3

/** The opening as it was when the drag started, so every frame is absolute. */
type OpeningDragBase = { along: number; width: number; height: number; sill: number }

type DragState =
  | { kind: 'create-block'; startX: number; startZ: number }
  | { kind: 'floor-plane'; cx: number; cz: number }
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

/** Below this an opening is a slot, not an opening — and the shell drops it. */
const MIN_OPENING = 0.1

type RoomOpeningPatch = { along: number; width: number; height: number; sill: number }

/** All editor drags land on a 5cm grid — precise enough, never "almost". */
const GRID = 0.05
function snap(value: number): number {
  return Math.round(value / GRID) * GRID
}

/** Editor tools react to the left button only — middle/right always drive the camera. */
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

/** Intersection of a pointer ray with the horizontal plane y = h. */
function rayAtY(ray: Ray, h: number): { x: number; z: number } | null {
  if (Math.abs(ray.direction.y) < 1e-6) return null
  const t = (h - ray.origin.y) / ray.direction.y
  if (t < 0) return null
  return { x: ray.origin.x + ray.direction.x * t, z: ray.origin.z + ray.direction.z * t }
}

/**
 * Where the pointer ray crosses the vertical plane of a wall.
 *
 * Unlike `rayAtVertical`, which uses a plane that always faces the camera,
 * this one uses the wall's own plane — an opening only slides within its wall,
 * so that is the surface the drag has to be measured on.
 */
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
  const { scene } = useGLTF(vm.modelUrl ?? '', false, true)
  const preparedRef = useRef<Object3D>(null)

  const { prepared, controller, resolveNode } = useMemo(() => {
    scene.updateMatrixWorld(true)
    return {
      prepared: scene,
      controller: applyOverviewClipping(scene),
      resolveNode: createNodeResolver(scene),
    }
  }, [scene])

  // Node paths are plain child-index paths into the loaded glb — the model is
  // never modified, so a path always resolves to the object it names.
  const resolveAny = useCallback(
    (path: string): Object3D | null => resolveNode(path),
    [resolveNode],
  )

  useEffect(() => {
    resolveRef.current = resolveAny
  }, [resolveAny, resolveRef])

  // Unmissable highlight of the selected model objects: glowing clones drawn
  // on top of everything (a thin bbox alone was too easy to overlook). The
  // primary (last-selected) object glows stronger than the rest. Depends on
  // the outliner list so it re-resolves after cuts rebuild the parts.
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
    vm.onModelHeight(Math.max(bounds.max.y, 2.5))

    // 2) Flatten the glb scene graph for the outliner, with world-space AABBs
    // computed bottom-up (one pass, no repeated subtree traversals).
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
    // Many exporters leave nodes unnamed — fall back to the material name
    // (often meaningful) or a numbered label, never an empty row.
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
    // Debug affordance: the flattened outliner (paths + world AABBs) is what
    // room tracing works from — exposing it lets a headless session inspect
    // exactly what the editor sees.
    ;(window as unknown as { __editorNodes?: ModelNode[] }).__editorNodes = nodes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared])

  // Objects the admin removed from the scene are never rendered, in any mode.
  useEffect(() => {
    const removed: Object3D[] = []
    for (const path of vm.hiddenNodePaths) {
      const object = resolveAny(path)
      if (object) {
        object.visible = false
        removed.push(object)
      }
    }
    return () => {
      for (const object of removed) object.visible = true
    }
  }, [vm.hiddenNodePaths, resolveAny])

  // In room mode the generated room IS the scene and the glb is a backdrop, so
  // the ghost effect below owns its appearance and the clipping shader steps
  // out of the way entirely.
  const ghost = vm.roomMode && vm.ghostModel
  const hiddenInRoom = vm.roomMode && !vm.ghostModel

  useEffect(() => {
    // Through the ref, not the memo: the scene object belongs to the loader
    // cache, and the compiler is right that writing to it during render-time
    // values is a trap. By effect time the primitive has attached it here.
    const root = preparedRef.current
    if (!root) return

    root.visible = !hiddenInRoom
    if (!ghost) return

    const saved = new Map<Mesh, Material | Material[]>()
    root.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      saved.set(mesh, mesh.material)
      mesh.material = GHOST_MATERIAL
    })

    return () => {
      for (const [mesh, material] of saved) mesh.material = material
      root.visible = true
    }
  }, [prepared, ghost, hiddenInRoom])

  useFrame(() => {
    const draft = vm.draft
    if (!draft || vm.roomMode) return

    // 2D plan: slice the building horizontally (classic floor-plan cut) so
    // the room layout is visible from straight above.
    if (vm.planMode) {
      const cutY = Math.min(1.6, Math.max(1.2, vm.modelHeight * 0.5))
      controller.setHideBoxes([{ min: [-500, cutY, -500], max: [500, 500, 500] }])
      return
    }

    controller.setHideBoxes(
      vm.roofHidden ? (draft.sceneConfig?.roofBlocks ?? []).map(toZone) : [],
    )
  })

  return (
    <>
      {/* Clicks cycle through EVERYTHING under the cursor — zone blocks and
          real model objects alike — via the unified pick handler. */}
      <primitive ref={preparedRef} object={prepared} onClick={onPick} />
      <For each={overlays} getKey={(_, i) => i}>
        {(object) => <primitive object={object} />}
      </For>
    </>
  )
}

/**
 * The generated room, previewed from the UNSAVED draft.
 *
 * Rendered with the very same component the client uses, so what the admin
 * tunes here is literally what a visitor will see — the old preview mirrored
 * the client's logic by hand and drifted from it.
 *
 * It also doubles as the placement surface: a click reports back the wall and
 * the distance along it, which is exactly how openings are addressed.
 */
/** How far off a wall a click may land and still count as hitting it. */
const OPENING_PICK_SLACK = 0.2

/**
 * Which opening a click on the shell landed in.
 *
 * All three axes of the wall's own frame are checked, including the one across
 * the wall. Leaving that one out looks like it works — the rectangle test still
 * passes — but the projection of a point onto SOME OTHER wall's tangent can land
 * inside that wall's opening, so clicking a door picks a door on the far side
 * of the room.
 */
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
  zone: RoomZone
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

        // Selecting is the only other thing a click on the shell does. Sliding
        // an opening used to be "hold the button down anywhere on the wall",
        // which moved things nobody meant to touch; it has handles now.
        event.stopPropagation()
        onSelect(openingAt(placements, event.point)?.opening.id ?? null)
      }}
    >
      <RoomShell room={zone} />
    </group>
  )
}

/** Outline edges paired with the wall each belongs to, for colour coding. */
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

/** The level a room is authored at — its own, or zero before it has one. */
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
  selected,
  onPick,
}: {
  box: EditorBox
  blockRef: BlockRef
  selected: boolean
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

  // Edges-first look: bright wireframe + a whisper of fill so the volume
  // reads without covering the model.
  return (
    <mesh position={center} userData={{ blockRef }} onClick={onPick}>
      <boxGeometry args={size} />
      <meshBasicMaterial
        color={ROOF_COLOR}
        transparent
        opacity={selected ? 0.1 : 0.04}
        depthWrite={false}
      />
      <Edges color={ROOF_COLOR} threshold={15} scale={1} renderOrder={2}>
        <lineBasicMaterial
          color={selected ? '#ffffff' : ROOF_COLOR}
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
      {/* move handle — bottom center puck */}
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

      {/* corner handles on top and bottom rings — resize X/Z like any editor */}
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

      {/* height handles — arrows above/below the box center */}
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

/**
 * 2D plan camera: a true orthographic top-down view. Clicks land exactly on
 * the point you aim at — this is the mode for outlining room polygons.
 * Deliberately NOT camera-controls: pan (middle/right drag) and zoom (wheel)
 * are implemented directly, so the view can never tilt or hit gimbal quirks.
 */
const PlanCamera = memo(function PlanCamera({
  rootRef,
}: {
  rootRef: MutableRefObject<Object3D | null>
}) {
  const cameraRef = useRef<ThreeOrthographicCamera>(null)
  const { gl } = useThree()
  const [frame, setFrame] = useState<{ x: number; z: number; span: number } | null>(null)

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
  }, [rootRef])

  // Initial placement: centered over the building, zoomed to fit.
  useEffect(() => {
    const camera = cameraRef.current
    if (!camera || !frame) return
    camera.position.set(frame.x, 60, frame.z)
    const rect = gl.domElement.getBoundingClientRect()
    camera.zoom = Math.min(rect.width, rect.height) / (frame.span * 1.25)
    camera.updateProjectionMatrix()
  }, [frame, gl])

  // Pan with middle/right drag, zoom with the wheel. Left stays with tools.
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
  const handleMapRef = useRef(new Map<Object3D, (ray: Ray) => void>())
  const lastDragEndRef = useRef(0)
  const rightDownRef = useRef<{ x: number; y: number } | null>(null)
  const contextMenuRef = useRef<(event: MouseEvent) => void>(() => {})
  // Click cycling remembers the last pick so repeated clicks on overlapping
  // blocks/objects walk through all of them.
  const lastPickKeyRef = useRef<string | null>(null)

  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new Raycaster(), [])
  const pointerNdc = useMemo(() => new Vector2(), [])

  const registerHandle = useCallback<RegisterHandle>((mesh, begin) => {
    handleMapRef.current.set(mesh, begin)
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
      // In 2D plan mode there is no orbit camera — a snapshot from straight
      // above would make a useless client preset, so refuse politely.
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

  const draft = vm.draft
  const rooms = draft?.rooms ?? []

  // The open room, mapped once: the preview renders it, clicks are hit-tested
  // against it, and the opening gizmo is positioned from it.
  const openRoom = vm.roomMode ? (rooms[vm.selectedRoomIndex as number] ?? null) : null
  const openZone = useMemo(
    () => (openRoom ? mapRoomZone(openRoom) : null),
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
  /** Roof volumes are drawn, dragged and previewed at roof height. */
  const [roofPlaneY, roofTopY] = defaultYRange(vm.modelHeight)

  const blockFor = (ref: BlockRef): EditorBox | null =>
    (draft?.sceneConfig?.roofBlocks ?? [])[ref.index] ?? null

  // ---- pointer-down capture layer -----------------------------------------
  // Runs before camera-controls and the R3F event layer. Gives gizmo handles
  // absolute priority and starts block-creation drags; middle/right presses
  // re-pivot the camera around whatever is under the cursor (Blender-style
  // auto depth), which keeps orbit/pan/zoom speed consistent at any zoom.
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

    // 1) Handles always win — even inside another block's volume.
    const handles = [...handleMapRef.current.keys()]
    if (handles.length) {
      const hit = raycaster.intersectObjects(handles, false)[0]
      if (hit) {
        event.preventDefault()
        event.stopImmediatePropagation()
        handleMapRef.current.get(hit.object)?.(ray)
        return
      }
    }

    // 2) Roof volumes are dragged out AT roof height. Dragging them at world
    // zero meant the rectangle you drew was nowhere near the box you got.
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

  // ---- right-click context menu -------------------------------------------
  // A right CLICK (release without dragging — right-drag stays pan) opens an
  // editor menu for whatever is under the cursor: model objects (hide/show,
  // attach) and the current block selection (group/ungroup/delete).
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
      // Right-clicking an unselected object selects it; the shared builder
      // reads the still-uncommitted selection, so it correctly scopes the
      // menu to just this node in that case (and to the whole multi-selection
      // when the node is already part of it).
      if (!vm.selectedNodePaths.includes(nodePath)) vm.onSelectNodeByPath(nodePath)
      items.push(...nodeMenuItems(vm, nodePath))
    }

    if (vm.selectedBlock) items.push(...blockMenuItems(vm, vm.selectedBlock))

    if (items.length) onOpenMenu({ x: event.clientX, y: event.clientY, items })
  }

  // ---- dragging ------------------------------------------------------------

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
      // patchDraft's 300 ms checkpoint throttle collapses the whole drag into
      // a single undo step, so this can fire every frame.
      vm.onSetFloorLevel(snap(y))
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
          // The far jamb stays put: the near one moves, so the opening's start
          // has to follow the width it just lost.
          const width = Math.max(snap(base.width - dAlong), MIN_OPENING)
          patch.width = width
          patch.along = Math.max(base.along + (base.width - width), 0)
          break
        }
        case 'head':
          patch.height = Math.max(snap(base.height + dUp), MIN_OPENING)
          break
        case 'sill': {
          // Raising the sill lowers the head by the same amount, so the top of
          // the opening stays where it is.
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
      // On the room's own level, not the world's: dragging a corner across a
      // plane a metre below the floor makes the handle slide away from the
      // cursor at any oblique angle.
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
      // updateBlock normalizes min/max, so dragging a corner past the
      // opposite one just flips the box instead of breaking it.
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

  // ---- keyboard ------------------------------------------------------------
  // Delete removes the selected block, Esc exits the tool/selection,
  // Ctrl+Z undoes, F frames the selection (block → room → whole building).
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
        // Model objects can't be deleted from the glb — Delete hides them
        // (persisted, applied in the client too).
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

  // Latest-handler refs, written after every commit (never during render):
  // the stable DOM listeners above always see fresh state through them.
  useEffect(() => {
    pointerDownRef.current = handlePointerDownCapture
    applyDragRef.current = applyDrag
    endDragRef.current = endActiveDrag
    keyDownRef.current = handleEditorKeyDown
    contextMenuRef.current = handleContextMenuCapture
  })

  // ---- clicks (R3F layer) ---------------------------------------------------

  /**
   * Unified click selection with cycling over EVERYTHING under the cursor —
   * zone blocks AND real model objects, nearest first. Clicking the same spot
   * again walks to the next candidate, so overlapping volumes, wall shells
   * and the doors behind them are all reachable by just clicking again.
   * Shift+click toggles multi-selection; Ctrl+click cycles model objects only.
   */
  const handleScenePick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 4) return
    if (performance.now() - lastDragEndRef.current < 200) return

    // Picking the floor level is a question about the model, not about the
    // editor's own overlays: whatever surface you clicked, its height IS the
    // answer. That is the whole mechanism — no measuring, no typing.
    if (vm.mode === 'pick-floor-y') {
      event.stopPropagation()
      vm.onPickFloorY(event.point.y)
      return
    }

    // The ghost is raycastable so the floor-level pick can hit it — but it
    // must not answer ordinary selection clicks inside a room.
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
        const key = `b:${blockRef.index}`
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
    if (vm.mode === 'draw-room') setCursor({ x: event.point.x, z: event.point.z })
  }

  const handleGroundPointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (drag || event.delta > 4 || !isPrimaryButton(event)) return
    if (performance.now() - lastDragEndRef.current < 200) return
    // Empty ground carries no floor level worth taking.
    if (vm.mode === 'pick-floor-y') return
    if (vm.mode === 'select') {
      // Inside a room, empty floor is just empty floor: the only way out is
      // the Back button, so a misplaced click cannot throw the work away.
      if (vm.roomMode) {
        vm.onSelectBlock(null)
        lastPickKeyRef.current = null
        return
      }

      // In the building, a floor click opens the room under the cursor —
      // no need to aim at the small centre puck.
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

  const showFloorPlane =
    vm.roomMode || vm.mode === 'draw-room' || vm.mode === 'pick-floor-y'


  // Whatever is being worked on: this room's outline, the one being traced,
  // or — with nothing drawn yet — a patch around the building itself.
  const activeRoom = vm.selectedRoomIndex === null ? null : rooms[vm.selectedRoomIndex]
  const planePoints = vm.roomMode
    ? ((activeRoom?.floorPolygon ?? []) as Array<{ x: number; z: number }>)
    : vm.drawingPoints
  const floorPlane = floorPlaneBounds(planePoints, vm.roomMode ? 0.6 : 1.5, {
    minX: -6,
    minZ: -6,
    maxX: 6,
    maxZ: 6,
  })

  return (
    <>
      <color attach="background" args={['#1c1e22']} />
      {/* The client's rig, turned up. The room half is lit for mood — dim
          enough that a shaft of daylight is the brightest thing in frame —
          which is right for a visitor and far too dark to author against.
          Shadows are off on this Canvas, so the sun lights without dropping any. */}
      {/* The client's rig at the client's strength, so a finish judged here is
          the finish the visitor gets. It used to run at 2.2x to claw back a
          room rig that was too dim to author against; the rig is evenly lit
          now, so turning it up would only mean the two disagree. */}
      <SceneLighting bounds={null} focusedRoom={openZone} />
      {/* Ground reference for the building. Inside a room the floor plane is
          the reference, and this one only shows through the ghost as noise. */}
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

      {/* Ground interaction plane (clicks + draw-room cursor preview only —
          drags are handled at the window level). It rides at the room's own
          floor level so a drawn point lands where the cursor is even when the
          view is oblique. */}
      <mesh
        position={[0, vm.floorPlaneY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handleGroundPointerMove}
        onPointerUp={handleGroundPointerUp}
      >
        <planeGeometry args={[300, 300]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Selected glb node highlight */}
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


      {/* The generated room, straight from the draft. Shown in the room
          preview and whenever an opening is being placed, since it is the
          surface those clicks land on. */}
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

      {/* The selected opening, with a handle on every edge. */}
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

      {/* Rooms. In the building every outline is drawn, so you can see the
          plan; inside a room only that room, so nothing else is in the way. */}
      <For each={rooms} getKey={(_, i) => i}>
        {(room, roomIndex) => {
          if (vm.roomMode && roomIndex !== vm.selectedRoomIndex) return null
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
              {/* Edges are coloured by the wall they belong to, so the
                  four-wall grouping is visible while drawing rather than
                  something you discover in the client. */}
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
              {/* Way into the room. Gone once you are inside it — there it
                  would only swallow clicks meant for the floor. */}
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

              {/* point + midpoint handles for the selected room */}
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

      {/* Roof volumes, and only while you are working on the building. They
          belong to the storey above the room you have open — nothing you can
          edit from in here — so in room mode they are just a red cage drawn
          around what you are trying to look at. */}
      <For
        each={vm.roomMode ? [] : (draft?.sceneConfig?.roofBlocks ?? [])}
        getKey={(_, i) => `r-${i}`}
      >
        {(block, blockIndex) => {
          const ref: BlockRef = { index: blockIndex }
          return (
            <ZoneBlockMesh
              box={block}
              blockRef={ref}
              selected={vm.selectedBlocks.some((r) => sameBlockRef(r, ref))}
              onPick={handleScenePick}
            />
          )
        }}
      </For>

      {/* Handles for the selected block */}
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

      {/* In-progress room drawing */}
      <Show when={vm.mode === 'draw-room' && vm.drawingPoints.length > 0}>
        <For each={vm.drawingPoints} getKey={(_, i) => i}>
          {(point, i) => (
            <ScreenScaled position={[point.x, vm.floorPlaneY + 0.08, point.z]}>
              <mesh>
                <sphereGeometry args={[i === 0 ? 0.12 : 0.08, 16, 16]} />
                <meshBasicMaterial color={i === 0 ? '#fb923c' : '#fde047'} />
              </mesh>
            </ScreenScaled>
          )}
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

      {/* The floor level, as something you can see and grab. Visible while a
          room is open and while one is being traced — the two moments where
          "how high is this?" is the question being answered. */}
      {/* Which side the daylight is coming from, while you are setting it. */}
      <Show when={openZone}>{(zone) => <SunMarker room={zone} />}</Show>

      <Show when={showFloorPlane}>
        <FloorPlaneGizmo
          y={vm.floorPlaneY}
          bounds={floorPlane}
          planMode={vm.planMode}
          register={registerHandle}
          onStartDrag={(cx, cz) => setDrag({ kind: 'floor-plane', cx, cz })}
        />
      </Show>

      {/* Block creation ghost */}
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

      {/* 2D plan: fixed top-down orthographic camera. 3D: free orbit camera —
          middle mouse orbits (with Blender-style auto depth), right pans,
          wheel zooms toward the cursor and never stalls (infinityDolly). */}
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
        <PlanCamera rootRef={buildingRootRef} />
      </Show>
    </>
  )
}

export function EditorCanvas({ vm }: VmProps) {
  const [menu, setMenu] = useState<EditorMenuState>(null)
  const compassDial = useRef<HTMLDivElement>(null)
  // Turn the dial against the camera, so north stays north on screen. Written
  // straight to the style: this runs every frame, and a re-render per frame to
  // move a needle is not a trade worth making.
  const onHeading = useCallback((bearingDeg: number) => {
    const node = compassDial.current
    if (node) node.style.transform = `rotate(${-bearingDeg}deg)`
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [14, 12, 16], fov: 50 }}
        // Matches the client: the environment carries the soft light, and
        // without it the glb's pure metals render black here too.
        scene={{ environmentIntensity: 0.35 }}
        dpr={[1, 2]}
        className="touch-none"
      >
        <EditorScene vm={vm} onOpenMenu={setMenu} />
        <CompassProbe onHeading={onHeading} />
      </Canvas>
      <CompassRose dial={compassDial} />
      <EditorMenuPopup menu={menu} onClose={() => setMenu(null)} />
    </div>
  )
}
