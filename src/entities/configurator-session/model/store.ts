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
  /** World-space extent excluding the exported site plate; null until the glb resolves. */
  buildingBounds: BuildingBounds | null
  showCeiling: boolean
  /** Storey the visitor is looking at, or null for the whole building. */
  selectedFloorKey: string | null
  /** One pose to fly to, consumed by the camera on the next request and then cleared. */
  moveToTarget: MoveToRequest | null
  focusRoom: (key: string) => void
  exitRoomFocus: () => void
  setInteractionLock: (locked: boolean) => void
  setViewMode: (mode: ViewMode) => void
  setBuildingBounds: (bounds: BuildingBounds) => void
  toggleCeiling: () => void
  selectFloor: (key: string | null) => void
  requestMoveTo: (position: [number, number, number], target: [number, number, number]) => void
  clearMoveTo: () => void
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
  moveToTarget: null as MoveToRequest | null,
}

export const useConfiguratorSession = create<ConfiguratorSessionState>((set) => ({
  ...VISITOR_STATE,
  viewRequestId: 0,
  buildingBounds: null,
  focusRoom: (key) =>
    set((s) => ({
      focusedRoomKey: key,
      moveToTarget: null,
      viewMode: 'dollhouse',
      viewRequestId: s.viewRequestId + 1,
    })),
  exitRoomFocus: () =>
    set((s) => ({
      focusedRoomKey: null,
      moveToTarget: null,
      viewRequestId: s.viewRequestId + 1,
    })),
  setInteractionLock: (locked) => set({ interactionLock: locked }),
  setViewMode: (mode) =>
    set((s) => ({
      viewMode: mode,
      moveToTarget: null,
      viewRequestId: s.viewRequestId + 1,
    })),
  setBuildingBounds: (bounds) => set({ buildingBounds: bounds }),
  toggleCeiling: () => set((s) => ({ showCeiling: !s.showCeiling })),
  // Reframes: a storey is a different subject, and the pose that framed the
  // whole building leaves it small and off centre.
  selectFloor: (key) =>
    set((s) => ({
      selectedFloorKey: key,
      moveToTarget: null,
      viewRequestId: s.viewRequestId + 1,
    })),
  // Bumps the request id like every other camera action, so the rig re-runs for
  // it. That is what lets the rig consume the pose and clear it in one pass,
  // instead of holding it and re-flying to it on every later scope change.
  requestMoveTo: (position, target) =>
    set((s) => ({ moveToTarget: { position, target }, viewRequestId: s.viewRequestId + 1 })),
  // No bump: this is the rig putting a consumed request down, not asking for a
  // flight. Bumping here would send the camera straight back to the view preset.
  clearMoveTo: () => set({ moveToTarget: null }),
  // A different building is a different subject: its rooms, storeys and framing
  // share nothing with the last one's.
  reset: () => set((s) => ({ ...VISITOR_STATE, viewRequestId: s.viewRequestId + 1 })),
}))
