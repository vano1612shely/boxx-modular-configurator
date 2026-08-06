import { create } from 'zustand'

export type ViewMode =
  | 'dollhouse'
  | 'top'
  | 'side-front'
  | 'side-right'
  | 'side-back'
  | 'side-left'

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
  /** Side the camera is square to, or null between two. Measured, not chosen. */
  facing: ViewMode | null
  showCeiling: boolean
  /** Storey the visitor is looking at, or null for the whole building. */
  selectedFloorKey: string | null
  /** Room framed from above without going in, or null. A step, not a place. */
  previewRoomKey: string | null
  /** One pose to fly to, consumed by the camera on the next request and then cleared. */
  moveToTarget: MoveToRequest | null
  focusRoom: (key: string) => void
  exitRoomFocus: () => void
  setInteractionLock: (locked: boolean) => void
  setViewMode: (mode: ViewMode) => void
  setBuildingBounds: (bounds: BuildingBounds) => void
  setFacing: (facing: ViewMode | null) => void
  toggleCeiling: () => void
  selectFloor: (key: string | null) => void
  previewRoom: (key: string) => void
  clearPreview: () => void
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
  viewMode: 'dollhouse' as ViewMode,
  showCeiling: false,
  selectedFloorKey: null as string | null,
  previewRoomKey: null as string | null,
  moveToTarget: null as MoveToRequest | null,
}

export const useConfiguratorSession = create<ConfiguratorSessionState>((set) => ({
  ...VISITOR_STATE,
  viewRequestId: 0,
  rotateRequestId: 0,
  rotateDirection: 1,
  buildingBounds: null,
  facing: null,
  focusRoom: (key) =>
    set((s) => ({
      focusedRoomKey: key,
      previewRoomKey: null,
      moveToTarget: null,
      viewMode: 'dollhouse',
      viewRequestId: s.viewRequestId + 1,
    })),
  // Leaves looking straight down. Coming out of a room, the useful question is
  // where that room sits in the plan, and the three-quarter view the visitor
  // went in from answers it worst — the near walls stand in front of everything.
  exitRoomFocus: () =>
    set((s) => ({
      focusedRoomKey: null,
      previewRoomKey: null,
      moveToTarget: null,
      viewMode: 'top',
      viewRequestId: s.viewRequestId + 1,
    })),
  setInteractionLock: (locked) => set({ interactionLock: locked }),
  // Picking a view is a statement about the building, so it drops a room
  // preview: framing one room from the front is not what "Front" was asked for.
  setViewMode: (mode) =>
    set((s) => ({
      viewMode: mode,
      previewRoomKey: null,
      moveToTarget: null,
      viewRequestId: s.viewRequestId + 1,
    })),
  setBuildingBounds: (bounds) => set({ buildingBounds: bounds }),
  // Read off the pose by BearingProbe, which only calls this when it changes.
  setFacing: (facing) => set({ facing }),
  toggleCeiling: () => set((s) => ({ showCeiling: !s.showCeiling })),
  // Reframes: a storey is a different subject, and the pose that framed the
  // whole building leaves it small and off centre.
  selectFloor: (key) =>
    set((s) => ({
      selectedFloorKey: key,
      previewRoomKey: null,
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
  // every press. It also leaves `viewMode` alone, so the bar keeps saying which
  // preset was last picked rather than claiming a turned camera is that preset.
  rotateView: (direction) =>
    set((s) => ({ rotateDirection: direction, rotateRequestId: s.rotateRequestId + 1 })),
  // A different building is a different subject: its rooms, storeys and framing
  // share nothing with the last one's.
  reset: () => set((s) => ({ ...VISITOR_STATE, viewRequestId: s.viewRequestId + 1 })),
}))
