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
  moveToTarget: { position: [number, number, number]; target: [number, number, number] } | null
  focusRoom: (key: string) => void
  exitRoomFocus: () => void
  setInteractionLock: (locked: boolean) => void
  setViewMode: (mode: ViewMode) => void
  setBuildingBounds: (bounds: BuildingBounds) => void
  toggleCeiling: () => void
  selectFloor: (key: string | null) => void
  requestMoveTo: (position: [number, number, number], target: [number, number, number]) => void
  clearMoveTo: () => void
}

export const useConfiguratorSession = create<ConfiguratorSessionState>((set) => ({
  focusedRoomKey: null,
  interactionLock: false,
  viewMode: 'dollhouse',
  viewRequestId: 0,
  buildingBounds: null,
  showCeiling: false,
  selectedFloorKey: null,
  moveToTarget: null,
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
  requestMoveTo: (position, target) => set({ moveToTarget: { position, target } }),
  clearMoveTo: () => set({ moveToTarget: null }),
}))
