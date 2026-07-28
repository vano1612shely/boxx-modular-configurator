'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  computeSideAxes,
  autoAssignSides,
  reanchorOpenings,
  rectifyPolygon,
  roomOpenings,
  roomVertices,
  zoneNodePaths,
  type OpeningFit,
  type OpeningKind,
  type RoomOpening,
  type RoomVertex,
  type SunDirection,
  type TexturedSurface,
  type WallSide,
} from '@/entities/building'
import { SHELL_DEFAULTS } from '@/modules/shared/room-shell'

import {
  defaultYRange,
  normalizeBox,
  sameBlockRef,
  type BlockRef,
  type EditorBox,
} from '../lib/blocks'
import type { BuildingModel, Model } from '@/payload-types'

/**
 * Zone-based editor state. The admin never types coordinates: rooms are drawn
 * point-by-point on the floor, wall/ceiling/roof volumes are dragged out as
 * boxes, cameras are captured from the current viewport.
 */

export type EditorMode =
  | 'select'
  | 'draw-room'
  | 'block-roof'
  /** Click a generated wall to drop a door or window on it. */
  | 'place-opening'
  /** Click the model itself to take the room's floor level from it. */
  | 'pick-floor-y'

export { defaultYRange, sameBlockRef }
export type { BlockRef, EditorBox }

export type CameraSnapshot = {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
}

type Draft = Pick<BuildingModel, 'sceneConfig' | 'rooms'>
type DraftRoom = NonNullable<Draft['rooms']>[number]

/** One node of the loaded glb scene graph, flattened for the outliner. */
export type ModelNode = {
  id: number
  parentId: number | null
  name: string
  kind: 'mesh' | 'group'
  depth: number
  hasChildren: boolean
  /** Child-index path from the model root ("2/0/5") — the stable id used to
   * attach this object to zone blocks. */
  path: string
  /** World-space AABB of the node's subtree (null when empty). */
  box: EditorBox | null
}

function modelUrlOf(model: number | Model | null | undefined): string | null {
  return typeof model === 'object' && model?.url ? model.url : null
}


export function useSceneEditorModel() {
  const { id } = useDocumentInfo()

  const [doc, setDoc] = useState<BuildingModel | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [mode, setMode] = useState<EditorMode>('select')
  const [drawingPoints, setDrawingPoints] = useState<Array<{ x: number; z: number }>>([])
  /**
   * Height a NOT-yet-existing room is drawn at.
   *
   * y = 0 is the bottom of the glb, which on a modular building is the
   * underside of the chassis — nowhere near a floor anybody walks on. Once a
   * room exists this is superseded by its own `shell.floorY`.
   */
  const [drawFloorY, setDrawFloorY] = useState(0)
  const [selectedRoomIndex, setSelectedRoomIndex] = useState<number | null>(null)
  /** A room is open for editing — the sidebar and the canvas both scope to it. */
  const roomMode = selectedRoomIndex !== null
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null)
  /** Kind placed by the next click in `place-opening` mode. */
  const [openingKind, setOpeningKind] = useState<OpeningKind>('door')
  const openingSeq = useRef(1)
  // Multi-select: shift+click accumulates; the LAST ref is the primary one
  // (it gets the gizmo handles and the numeric panel).
  const [selectedBlocks, setSelectedBlocks] = useState<BlockRef[]>([])
  const selectedBlock = selectedBlocks.length
    ? selectedBlocks[selectedBlocks.length - 1]
    : null
  const setSelectedBlock = useCallback((ref: BlockRef | null) => {
    setSelectedBlocks(ref ? [ref] : [])
  }, [])
  const [modelNodes, setModelNodes] = useState<ModelNode[]>([])
  // Model-object selection mirrors block selection: shift+click accumulates,
  // the LAST path is the primary one (highlight overlay + selection panel).
  const [selectedNodePaths, setSelectedNodePaths] = useState<string[]>([])
  /** Overview: is the roof taken away so you can see the plan? */
  const [roofHidden, setRoofHidden] = useState(true)
  /** Room mode: is the real glb still faintly there behind the generated room? */
  const [ghostModel, setGhostModel] = useState(true)
  const [planMode, setPlanMode] = useState(false)
  const [modelHeight, setModelHeight] = useState(3.2)
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const cameraGetterRef = useRef<(() => CameraSnapshot | null) | null>(null)

  // Coarse undo checkpoints: at most one snapshot per 300ms, so a drag
  // becomes a single undo step instead of hundreds.
  const draftRef = useRef<Draft | null>(null)
  const historyRef = useRef<Draft[]>([])
  const lastCheckpointAt = useRef(0)

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    if (!id) return

    const load = async () => {
      const response = await fetch(`/api/building-models/${id}?depth=1`, {
        credentials: 'include',
      })
      const docJson = (await response.json()) as BuildingModel

      setDoc(docJson)
      setDraft({
        sceneConfig: docJson.sceneConfig ?? {},
        rooms: docJson.rooms ?? [],
      })
    }

    void load()
  }, [id])

  const patchDraft = useCallback((update: (draft: Draft) => Draft) => {
    const now = Date.now()
    if (draftRef.current && now - lastCheckpointAt.current > 300) {
      historyRef.current.push(draftRef.current)
      if (historyRef.current.length > 50) historyRef.current.shift()
      lastCheckpointAt.current = now
    }

    setDraft((current) => (current ? update(current) : current))
    setDirty(true)
    setSaveState('idle')
  }, [])

  const undo = useCallback(() => {
    const previous = historyRef.current.pop()
    if (!previous) return
    setDraft(previous)
    setDirty(true)
    setSaveState('idle')
  }, [])

  const patchRoom = useCallback(
    (roomIndex: number, update: (room: DraftRoom) => DraftRoom) => {
      patchDraft((d) => ({
        ...d,
        rooms: (d.rooms ?? []).map((room, i) => (i === roomIndex ? update(room) : room)),
      }))
    },
    [patchDraft],
  )

  const snapshotCamera = (): CameraSnapshot | null => cameraGetterRef.current?.() ?? null

  // ---- rooms (polygon) ----

  const finishRoomDrawing = () => {
    if (drawingPoints.length < 3) return

    const centroidX = drawingPoints.reduce((s, p) => s + p.x, 0) / drawingPoints.length
    const centroidZ = drawingPoints.reduce((s, p) => s + p.z, 0) / drawingPoints.length
    const nextIndex = draft?.rooms?.length ?? 0

    patchDraft((d) => ({
      ...d,
      rooms: [
        ...(d.rooms ?? []),
        {
          key: `room-${nextIndex + 1}`,
          name: `Room ${nextIndex + 1}`,
          roomType: 'office',
          // Rectified on close: hand-drawn outlines wobble 5-15cm off-axis,
          // which would make every edge look diagonal to the wall assignment.
          floorPolygon: rectifyPolygon(drawingPoints.map((p) => ({ x: p.x, z: p.z }))).map(
            (p, i, all) => ({ ...p, side: autoAssignSides(all)[i] }),
          ),
          shell: {
            floorY: drawFloorY,
            wallHeight: SHELL_DEFAULTS.wallHeight,
            wallThickness: SHELL_DEFAULTS.wallThickness,
            floorThickness: SHELL_DEFAULTS.floorThickness,
            ceilingThickness: SHELL_DEFAULTS.ceilingThickness,
            sideAxes: null,
          },
          openings: [],
          cameraPreset: {
            position: { x: centroidX, y: drawFloorY + 6, z: centroidZ + 4 },
            target: { x: centroidX, y: drawFloorY + 0.6, z: centroidZ },
          },
        },
      ],
    }))
    setDrawingPoints([])
    setMode('select')
    setSelectedRoomIndex(nextIndex)
  }

  // ---- generated room shell ----

  /**
   * Rewrites a room's outline, keeping everything anchored to it in step.
   *
   * Openings are addressed by arc length along their wall, so ANY outline edit
   * moves them unless they are re-anchored by world position — drag one corner
   * and every door on the room would slide. The outward wall axes are
   * recomputed for the same reason: they decide what the dollhouse hides.
   */
  const withPolygon = (room: DraftRoom, vertices: RoomVertex[]): DraftRoom => {
    const previous = roomVertices(room)
    const openings = roomOpenings(room.openings)

    return {
      ...room,
      floorPolygon: vertices.map((v) => ({ x: v.x, z: v.z, side: v.side })),
      openings:
        previous.length >= 3 && vertices.length >= 3
          ? reanchorOpenings(previous, vertices, openings)
          : openings,
      shell: {
        ...(room.shell ?? {}),
        sideAxes: vertices.length >= 3 ? computeSideAxes(vertices) : null,
      },
    }
  }

  const patchPolygon = (roomIndex: number, update: (vertices: RoomVertex[]) => RoomVertex[]) =>
    patchRoom(roomIndex, (room) => withPolygon(room, update(roomVertices(room))))

  const patchOpenings = (
    roomIndex: number,
    update: (openings: RoomOpening[]) => RoomOpening[],
  ) => patchRoom(roomIndex, (room) => ({ ...room, openings: update(roomOpenings(room.openings)) }))

  const addOpening = (roomIndex: number, kind: OpeningKind, side: WallSide, along: number) => {
    const opening: RoomOpening = {
      // Author-generated: Payload regenerates array row ids on every save, so
      // they cannot be the identity that selection and undo hang off.
      id: `${kind}-${Math.round(along * 1000)}-${openingSeq.current++}`,
      side,
      kind,
      along,
      width: kind === 'door' ? SHELL_DEFAULTS.doorWidth : SHELL_DEFAULTS.windowWidth,
      height: kind === 'door' ? SHELL_DEFAULTS.doorHeight : SHELL_DEFAULTS.windowHeight,
      sill: kind === 'door' ? 0 : SHELL_DEFAULTS.windowSill,
    }
    patchOpenings(roomIndex, (openings) => [...openings, opening])
    setSelectedOpeningId(opening.id)
    // One click, one opening. The tool used to stay armed, so every further
    // click — including the ones you make just looking around — dropped another
    // door on the wall, and they stack invisibly on top of each other.
    setMode('select')
    return opening
  }

  // ---- roof volumes ----
  //
  // One list, one meaning: these are the volumes the client's Ceiling toggle
  // takes away. Rooms used to carry their own ceiling volumes as well, which
  // was two concepts doing one job — and the per-room half only ever made
  // sense in the overview, where no room is focused anyway.

  const roofBlocks = (d: Draft): EditorBox[] => (d.sceneConfig?.roofBlocks ?? []) as EditorBox[]

  const writeBlocks = (d: Draft, blocks: EditorBox[]): Draft => ({
    ...d,
    sceneConfig: { ...d.sceneConfig, roofBlocks: blocks },
  })

  const addBlock = (rect: { minX: number; minZ: number; maxX: number; maxZ: number }) => {
    const [yMin, yMax] = defaultYRange(modelHeight)
    const box = normalizeBox({
      min: { x: rect.minX, y: yMin, z: rect.minZ },
      max: { x: rect.maxX, y: yMax, z: rect.maxZ },
    })

    patchDraft((d) => writeBlocks(d, [...roofBlocks(d), box]))
    setSelectedBlock({ index: roofBlocks(draft!).length })
    setMode('select')
  }

  const updateBlock = (ref: BlockRef, box: EditorBox) => {
    patchDraft((d) =>
      writeBlocks(
        d,
        roofBlocks(d).map((b, i) => (i === ref.index ? { ...b, ...normalizeBox(box) } : b)),
      ),
    )
  }

  const removeBlock = (ref: BlockRef) => {
    patchDraft((d) => writeBlocks(d, roofBlocks(d).filter((_, i) => i !== ref.index)))
    setSelectedBlock(null)
  }

  // ---- hidden model objects (persisted; applied in editor AND client) ----

  const hiddenNodePaths = zoneNodePaths(draft?.sceneConfig?.hiddenNodePaths)

  const setNodeHidden = (path: string, hidden: boolean) => {
    patchDraft((d) => {
      const current = zoneNodePaths(d.sceneConfig?.hiddenNodePaths)
      if (hidden === current.includes(path)) return d
      const next = hidden ? [...current, path] : current.filter((p) => p !== path)
      return { ...d, sceneConfig: { ...d.sceneConfig, hiddenNodePaths: next } }
    })
  }

  // ---- model outliner: zones created from actual glb nodes ----

  const primaryNodePath = selectedNodePaths.length
    ? selectedNodePaths[selectedNodePaths.length - 1]
    : null
  const selectedNode = primaryNodePath
    ? (modelNodes.find((n) => n.path === primaryNodePath) ?? null)
    : null
  const selectedNodeId = selectedNode?.id ?? null

  const selectNodePath = useCallback((path: string | null) => {
    setSelectedNodePaths(path === null ? [] : [path])
  }, [])

  /** Tiny padding so meshes sitting exactly on the AABB surface are included. */
  const NODE_PAD = 0.03

  const paddedNodeBox = (box: EditorBox): EditorBox =>
    normalizeBox({
      min: { x: box.min.x - NODE_PAD, y: box.min.y - NODE_PAD, z: box.min.z - NODE_PAD },
      max: { x: box.max.x + NODE_PAD, y: box.max.y + NODE_PAD, z: box.max.z + NODE_PAD },
    })

  /**
   * A roof volume traced from real model objects: the union of their AABBs,
   * padded a little. Beats dragging a rectangle and guessing the height.
   */
  const addBlockFromNodes = (pathsOverride?: string[]) => {
    const paths = pathsOverride ?? selectedNodePaths
    const boxes = paths
      .map((path) => modelNodes.find((n) => n.path === path)?.box)
      .filter((box): box is EditorBox => Boolean(box))
    if (!boxes.length) return

    const union = boxes.reduce((acc, box) => ({
      min: {
        x: Math.min(acc.min.x, box.min.x),
        y: Math.min(acc.min.y, box.min.y),
        z: Math.min(acc.min.z, box.min.z),
      },
      max: {
        x: Math.max(acc.max.x, box.max.x),
        y: Math.max(acc.max.y, box.max.y),
        z: Math.max(acc.max.z, box.max.z),
      },
    }))
    patchDraft((d) => writeBlocks(d, [...roofBlocks(d), paddedNodeBox(union)]))
    // Land the admin where the result is.
    setSelectedBlock({ index: roofBlocks(draft!).length })
  }

  /** A room built from a floor node: its AABB footprint becomes the polygon,
   * the box itself becomes the floor volume (its top = the walking level). */
  const addRoomFromNode = (pathOverride?: string) => {
    // typeof guard: DOM onClick handlers pass the event object as the arg.
    const path = typeof pathOverride === 'string' ? pathOverride : selectedNode?.path
    const box = path ? modelNodes.find((n) => n.path === path)?.box : null
    if (!box) return

    const nextIndex = draft?.rooms?.length ?? 0
    const polygon = [
      { x: box.min.x, z: box.min.z },
      { x: box.max.x, z: box.min.z },
      { x: box.max.x, z: box.max.z },
      { x: box.min.x, z: box.max.z },
    ]
    const centerX = (box.min.x + box.max.x) / 2
    const centerZ = (box.min.z + box.max.z) / 2

    patchDraft((d) => ({
      ...d,
      rooms: [
        ...(d.rooms ?? []),
        {
          key: `room-${nextIndex + 1}`,
          name: `Room ${nextIndex + 1}`,
          roomType: 'office' as const,
          floorPolygon: polygon.map((p, i) => ({ ...p, side: autoAssignSides(polygon)[i] })),
          // The node's top face IS the walkable floor, so the generated slab
          // lands exactly on the geometry the room was traced from.
          shell: {
            floorY: box.max.y,
            wallHeight: SHELL_DEFAULTS.wallHeight,
            wallThickness: SHELL_DEFAULTS.wallThickness,
            floorThickness: SHELL_DEFAULTS.floorThickness,
            ceilingThickness: SHELL_DEFAULTS.ceilingThickness,
            sideAxes: null,
          },
          openings: [],
          cameraPreset: {
            position: { x: centerX, y: box.max.y + 5.5, z: centerZ + 4 },
            target: { x: centerX, y: box.max.y + 0.6, z: centerZ },
          },
        },
      ],
    }))
    setSelectedRoomIndex(nextIndex)
    setSelectedBlock(null)
    setMode('select')
  }

  // ---- clicks from the canvas ----

  const handleFloorClick = (x: number, z: number) => {
    if (mode === 'draw-room') {
      // Close the loop when clicking near the first point.
      const first = drawingPoints[0]
      if (first && drawingPoints.length >= 3 && Math.hypot(x - first.x, z - first.z) < 0.4) {
        finishRoomDrawing()
        return
      }
      setDrawingPoints((points) => [...points, { x, z }])
      return
    }

  }

  const save = async () => {
    if (!id || !draft) return

    setSaveState('saving')

    const response = await fetch(`/api/building-models/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })

    setDirty(!response.ok)
    setSaveState(response.ok ? 'saved' : 'error')
  }

  // A selected room authors at its own level; a room not drawn yet uses the
  // level last picked off the model.
  const selectedShell = (
    selectedRoomIndex === null ? null : draft?.rooms?.[selectedRoomIndex]?.shell
  ) as { floorY?: number | null } | null | undefined
  const floorPlaneY =
    typeof selectedShell?.floorY === 'number' ? selectedShell.floorY : drawFloorY

  /**
   * The one way the floor level changes — drag handle, nudge button, numeric
   * field and surface pick all land here.
   *
   * It also remembers the level for the NEXT room you draw, so tracing a
   * second room on the same storey needs no setup at all.
   */
  const setFloorLevel = (y: number) => {
    const level = Math.round(y * 1000) / 1000
    if (selectedRoomIndex !== null) {
      patchRoom(selectedRoomIndex, (room) => ({
        ...room,
        shell: { ...(room.shell ?? {}), floorY: level },
      }))
    }
    setDrawFloorY(level)
  }

  return {
    isLoading: !doc || !draft,
    doc,
    draft,
    modelUrl: doc ? modelUrlOf(doc.model) : null,
    mode,
    drawingPoints,
    selectedRoomIndex,
    selectedBlock,
    selectedBlocks,
    hiddenNodePaths,
    modelNodes,
    selectedNodeId,
    selectedNode,
    selectedNodePaths,
    roomMode,
    roofHidden,
    ghostModel,
    planMode,
    modelHeight,
    dirty,
    saveState,
    // The canvas registers a live camera-snapshot getter here (a plain
    // callback, not an exposed ref — vm consumers never mutate vm).
    onRegisterCameraGetter: (getter: (() => CameraSnapshot | null) | null) => {
      cameraGetterRef.current = getter
    },

    onSetMode: (next: EditorMode) => {
      setMode(next)
      setDrawingPoints([])
      if (next !== 'select') setSelectedBlock(null)
      // Room outlines are drawn on the 2D plan — points land exactly under
      // the cursor there, so switch to it automatically.
      if (next === 'draw-room') setPlanMode(true)
      // Nothing to click if the model is hidden: R3F skips invisible objects,
      // so arming the pick has to bring the ghost back.
      if (next === 'pick-floor-y') setGhostModel(true)
    },
    onSetPlanMode: setPlanMode,
    onUndo: undo,
    // Esc peels the selection off in steps: tool → block → objects → room,
    // so "show all rooms again" is always a few presses away.
    onEscape: () => {
      setDrawingPoints([])
      if (mode !== 'select') {
        setMode('select')
        return
      }
      if (selectedBlock) {
        setSelectedBlock(null)
        return
      }
      setSelectedNodePaths([])
      // Deliberately does NOT leave room mode: the way out is the Back button,
      // so a stray Esc cannot dump you back to the building mid-edit.
    },
    onModelHeight: setModelHeight,
    onEnterRoom: (index: number) => {
      setSelectedRoomIndex(index)
      setSelectedBlock(null)
      // Model objects belong to the building, not to a room.
      setSelectedNodePaths([])
      setMode('select')
    },
    onExitRoom: () => {
      setSelectedRoomIndex(null)
      setSelectedBlock(null)
      setSelectedOpeningId(null)
      setDrawingPoints([])
      setMode('select')
    },
    onSelectBlock: setSelectedBlock,
    onToggleBlockSelection: (ref: BlockRef) =>
      setSelectedBlocks((current) => {
        const without = current.filter((r) => !sameBlockRef(r, ref))
        return without.length === current.length ? [...current, ref] : without
      }),
    onModelNodes: setModelNodes,
    onSelectNode: (id: number | null) =>
      selectNodePath(id === null ? null : (modelNodes.find((n) => n.id === id)?.path ?? null)),
    onSelectNodeByPath: selectNodePath,
    onToggleNodeSelection: (path: string) =>
      setSelectedNodePaths((current) => {
        const without = current.filter((p) => p !== path)
        return without.length === current.length ? [...current, path] : without
      }),
    onHideNode: (path: string) => setNodeHidden(path, true),
    onShowNode: (path: string) => setNodeHidden(path, false),
    onAddBlockFromNodes: addBlockFromNodes,
    onAddRoomFromNode: addRoomFromNode,
    onSetRoofHidden: setRoofHidden,
    onSetGhostModel: setGhostModel,
    onFloorClick: handleFloorClick,
    onFinishRoom: finishRoomDrawing,
    onCancelDrawing: () => {
      setDrawingPoints([])
      setMode('select')
    },
    onAddBlock: addBlock,
    onUpdateBlock: updateBlock,
    onRemoveBlock: removeBlock,
    onUpdateRoomPoint: (roomIndex: number, pointIndex: number, x: number, z: number) =>
      patchPolygon(roomIndex, (vertices) =>
        vertices.map((v, i) => (i === pointIndex ? { ...v, x, z } : v)),
      ),
    onInsertRoomPoint: (roomIndex: number, edgeIndex: number, x: number, z: number) =>
      patchPolygon(roomIndex, (vertices) => {
        const next = [...vertices]
        // The new point inherits the wall of the edge it splits — otherwise
        // splitting a wall in two would hand half of it to another wall.
        next.splice(edgeIndex + 1, 0, { x, z, side: vertices[edgeIndex]?.side ?? 'w1' })
        return next
      }),
    onRemoveRoomPoint: (roomIndex: number, pointIndex: number) =>
      patchPolygon(roomIndex, (vertices) =>
        vertices.length > 3 ? vertices.filter((_, i) => i !== pointIndex) : vertices,
      ),

    // ---- generated shell ----
    selectedOpeningId,
    openingKind,
    onSelectOpening: setSelectedOpeningId,
    onSetOpeningKind: setOpeningKind,
    onUpdateShell: (roomIndex: number, patch: Record<string, number | SunDirection | null>) =>
      patchRoom(roomIndex, (room) => ({
        ...room,
        shell: { ...(room.shell ?? {}), ...patch },
      })),
    /**
     * The height room authoring happens at.
     *
     * The outline, its handles and the click plane all live here rather than
     * at y = 0: the glb's own zero is the underside of the building, so a
     * polygon drawn there floats a metre below the floor it describes.
     */
    floorPlaneY,
    /** Takes the floor level from wherever on the model the admin clicked. */
    onSetFloorLevel: setFloorLevel,
    onNudgeFloorLevel: (delta: number) => setFloorLevel(floorPlaneY + delta),
    /** One-shot: take the level off whatever model surface gets clicked. */
    onPickFloorY: (y: number) => {
      setFloorLevel(y)
      setMode('select')
    },
    onAutoAssignSides: (roomIndex: number) =>
      patchPolygon(roomIndex, (vertices) => {
        const sides = autoAssignSides(vertices)
        return vertices.map((v, i) => ({ ...v, side: sides[i] }))
      }),
    onSetVertexSide: (roomIndex: number, vertexIndex: number, side: WallSide) =>
      patchPolygon(roomIndex, (vertices) =>
        vertices.map((v, i) => (i === vertexIndex ? { ...v, side } : v)),
      ),
    onAddOpening: addOpening,
    onUpdateOpening: (roomIndex: number, id: string, patch: Partial<RoomOpening>) =>
      patchOpenings(roomIndex, (openings) =>
        openings.map((opening) => (opening.id === id ? { ...opening, ...patch } : opening)),
      ),
    onRemoveOpening: (roomIndex: number, id: string) => {
      patchOpenings(roomIndex, (openings) => openings.filter((opening) => opening.id !== id))
      setSelectedOpeningId((current) => (current === id ? null : current))
    },
    /**
     * The 3D door or window this room uses, and how it sits in the wall.
     *
     * Per kind rather than per opening: it describes the source file — which
     * way it was authored, how deep it seats — and every door in a room is the
     * same door. Individual swings are `yawDeg`/`mirror` on the opening.
     */
    onSetOpeningModel: (
      roomIndex: number,
      kind: OpeningKind,
      patch: {
        /**
         * The populated relationship, not a bare id — the viewport previews
         * the DRAFT, and an id alone carries no URL to load a glb from, so
         * picking a door would show nothing until the next save and reload.
         * Payload takes the id off a populated object on write.
         */
        model?: { id: number; url?: string | null } | null
        fit?: OpeningFit
        yawDeg?: number
        depth?: number
      },
    ) =>
      patchRoom(roomIndex, (room) => {
        const models = room.openingModels ?? {}
        return {
          ...room,
          openingModels: { ...models, [kind]: { ...(models[kind] ?? {}), ...patch } },
        } as DraftRoom
      }),
    onSetSurface: (
      roomIndex: number,
      surface: TexturedSurface,
      patch: {
        /** Populated, not a bare id — see `onSetOpeningModel` for why. */
        texture?: { id: number; url?: string | null } | null
        tileWidth?: number
        tileHeight?: number
      },
    ) =>
      patchRoom(roomIndex, (room) => {
        const surfaces = (room.surfaces ?? {}) as Record<string, unknown>
        return {
          ...room,
          surfaces: {
            ...surfaces,
            [surface]: { ...((surfaces[surface] as object) ?? {}), ...patch },
          },
        } as DraftRoom
      }),
    onUpdateRoom: (index: number, update: Partial<DraftRoom>) =>
      patchRoom(index, (room) => ({ ...room, ...update })),
    onSetRoomCameraFromView: (index: number) => {
      const snapshot = snapshotCamera()
      if (snapshot) patchRoom(index, (room) => ({ ...room, cameraPreset: snapshot }))
    },
    onRemoveRoom: (index: number) => {
      patchDraft((d) => ({ ...d, rooms: (d.rooms ?? []).filter((_, i) => i !== index) }))
      setSelectedRoomIndex(null)
      setSelectedBlock(null)
    },
    onSetDefaultCameraFromView: () => {
      const snapshot = snapshotCamera()
      if (!snapshot) return
      patchDraft((d) => ({
        ...d,
        sceneConfig: { ...d.sceneConfig, camera: { ...d.sceneConfig?.camera, ...snapshot } },
      }))
    },
    onSetCameraLimits: (
      limits: Partial<{
        minDistance: number
        maxDistance: number
        minPolarDeg: number
        maxPolarDeg: number
        fov: number
      }>,
    ) =>
      patchDraft((d) => ({
        ...d,
        sceneConfig: { ...d.sceneConfig, camera: { ...d.sceneConfig?.camera, ...limits } },
      })),
    onSave: save,
  }
}

export type SceneEditorVm = ReturnType<typeof useSceneEditorModel>
