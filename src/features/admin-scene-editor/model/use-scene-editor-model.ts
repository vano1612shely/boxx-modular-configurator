'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  onOutline,
  pointInPolygon,
  computeSideAxes,
  containingFloor,
  cutPolygon,
  floorForY,
  autoAssignSides,
  nextZoneTint,
  zoneNamesJoined,
  reanchorOpenings,
  rectifyPolygon,
  roomOpenings,
  roomVertices,
  roomZones,
  zoneNodePaths,
  type BuildingFloor,
  type CutFailure,
  type OpeningFit,
  type OpeningKind,
  type Point2,
  type RoomOpening,
  type RoomType,
  type RoomVertex,
  type SunDirection,
  type Extent,
  type Vec3Tuple,
  type TexturedSurface,
  type WallSide,
  type Zone,
} from '@/entities/building'
import { SHELL_DEFAULTS } from '@/modules/shared/room-shell'
import { assetUrl } from '@/shared/lib'

import {
  blockRefKey,
  defaultYRange,
  nextStoreyBox,
  normalizeBox,
  sameBlockRef,
  type BlockRef,
  type BlockScope,
  type EditorBox,
} from '../lib/blocks'
import type { PlaneBounds } from '../lib/floor-plane'
import type { BuildingModel, Model } from '@/payload-types'

export type EditorMode =
  | 'select'
  | 'draw-room'
  | 'block-roof'
  | 'place-opening'
  | 'floor-level'
  | 'cut-zone'

export { blockRefKey, defaultYRange, sameBlockRef }
export type { BlockRef, BlockScope, EditorBox }

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
  /** Child-index path from the model root ("2/0/5"). */
  path: string
  /** World-space AABB of the node's subtree (null when empty). */
  box: EditorBox | null
}

function modelUrlOf(model: number | Model | null | undefined): string | null {
  return typeof model === 'object' ? assetUrl(model) : null
}

type SlotDraft = NonNullable<NonNullable<Draft['sceneConfig']>['exteriorSlots']>[number]
type VariantDraft = NonNullable<SlotDraft['variants']>[number]
type PartDraft = NonNullable<VariantDraft['parts']>[number]

/** One catalogue entry as the picker hands it over, parts and all. */
export type ExteriorOptionRef = {
  id: number
  title: string
  price: number | null
  parts: PartDraft[]
}

/**
 * A key nothing in the list is using.
 *
 * Keys outlive array indexes — Payload regenerates row ids on every save, and
 * the visitor's pick is stored against the key — so reusing one would hand a
 * visitor's choice to whatever took its place.
 */
function freeKey(rows: Array<{ key?: string | null }>, prefix: string): string {
  let n = rows.length + 1
  while (rows.some((row) => row.key === `${prefix}-${n}`)) n += 1
  return `${prefix}-${n}`
}


export function useSceneEditorModel() {
  const { id } = useDocumentInfo()

  const [doc, setDoc] = useState<BuildingModel | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [mode, setMode] = useState<EditorMode>('select')
  const [drawingPoints, setDrawingPoints] = useState<Array<{ x: number; z: number }>>([])
  // Only for a building with no storeys — a storey keeps its own level on the
  // document. y = 0 is the underside of the glb chassis, not a walkable floor.
  const [selectedRoomIndex, setSelectedRoomIndex] = useState<number | null>(null)
  const roomMode = selectedRoomIndex !== null
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null)
  const [openingKind, setOpeningKind] = useState<OpeningKind>('door')
  const openingSeq = useRef(1)
  /** The cut being drawn: wall to wall, through as many corners as it takes. */
  const [cutPoints, setCutPoints] = useState<Point2[]>([])
  const [cutError, setCutError] = useState<CutFailure | null>(null)
  /** Which zone the next cut divides; null means the room itself. */
  const [selectedZoneKey, setSelectedZoneKey] = useState<string | null>(null)
  const zoneSeq = useRef(1)
  const [selectedBlocks, setSelectedBlocks] = useState<BlockRef[]>([])
  const selectedBlock = selectedBlocks.length
    ? selectedBlocks[selectedBlocks.length - 1]
    : null
  const setSelectedBlock = useCallback((ref: BlockRef | null) => {
    setSelectedBlocks(ref ? [ref] : [])
  }, [])
  const [modelNodes, setModelNodes] = useState<ModelNode[]>([])
  const [selectedNodePaths, setSelectedNodePaths] = useState<string[]>([])
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null)
  /** Which choice the viewport shows for the selected spot; null follows its default. */
  const [previewVariantKey, setPreviewVariantKey] = useState<string | null>(null)
  /**
   * What the handles are on: a part by index, the spot itself, or nothing said
   * yet — which resolves to the first model.
   *
   * Three states rather than two, because "not chosen" and "the spot" want
   * different answers. Imported models rarely share an origin, so the model is
   * what an admin reaches for first and the default belongs there; the spot is
   * what carries the whole arrangement once the models line up.
   */
  const [partChoice, setPartChoice] = useState<number | 'spot' | null>(null)
  const [roofHidden, setRoofHidden] = useState(true)
  /** Storey the viewport is cut down to, exactly as the visitor would see it. */
  const [previewFloorIndex, setPreviewFloorIndex] = useState<number | null>(null)
  const [ghostModel, setGhostModel] = useState(true)
  const [planMode, setPlanMode] = useState(false)
  /** Bumped to send the viewport camera home; the canvas owns how. */
  const [viewResetId, setViewResetId] = useState(0)
  const [modelBox, setModelBox] = useState<{ height: number; footprint: PlaneBounds } | null>(null)
  const modelHeight = modelBox?.height ?? 3.2
  const modelFootprint = modelBox?.footprint ?? null
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const cameraGetterRef = useRef<(() => CameraSnapshot | null) | null>(null)

  // At most one undo snapshot per 300ms, so a drag is a single undo step.
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

  const roomOutline = (room: DraftRoom): Point2[] =>
    roomVertices(room).map((v) => ({ x: v.x, z: v.z }))

  /** The outline the next cut divides: a zone if one is picked, else the room. */
  const cutTarget = (room: DraftRoom): Point2[] => {
    const zone = roomZones(room.zones).find((z) => z.key === selectedZoneKey)
    return zone ? zone.polygon : roomOutline(room)
  }

  const freshZoneKey = (taken: ReadonlyArray<string>): string => {
    let key = `zone-${zoneSeq.current++}`
    while (taken.includes(key)) key = `zone-${zoneSeq.current++}`
    return key
  }

  /**
   * Splits the picked zone — or the whole room, the first time — along the cut.
   *
   * Takes the path rather than reading it back out of state: the click that
   * lands on the second wall both finishes the line and commits it, and that
   * click's own point has not reached state yet.
   *
   * Both halves lose any authored area: the figure that was typed in described
   * the floor before it was divided, and leaving it on either half would state
   * a size neither one is. The trace takes over until somebody types a new one.
   */
  const commitZoneCut = (path: Point2[]) => {
    if (selectedRoomIndex === null) return
    const room = draft?.rooms?.[selectedRoomIndex]
    if (!room) return

    const existing = roomZones(room.zones)
    const result = cutPolygon(cutTarget(room), path)
    if (!result.ok) {
      setCutError(result.reason)
      return
    }

    const [near, far] = result.parts
    const divided = existing.find((zone) => zone.key === selectedZoneKey) ?? null
    const keys = existing.map((zone) => zone.key)
    const tints = existing.filter((zone) => zone.key !== divided?.key).map((zone) => zone.color)

    const kept: Zone = {
      key: divided?.key ?? freshZoneKey(keys),
      name: divided?.name ?? room.name,
      roomType: (divided?.roomType ?? room.roomType) as RoomType,
      areaSqFt: null,
      areaSqM: null,
      color: divided?.color ?? nextZoneTint(tints),
      polygon: near,
    }
    const added: Zone = {
      key: freshZoneKey([...keys, kept.key]),
      name: 'New zone',
      roomType: kept.roomType,
      areaSqFt: null,
      areaSqM: null,
      color: nextZoneTint([...tints, kept.color]),
      polygon: far,
    }

    const zones = divided
      ? existing.flatMap((zone) => (zone.key === divided.key ? [kept, added] : [zone]))
      : [kept, added]

    patchRoom(selectedRoomIndex, (r) => ({ ...r, zones, name: zoneNamesJoined(zones) }))
    setCutPoints([])
    setCutError(null)
    setSelectedZoneKey(added.key)
    setMode('select')
  }

  /**
   * Renames the room along with its zones, until somebody names it themselves.
   *
   * "Conference + Kitchen" is what a divided room should be called, and it has
   * to keep up as the halves are named. Comparing against the joined names it
   * had a moment ago is how it knows nobody has overridden it: once the room
   * carries a name of its own, the two stop agreeing and it is left alone from
   * then on.
   */
  const updateZone = (key: string, update: Partial<Zone>) => {
    if (selectedRoomIndex === null) return
    patchRoom(selectedRoomIndex, (room) => {
      const before = roomZones(room.zones)
      const zones = before.map((zone) => (zone.key === key ? { ...zone, ...update } : zone))
      const following = room.name === zoneNamesJoined(before)

      return { ...room, zones, name: following ? zoneNamesJoined(zones) : room.name }
    })
  }

  /**
   * Puts the room back together as one space.
   *
   * All of them at once, never one: zones tile the room, so removing a single
   * one would leave a hole in the floor that nothing owns. Recutting is two
   * clicks, and undo still has the old set.
   */
  const clearZones = () => {
    if (selectedRoomIndex === null) return
    patchRoom(selectedRoomIndex, (room) => ({ ...room, zones: [] }))
    setSelectedZoneKey(null)
    setCutPoints([])
    setCutError(null)
  }

  // Openings are addressed by arc length, so any outline edit must re-anchor
  // them by world position; the outward wall axes are recomputed for the same reason.
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
      // Payload regenerates array row ids on every save, so they cannot be the identity.
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
    setMode('select')
    return opening
  }

  type DraftFloor = NonNullable<NonNullable<Draft['sceneConfig']>['floors']>[number]

  const roofBlocks = (d: Draft): EditorBox[] => (d.sceneConfig?.roofBlocks ?? []) as EditorBox[]
  const draftFloors = (d: Draft): DraftFloor[] => d.sceneConfig?.floors ?? []

  const writeBlocks = (d: Draft, blocks: EditorBox[]): Draft => ({
    ...d,
    sceneConfig: { ...d.sceneConfig, roofBlocks: blocks },
  })

  const writeFloors = (d: Draft, floors: DraftFloor[]): Draft => ({
    ...d,
    sceneConfig: { ...d.sceneConfig, floors },
  })

  const boxAt = (d: Draft | null, ref: BlockRef): EditorBox | null => {
    if (!d) return null
    if (ref.scope === 'roof') return roofBlocks(d)[ref.index] ?? null
    return (draftFloors(d)[ref.index]?.box as EditorBox | undefined) ?? null
  }

  const addBlock = (rect: { minX: number; minZ: number; maxX: number; maxZ: number }) => {
    const [yMin, yMax] = defaultYRange(modelHeight)
    const box = normalizeBox({
      min: { x: rect.minX, y: yMin, z: rect.minZ },
      max: { x: rect.maxX, y: yMax, z: rect.maxZ },
    })

    const index = roofBlocks(draftRef.current ?? ({} as Draft)).length
    patchDraft((d) => writeBlocks(d, [...roofBlocks(d), box]))
    setSelectedBlock({ scope: 'roof', index })
    setMode('select')
  }

  const updateBlock = (ref: BlockRef, box: EditorBox) => {
    const next = normalizeBox(box)
    patchDraft((d) =>
      ref.scope === 'roof'
        ? writeBlocks(
            d,
            roofBlocks(d).map((b, i) => (i === ref.index ? { ...b, ...next } : b)),
          )
        : writeFloors(
            d,
            draftFloors(d).map((floor, i) => (i === ref.index ? { ...floor, box: next } : floor)),
          ),
    )
  }

  const removeBlock = (ref: BlockRef) => {
    patchDraft((d) =>
      ref.scope === 'roof'
        ? writeBlocks(d, roofBlocks(d).filter((_, i) => i !== ref.index))
        : writeFloors(d, draftFloors(d).filter((_, i) => i !== ref.index)),
    )
    setSelectedBlock(null)
    // Every index above the gap has shifted; nothing is worth guessing here.
    if (ref.scope === 'floor') setPreviewFloorIndex(null)
  }

  const floors = draft ? draftFloors(draft) : []

  const addFloor = () => {
    const current = floors
    // The one that reaches highest, not the one authored last: storeys stack in
    // height, and the array is in whatever order the admin built them.
    const below = current.reduce<EditorBox | null>((top, floor) => {
      const box = floor.box as EditorBox
      return !top || box.max.y > top.max.y ? box : top
    }, null)

    const used = new Set(current.map((floor) => floor.key))
    let n = current.length + 1
    while (used.has(`floor-${n}`)) n++

    const index = current.length
    const box = nextStoreyBox(below, modelHeight, modelFootprint)
    patchDraft((d) =>
      writeFloors(d, [
        ...draftFloors(d),
        { key: `floor-${n}`, name: `Floor ${index + 1}`, box, floorY: box.min.y },
      ]),
    )
    setSelectedBlock({ scope: 'floor', index })
    setPreviewFloorIndex(index)
  }

  // The client derives a room's storey from its floor level. Doing the same sum
  // here is what makes that derivation visible: a volume dragged a few
  // centimetres off shows up as rooms moving between storeys, or falling off
  // them entirely, rather than as a surprise on the live site.
  const entityFloors: BuildingFloor[] = floors.map((floor, index) => ({
    key: floor.key || `floor-${index + 1}`,
    name: floor.name || `Floor ${index + 1}`,
    box: {
      min: [floor.box?.min?.x ?? 0, floor.box?.min?.y ?? 0, floor.box?.min?.z ?? 0],
      max: [floor.box?.max?.x ?? 0, floor.box?.max?.y ?? 0, floor.box?.max?.z ?? 0],
    },
    floorY: typeof floor.floorY === 'number' ? floor.floorY : (floor.box?.min?.y ?? 0),
  }))

  const roomLevels = (draft?.rooms ?? []).map((room) => ({
    name: room.name,
    y: (room.shell as { floorY?: number | null } | null | undefined)?.floorY ?? 0,
  }))

  const storeyRoomCounts = entityFloors.map(
    (floor) =>
      roomLevels.filter((room) => containingFloor(entityFloors, room.y)?.key === floor.key).length,
  )

  const roomsOffStoreys = entityFloors.length
    ? roomLevels.filter((room) => containingFloor(entityFloors, room.y) === null).map((r) => r.name)
    : []

  const previewedStorey = previewFloorIndex === null ? null : entityFloors[previewFloorIndex]

  /**
   * Rooms the previewed storey holds, or null while the whole building is up.
   *
   * Outlines are overlays, not model geometry, so nothing cuts them: without
   * this the storey below shows its rooms straight through the floor that was
   * cut away, which is exactly what makes a plan unreadable.
   */
  const previewRoomIndexes = previewedStorey
    ? new Set(
        roomLevels.flatMap((room, index) =>
          floorForY(entityFloors, room.y)?.key === previewedStorey.key ? [index] : [],
        ),
      )
    : null

  // A storey the admin is standing on owns its own drawing level, and owns it
  // on the document: a level that lived only in this session came back wrong
  // after a reload, and furniture stands on whatever the room was given. With
  // no storeys there is one level and it behaves exactly as it always did.
  const storeyBaseY = previewedStorey?.box.min[1] ?? 0
  // Held on the document, not in this hook: a level that lived only in the
  // session came back at zero after a reload, and every room drawn afterwards
  // started on the wrong plane.
  const looseFloorY =
    typeof draft?.sceneConfig?.floorY === 'number' ? draft.sceneConfig.floorY : 0
  const drawFloorY = previewedStorey ? previewedStorey.floorY : looseFloorY

  const setLooseFloorY = (level: number) =>
    patchDraft((d) => ({ ...d, sceneConfig: { ...d.sceneConfig, floorY: level } }))

  const renameFloor = (index: number, name: string) =>
    patchDraft((d) =>
      writeFloors(
        d,
        draftFloors(d).map((floor, i) => (i === index ? { ...floor, name } : floor)),
      ),
    )

  type RoofModelPatch = {
    model?: { id: number; url?: string | null } | null
    position?: { x: number; y: number; z: number }
    yawDeg?: number
    scale?: number
  }

  const roofModel = draft?.sceneConfig?.roofModel ?? null
  const roofModelUrl = modelUrlOf(roofModel?.model)
  const [roofModelBounds, setRoofModelBounds] = useState<Extent | null>(null)

  const patchRoofModel = (patch: RoofModelPatch) =>
    patchDraft((d) => ({
      ...d,
      sceneConfig: {
        ...d.sceneConfig,
        // Holds the POPULATED relationship (the viewport renders the draft);
        // Payload strips it back to an id on write.
        roofModel: { ...(d.sceneConfig?.roofModel ?? {}), ...patch },
      } as Draft['sceneConfig'],
    }))

  const roofPlacement = {
    position: {
      x: roofModel?.position?.x ?? 0,
      y: roofModel?.position?.y ?? 0,
      z: roofModel?.position?.z ?? 0,
    },
    yawDeg: roofModel?.yawDeg ?? 0,
    scale: roofModel?.scale && roofModel.scale > 0 ? roofModel.scale : 1,
  }

  const hiddenNodePaths = zoneNodePaths(draft?.sceneConfig?.hiddenNodePaths)

  const setNodeHidden = (path: string, hidden: boolean) => {
    patchDraft((d) => {
      const current = zoneNodePaths(d.sceneConfig?.hiddenNodePaths)
      if (hidden === current.includes(path)) return d
      const next = hidden ? [...current, path] : current.filter((p) => p !== path)
      return { ...d, sceneConfig: { ...d.sceneConfig, hiddenNodePaths: next } }
    })
  }

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
    const index = roofBlocks(draftRef.current ?? ({} as Draft)).length
    patchDraft((d) => writeBlocks(d, [...roofBlocks(d), paddedNodeBox(union)]))
    setSelectedBlock({ scope: 'roof', index })
  }

  const handleFloorClick = (x: number, z: number) => {
    if (mode === 'draw-room') {
      setDrawingPoints((points) => {
        // Skip a repeated corner: a zero-length wall has no outward normal, so no side.
        const last = points[points.length - 1]
        if (last && last.x === x && last.z === z) return points
        return [...points, { x, z }]
      })
      return
    }

    if (mode === 'cut-zone') {
      const room = selectedRoomIndex === null ? null : draft?.rooms?.[selectedRoomIndex]
      if (!room) return

      const outline = cutTarget(room)
      // Aiming at a wall with a mouse lands near it rather than on it, so a
      // click inside the grab distance is pulled onto the wall itself. The
      // editor has been drawing that wall highlighted the whole time.
      const wall = onOutline(outline, { x, z })

      // A cut runs wall to wall, so the first click has to be on one.
      if (cutPoints.length === 0) {
        if (!wall) {
          setCutError('ends-off-outline')
          return
        }
        setCutError(null)
        setCutPoints([wall.point])
        return
      }

      // Reaching a wall again is the end of the line, and the end of the line
      // is the whole cut — there is nothing left to confirm.
      if (wall) {
        commitZoneCut([...cutPoints, wall.point])
        return
      }

      // Everything between the two walls is a corner, and a corner outside the
      // floor being divided is not a corner of anything.
      if (!pointInPolygon({ x, z }, outline)) {
        setCutError('leaves-the-room')
        return
      }

      const last = cutPoints[cutPoints.length - 1]
      if (last && last.x === x && last.z === z) return

      setCutError(null)
      setCutPoints((points) => [...points, { x, z }])
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

  const selectedShell = (
    selectedRoomIndex === null ? null : draft?.rooms?.[selectedRoomIndex]?.shell
  ) as { floorY?: number | null } | null | undefined
  const floorPlaneY =
    typeof selectedShell?.floorY === 'number' ? selectedShell.floorY : drawFloorY

  const setFloorLevel = (y: number) => {
    const level = Math.round(y * 1000) / 1000

    if (selectedRoomIndex !== null) {
      patchRoom(selectedRoomIndex, (room) => ({
        ...room,
        shell: { ...(room.shell ?? {}), floorY: level },
      }))
      // With no storeys the level a room was set to is also the level the next
      // one is drawn at; a storey's own level is authored, not inherited.
      if (previewFloorIndex === null) setLooseFloorY(level)
      return
    }

    if (previewFloorIndex !== null) {
      patchDraft((d) =>
        writeFloors(
          d,
          draftFloors(d).map((floor, i) =>
            i === previewFloorIndex ? { ...floor, floorY: level } : floor,
          ),
        ),
      )
      return
    }

    setLooseFloorY(level)
  }

  // ---- Exterior spots ------------------------------------------------------

  const exteriorSlots = draft?.sceneConfig?.exteriorSlots ?? []
  const selectedSlot =
    selectedSlotIndex === null ? null : (exteriorSlots[selectedSlotIndex] ?? null)

  const patchSlots = (update: (slots: SlotDraft[]) => SlotDraft[]) =>
    patchDraft((d) => ({
      ...d,
      sceneConfig: {
        ...d.sceneConfig,
        exteriorSlots: update(d.sceneConfig?.exteriorSlots ?? []),
      } as Draft['sceneConfig'],
    }))

  const patchSlot = (index: number, update: (slot: SlotDraft) => SlotDraft) =>
    patchSlots((slots) => slots.map((slot, i) => (i === index ? update(slot) : slot)))

  const patchVariant = (
    slotIndex: number,
    variantIndex: number,
    update: (variant: VariantDraft) => VariantDraft,
  ) =>
    patchSlot(slotIndex, (slot) => ({
      ...slot,
      variants: (slot.variants ?? []).map((variant, i) =>
        i === variantIndex ? update(variant) : variant,
      ),
    }))

  /** The variant the viewport is showing for the selected spot. */
  const previewVariantIndex = (() => {
    const variants = selectedSlot?.variants ?? []
    if (variants.length === 0) return null
    const named = variants.findIndex((variant) => variant.key === previewVariantKey)
    if (named >= 0) return named
    const fallback = variants.findIndex(
      (variant) => variant.key === selectedSlot?.defaultVariantKey,
    )
    return fallback >= 0 ? fallback : 0
  })()

  /**
   * The model wearing the cage, or null when the spot itself has the handles.
   *
   * Resolved rather than stored, so a choice with models in it always opens
   * with one under the handles: an admin should not have to say "this one"
   * before they can move the only thing on the spot. A stale index — the model
   * was deleted, or the preview stepped to a choice with fewer — falls back to
   * the first.
   */
  const cagedPartIndex = (() => {
    if (partChoice === 'spot') return null

    const parts = (selectedSlot?.variants ?? [])[previewVariantIndex ?? -1]?.parts ?? []
    if (parts.length === 0) return null
    return typeof partChoice === 'number' && partChoice < parts.length ? partChoice : 0
  })()

  const addSlot = () => {
    const index = exteriorSlots.length
    // Where the admin is looking. The footprint is measured off the glb, site
    // plate and all, so placing it past the far edge of that put new spots a
    // plate's width away from the building — off screen, with nothing to say
    // which direction to go looking. The orbit target is on whatever is being
    // framed, so a spot lands where the eye already is.
    const view = snapshotCamera()
    const centre = view
      ? { x: view.target.x, z: view.target.z }
      : modelFootprint
        ? {
            x: (modelFootprint.minX + modelFootprint.maxX) / 2,
            z: (modelFootprint.minZ + modelFootprint.maxZ) / 2,
          }
        : { x: 0, z: 0 }

    patchSlots((slots) => [
      ...slots,
      {
        key: freeKey(slots, 'spot'),
        name: `Entrance ${index + 1}`,
        position: { x: centre.x, y: floorPlaneY, z: centre.z },
        yawDeg: 0,
        defaultVariantKey: '',
        variants: [],
      },
    ])
    setSelectedSlotIndex(index)
    setPreviewVariantKey(null)
  }

  const addVariant = (slotIndex: number, option: ExteriorOptionRef) => {
    patchSlot(slotIndex, (slot) => {
      const variants = slot.variants ?? []
      const key = freeKey(variants, 'choice')

      return {
        ...slot,
        // The catalogue's parts are a starting point, copied in with their
        // offsets so the admin drags from somewhere rather than from nowhere.
        // Copied rather than linked: tidying the catalogue later must not move
        // geometry that has already been lined up on a building.
        variants: [
          ...variants,
          {
            key,
            option: option.id,
            nodes: [],
            parts: option.parts.map((part) => ({ ...part })),
          },
        ],
        defaultVariantKey: slot.defaultVariantKey || key,
      }
    })
  }

  /** Takes whatever is selected in the outliner into this choice. */
  const claimNodes = (slotIndex: number, variantIndex: number) => {
    if (selectedNodePaths.length === 0) return
    patchVariant(slotIndex, variantIndex, (variant) => ({
      ...variant,
      nodes: [...new Set([...zoneNodePaths(variant.nodes), ...selectedNodePaths])],
    }))
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
    modelFootprint,
    exteriorSlots,
    selectedSlotIndex,
    selectedSlot,
    // A spot takes over the sidebar the way a room does, and for the same
    // reason: it is a place with its own contents.
    spotMode: selectedSlotIndex !== null && selectedRoomIndex === null,
    previewVariantIndex,
    // Always on a model when the previewed choice has one, so the cage is there
    // to grab without being asked for first.
    selectedPartIndex: cagedPartIndex,
    onAddSlot: addSlot,
    onSelectSlot: (index: number | null) => {
      setSelectedSlotIndex(index)
      setPreviewVariantKey(null)
      setPartChoice(null)
    },
    onRemoveSlot: (index: number) => {
      patchSlots((slots) => slots.filter((_, i) => i !== index))
      setSelectedSlotIndex(null)
    },
    onRenameSlot: (index: number, name: string) => patchSlot(index, (slot) => ({ ...slot, name })),
    onMoveSlot: (index: number, x: number, y: number, z: number) =>
      patchSlot(index, (slot) => ({ ...slot, position: { x, y, z } })),
    onSetSlotYaw: (index: number, yawDeg: number) =>
      patchSlot(index, (slot) => ({ ...slot, yawDeg })),
    // The built-in geometry is where the modeller put it, which is very often
    // not where a fresh spot lands. This moves the spot to the geometry rather
    // than asking the admin to read coordinates off it.
    onSnapSlotToSelection: (index: number) => {
      const boxes = selectedNodePaths
        .map((path) => modelNodes.find((node) => node.path === path)?.box)
        .filter((box): box is EditorBox => Boolean(box))
      if (boxes.length === 0) return

      const minX = Math.min(...boxes.map((b) => b.min.x))
      const maxX = Math.max(...boxes.map((b) => b.max.x))
      const minZ = Math.min(...boxes.map((b) => b.min.z))
      const maxZ = Math.max(...boxes.map((b) => b.max.z))
      const minY = Math.min(...boxes.map((b) => b.min.y))

      patchSlot(index, (slot) => ({
        ...slot,
        position: { x: (minX + maxX) / 2, y: minY, z: (minZ + maxZ) / 2 },
      }))
    },
    onSelectPart: (value: number | 'spot') => setPartChoice(value),
    // Straight onto the choice, with no offset of its own: an imported model
    // arrives wherever its exporter left the origin, and the way to find out is
    // to see it land and then drag it.
    onAddPart: (slotIndex: number, variantIndex: number, model: { id: number; url?: string | null }) =>
      patchVariant(slotIndex, variantIndex, (variant) => ({
        ...variant,
        parts: [
          ...(variant.parts ?? []),
          { model, position: { x: 0, y: 0, z: 0 }, yawDeg: 0, scale: 1 },
        ] as VariantDraft['parts'],
      })),
    onSetPartModel: (
      slotIndex: number,
      variantIndex: number,
      partIndex: number,
      model: { id: number; url?: string | null },
    ) =>
      patchVariant(slotIndex, variantIndex, (variant) => ({
        ...variant,
        parts: (variant.parts ?? []).map((part, i) =>
          i === partIndex ? ({ ...part, model } as typeof part) : part,
        ),
      })),
    onAddVariant: addVariant,
    onRemoveVariant: (slotIndex: number, variantIndex: number) =>
      patchSlot(slotIndex, (slot) => {
        const variants = (slot.variants ?? []).filter((_, i) => i !== variantIndex)
        const gone = (slot.variants ?? [])[variantIndex]?.key
        return {
          ...slot,
          variants,
          defaultVariantKey:
            slot.defaultVariantKey === gone ? (variants[0]?.key ?? '') : slot.defaultVariantKey,
        }
      }),
    onSetDefaultVariant: (slotIndex: number, variantKey: string) =>
      patchSlot(slotIndex, (slot) => ({ ...slot, defaultVariantKey: variantKey })),
    onPreviewVariant: (key: string | null) => {
      setPreviewVariantKey(key)
      setPartChoice(null)
    },
    onClaimNodes: claimNodes,
    onUnclaimNode: (slotIndex: number, variantIndex: number, path: string) =>
      patchVariant(slotIndex, variantIndex, (variant) => ({
        ...variant,
        nodes: zoneNodePaths(variant.nodes).filter((claimed) => claimed !== path),
      })),
    onMovePart: (
      slotIndex: number,
      variantIndex: number,
      partIndex: number,
      x: number,
      y: number,
      z: number,
    ) =>
      patchVariant(slotIndex, variantIndex, (variant) => ({
        ...variant,
        parts: (variant.parts ?? []).map((part, i) =>
          i === partIndex ? { ...part, position: { x, y, z } } : part,
        ),
      })),
    onSetPartYaw: (slotIndex: number, variantIndex: number, partIndex: number, yawDeg: number) =>
      patchVariant(slotIndex, variantIndex, (variant) => ({
        ...variant,
        parts: (variant.parts ?? []).map((part, i) =>
          i === partIndex ? { ...part, yawDeg } : part,
        ),
      })),
    onSetPartScale: (slotIndex: number, variantIndex: number, partIndex: number, scale: number) =>
      patchVariant(slotIndex, variantIndex, (variant) => ({
        ...variant,
        parts: (variant.parts ?? []).map((part, i) =>
          i === partIndex ? { ...part, scale } : part,
        ),
      })),
    onRemovePart: (slotIndex: number, variantIndex: number, partIndex: number) =>
      patchVariant(slotIndex, variantIndex, (variant) => ({
        ...variant,
        parts: (variant.parts ?? []).filter((_, i) => i !== partIndex),
      })),
    floors,
    storeyRoomCounts,
    roomsOffStoreys,
    previewRoomIndexes,
    previewFloorName: previewedStorey?.name ?? null,
    previewFloorBaseY: storeyBaseY,
    previewFloorIndex,
    previewFloorBox: previewFloorIndex === null ? null : boxAt(draft, {
      scope: 'floor',
      index: previewFloorIndex,
    }),
    dirty,
    saveState,
    onRegisterCameraGetter: (getter: (() => CameraSnapshot | null) | null) => {
      cameraGetterRef.current = getter
    },

    onSetMode: (next: EditorMode) => {
      setMode(next)
      setDrawingPoints([])
      setCutPoints([])
      setCutError(null)
      if (next !== 'select') setSelectedBlock(null)
      if (next === 'draw-room' || next === 'cut-zone') setPlanMode(true)
      if (next === 'floor-level') {
        // Seen from straight above, the drag ray is parallel to the plane it moves.
        setPlanMode(false)
        // R3F raycasts skip invisible objects, so the ghost must be back to snap to.
        setGhostModel(true)
      }
    },
    onSetPlanMode: setPlanMode,
    viewResetId,
    onResetView: () => setViewResetId((id) => id + 1),
    onUndo: undo,
    onEscape: () => {
      setDrawingPoints([])
      setCutPoints([])
      setCutError(null)
      if (mode !== 'select') {
        setMode('select')
        return
      }
      if (selectedBlock) {
        setSelectedBlock(null)
        return
      }
      setSelectedNodePaths([])
    },
    onModelBounds: setModelBox,
    onEnterRoom: (index: number) => {
      setSelectedRoomIndex(index)
      setSelectedBlock(null)
      setSelectedNodePaths([])
      setSelectedZoneKey(null)
      setCutPoints([])
      setCutError(null)
      setMode('select')
    },
    onExitRoom: () => {
      setSelectedRoomIndex(null)
      setSelectedBlock(null)
      setSelectedOpeningId(null)
      setSelectedZoneKey(null)
      setDrawingPoints([])
      setCutPoints([])
      setCutError(null)
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
    onSetRoofHidden: setRoofHidden,
    onSetGhostModel: setGhostModel,
    onFloorClick: handleFloorClick,
    onFinishRoom: finishRoomDrawing,
    onCancelDrawing: () => {
      setDrawingPoints([])
      setMode('select')
    },

    zones: selectedRoomIndex === null ? [] : roomZones(draft?.rooms?.[selectedRoomIndex]?.zones),
    selectedZoneKey,
    cutPoints,
    cutError,
    /** The floor the cut divides, so the canvas can light up the wall under the pointer. */
    cutOutline:
      selectedRoomIndex === null || !draft?.rooms?.[selectedRoomIndex]
        ? []
        : cutTarget(draft.rooms[selectedRoomIndex]),
    onSelectZone: setSelectedZoneKey,
    onCancelZoneCut: () => {
      setCutPoints([])
      setCutError(null)
      setMode('select')
    },
    onUndoCutPoint: () => {
      setCutError(null)
      setCutPoints((points) => points.slice(0, -1))
    },
    onUpdateZone: updateZone,
    onClearZones: clearZones,
    onAddBlock: addBlock,
    onUpdateBlock: updateBlock,
    onRemoveBlock: removeBlock,
    blockBox: (ref: BlockRef) => boxAt(draft, ref),

    onAddFloor: addFloor,
    onRenameFloor: renameFloor,
    // One gesture: previewing a storey is also how you select it to edit, so
    // the handles are on whatever the cut is showing.
    onPreviewFloor: (index: number | null) => {
      setPreviewFloorIndex(index)
      setSelectedBlock(index === null ? null : { scope: 'floor', index })
    },

    roofModelUrl,
    roofPlacement,
    roofModelBounds,
    onRoofModelBounds: setRoofModelBounds,
    /** Takes the populated relationship, not a bare id — the viewport previews the DRAFT. */
    onSetRoofModel: (model: { id: number; url?: string | null } | null) => {
      patchRoofModel({ model })
      if (model) setRoofHidden(false)
      setRoofModelBounds(null)
    },
    onMoveRoofModel: (x: number, y: number, z: number) =>
      patchRoofModel({
        position: {
          x: Math.round(x * 1000) / 1000,
          y: Math.round(y * 1000) / 1000,
          z: Math.round(z * 1000) / 1000,
        },
      }),
    onSetRoofYaw: (yawDeg: number) => patchRoofModel({ yawDeg }),
    onSetRoofScale: (scale: number) => patchRoofModel({ scale: scale > 0 ? scale : 1 }),
    onFitRoofModel: (placement: { position: Vec3Tuple; scale: number }) =>
      patchRoofModel({
        position: {
          x: Math.round(placement.position[0] * 1000) / 1000,
          y: Math.round(placement.position[1] * 1000) / 1000,
          z: Math.round(placement.position[2] * 1000) / 1000,
        },
        scale: Math.round(placement.scale * 10000) / 10000,
      }),
    onUpdateRoomPoint: (roomIndex: number, pointIndex: number, x: number, z: number) =>
      patchPolygon(roomIndex, (vertices) =>
        vertices.map((v, i) => (i === pointIndex ? { ...v, x, z } : v)),
      ),
    onInsertRoomPoint: (roomIndex: number, edgeIndex: number, x: number, z: number) =>
      patchPolygon(roomIndex, (vertices) => {
        const next = [...vertices]
        next.splice(edgeIndex + 1, 0, { x, z, side: vertices[edgeIndex]?.side ?? 'w1' })
        return next
      }),
    onRemoveRoomPoint: (roomIndex: number, pointIndex: number) =>
      patchPolygon(roomIndex, (vertices) =>
        vertices.length > 3 ? vertices.filter((_, i) => i !== pointIndex) : vertices,
      ),

    selectedOpeningId,
    openingKind,
    onSelectOpening: setSelectedOpeningId,
    onSetOpeningKind: setOpeningKind,
    onUpdateShell: (roomIndex: number, patch: Record<string, number | SunDirection | null>) =>
      patchRoom(roomIndex, (room) => ({
        ...room,
        shell: { ...(room.shell ?? {}), ...patch },
      })),
    floorPlaneY,
    onSetFloorLevel: setFloorLevel,
    onNudgeFloorLevel: (delta: number) => setFloorLevel(floorPlaneY + delta),
    onSnapFloorLevel: setFloorLevel,
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
    onSetOpeningModel: (
      roomIndex: number,
      kind: OpeningKind,
      patch: {
        /** Populated, not a bare id — the viewport previews the DRAFT. */
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
