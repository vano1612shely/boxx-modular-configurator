import { create } from 'zustand'

import type { AreaUnit } from '@/shared/lib'

/**
 * The two poses a button can ask for.
 *
 * The four sides used to be here too. A quarter turn does what they did and
 * keeps the zoom and the pan while it is at it, so naming four fixed bearings
 * was four buttons spent on a subset of one.
 */
export type ViewMode = 'dollhouse' | 'top'

export type BuildingBounds = {
  min: [number, number, number]
  max: [number, number, number]
}

export type MoveToRequest = {
  position: [number, number, number]
  target: [number, number, number]
}

type ConfiguratorSessionState = {
  focusedRoomKey: string | null
  interactionLock: boolean
  viewMode: ViewMode
  /** Monotonic counter — bumping it re-triggers the camera flight for the current mode. */
  viewRequestId: number
  /** Counted separately: a turn nudges the bearing and must not re-fly the pose. */
  rotateRequestId: number
  /** Which way the last turn went, +1 clockwise from above. */
  rotateDirection: 1 | -1
  /** World-space extent excluding the exported site plate; null until the glb resolves. */
  buildingBounds: BuildingBounds | null
  /**
   * The view button last pressed, or null once the camera has left it.
   *
   * Separate from `viewMode` because that one is an instruction to the camera:
   * it is in the preset effect's dependencies and it also sets the polar floor,
   * so writing it to relabel the bar would fly the camera and, mid-drag, jerk
   * the model out from under the finger doing the dragging.
   */
  pickedView: ViewMode | null
  /**
   * The visitor's own unit, or null to follow the admin's default.
   *
   * An override rather than a value: the default is resolved on the server and a
   * module-scope store cannot see it, and holding null means the choice keeps
   * following the admin if they change theirs.
   */
  areaUnitOverride: AreaUnit | null
  /**
   * Whether the roof and the ceilings under it are drawn.
   *
   * Observed, not chosen: the rig reads the tilt every frame and reports it
   * through `setRoofShown`. Tip far enough over to be looking at the floor and
   * the roof that would be covering it goes; come back down and it returns.
   */
  roofShown: boolean
  /** Storey the visitor is looking at, or null for the whole building. */
  selectedFloorKey: string | null
  /** Room framed from above without going in, or null. A step, not a place. */
  previewRoomKey: string | null
  /**
   * The zone of the focused room being furnished, or null for the whole of it.
   *
   * Not a camera state — a divided room is one space and picking a half does
   * not move the eye. It only says which furniture is on offer and where the
   * next piece lands.
   */
  activeZoneKey: string | null
  /**
   * Exterior spot whose choices are open in the panel.
   *
   * Held here rather than inside the panel because clicking the deck itself is
   * what opens it, and that click happens in the canvas.
   */
  openSlotKey: string | null
  /** One pose to fly to, consumed by the camera on the next request and then cleared. */
  moveToTarget: MoveToRequest | null
  focusRoom: (key: string) => void
  openExteriorSlot: (key: string | null) => void
  exitRoomFocus: () => void
  setInteractionLock: (locked: boolean) => void
  setViewMode: (mode: ViewMode) => void
  setBuildingBounds: (bounds: BuildingBounds) => void
  setAreaUnit: (unit: AreaUnit | null) => void
  noteManualView: () => void
  setRoofShown: (shown: boolean) => void
  selectFloor: (key: string | null) => void
  recenter: () => void
  previewRoom: (key: string) => void
  clearPreview: () => void
  setActiveZone: (key: string | null) => void
  requestMoveTo: (position: [number, number, number], target: [number, number, number]) => void
  clearMoveTo: () => void
  rotateView: (direction: 1 | -1) => void
  reset: () => void
}

/**
 * What the visitor chose, and nothing measured off the model.
 *
 * `buildingBounds` is deliberately not in here: it is published by BuildingModel
 * once the glb is in the scene, and only when it differs from what the store
 * already holds. Clearing it from the outside would race that publish — reset
 * runs in a parent effect, which fires after the child's — and a bounds cleared
 * after the new model measured itself would never be measured again.
 */
const VISITOR_STATE = {
  focusedRoomKey: null as string | null,
  interactionLock: false,
  // Straight down, the way a plan is read. The first question anyone asks of a
  // building they have just configured is what is in it and where, and the
  // three-quarter view answers that worst — the near walls hide half of it.
  viewMode: 'top' as ViewMode,
  pickedView: 'top' as ViewMode | null,
  // Follows the opening tilt: looking down at the plan, there is no roof.
  roofShown: false,
  selectedFloorKey: null as string | null,
  previewRoomKey: null as string | null,
  activeZoneKey: null as string | null,
  openSlotKey: null as string | null,
  moveToTarget: null as MoveToRequest | null,
}

export const useConfiguratorSession = create<ConfiguratorSessionState>((set) => ({
  ...VISITOR_STATE,
  viewRequestId: 0,
  rotateRequestId: 0,
  rotateDirection: 1,
  buildingBounds: null,
  // Outside VISITOR_STATE on purpose: picking a different building size should
  // not put a visitor who asked for metres back into feet.
  areaUnitOverride: null,
  // Entering lands on the whole room, never on one of its halves: what is in
  // the room is the first thing to see, and picking a half is a step after.
  focusRoom: (key) =>
    set((s) => ({
      focusedRoomKey: key,
      previewRoomKey: null,
      activeZoneKey: null,
      moveToTarget: null,
      viewMode: 'dollhouse',
      pickedView: 'dollhouse',
      viewRequestId: s.viewRequestId + 1,
    })),
  // Leaves looking straight down. Coming out of a room, the useful question is
  // where that room sits in the plan, and the three-quarter view the visitor
  // went in from answers it worst — the near walls stand in front of everything.
  exitRoomFocus: () =>
    set((s) => ({
      focusedRoomKey: null,
      previewRoomKey: null,
      activeZoneKey: null,
      moveToTarget: null,
      viewMode: 'top',
      pickedView: 'top',
      viewRequestId: s.viewRequestId + 1,
    })),
  setActiveZone: (key) => set({ activeZoneKey: key }),
  // One spot is open at a time and one always is, so this sets rather than
  // toggles: clicking the deck you are already looking at should leave its
  // choices on screen, not fold them away.
  openExteriorSlot: (key) => set({ openSlotKey: key }),
  setInteractionLock: (locked) => set({ interactionLock: locked }),
  // Picking a view is a statement about the building, so it drops a room
  // preview: the whole of it from outside is not what one room from above was.
  setViewMode: (mode) =>
    set((s) => ({
      viewMode: mode,
      pickedView: mode,
      previewRoomKey: null,
      moveToTarget: null,
      viewRequestId: s.viewRequestId + 1,
    })),
  setBuildingBounds: (bounds) => set({ buildingBounds: bounds }),
  // No request bump: reading a figure in other units is not a reason to move
  // the camera, and a bump would throw away the visitor's zoom and pan.
  setAreaUnit: (areaUnitOverride) => set({ areaUnitOverride }),
  // The visitor has taken the camera somewhere the bar cannot name, so the bar
  // stops naming one. No request bump and no `viewMode` write: this is called
  // from the first move of a drag, and either would fly the camera out from
  // under the finger doing the dragging.
  noteManualView: () => set({ pickedView: null }),
  // Reported by the rig off the live tilt, so it is written on the frame the
  // camera crosses the angle and on no other. Nothing here decides anything —
  // the deciding is `roofShownAt`, which the rig owns.
  setRoofShown: (roofShown) => set({ roofShown }),
  // Reframes: a storey is a different subject, and the pose that framed the
  // whole building leaves it small and off centre.
  selectFloor: (key) =>
    set((s) => ({
      selectedFloorKey: key,
      previewRoomKey: null,
      moveToTarget: null,
      viewRequestId: s.viewRequestId + 1,
    })),
  // Back out over the whole of it, centred, the way a map recentres on you.
  //
  // Not merely "Top view" again: that one looks down at whatever the camera is
  // currently bounded to, and a picked storey survives it. This puts the whole
  // building back as the subject first, which is the half that matters once a
  // visitor has closed in on one corner of the plan and lost the rest of it.
  recenter: () =>
    set((s) => ({
      viewMode: 'top',
      pickedView: 'top',
      previewRoomKey: null,
      selectedFloorKey: null,
      moveToTarget: null,
      viewRequestId: s.viewRequestId + 1,
    })),
  // Straight down at one room, close enough to read it, without going in. The
  // zoom in the overview always closes on the middle of the building, which is
  // no help at all when the room of interest is at one end.
  previewRoom: (key) =>
    set((s) => ({
      previewRoomKey: key,
      viewMode: 'top',
      pickedView: 'top',
      moveToTarget: null,
      viewRequestId: s.viewRequestId + 1,
    })),
  // Guarded: a stray clear while nothing is previewed would reframe the camera
  // for no reason, and every click on empty ground goes through here.
  clearPreview: () =>
    set((s) =>
      s.previewRoomKey === null
        ? {}
        : { previewRoomKey: null, moveToTarget: null, viewRequestId: s.viewRequestId + 1 },
    ),
  // Bumps the request id like every other camera action, so the rig re-runs for
  // it. That is what lets the rig consume the pose and clear it in one pass,
  // instead of holding it and re-flying to it on every later scope change.
  requestMoveTo: (position, target) =>
    set((s) => ({ moveToTarget: { position, target }, viewRequestId: s.viewRequestId + 1 })),
  // No bump: this is the rig putting a consumed request down, not asking for a
  // flight. Bumping here would send the camera straight back to the view preset.
  clearMoveTo: () => set({ moveToTarget: null }),
  // Its own counter, deliberately: a turn only rewrites the bearing, and routing
  // it through `viewRequestId` would re-apply the whole preset — which zeroes the
  // focal offset and dollies back, throwing away the visitor's zoom and pan on
  // every press. It leaves `viewMode` alone for the same reason.
  //
  // The bar stops naming the overview, which a quarter turn does leave: it is a
  // pose from one particular bearing, and after a turn the camera is
  // demonstrably ninety degrees off it.
  //
  // The top view it keeps. That one is not a bearing at all — it is the eye
  // straight over the subject looking down, and it is exactly as true of the
  // plan turned a quarter as of the plan as it was. The button stays lit
  // because the view really is still the one it names.
  rotateView: (direction) =>
    set((s) => ({
      rotateDirection: direction,
      rotateRequestId: s.rotateRequestId + 1,
      pickedView: s.pickedView === 'top' ? 'top' : null,
    })),
  // A different building is a different subject: its rooms, storeys and framing
  // share nothing with the last one's.
  reset: () => set((s) => ({ ...VISITOR_STATE, viewRequestId: s.viewRequestId + 1 })),
}))
