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
  /** Room the user zoomed into (IKEA-style isolation), null = full building. */
  focusedRoomKey: string | null
  /** True while a package drag is in progress — camera controls pause. */
  interactionLock: boolean
  /** Global camera view preset (bottom toolbar). */
  viewMode: ViewMode
  /** Monotonic counter — bumping it re-triggers the camera flight for the current mode. */
  viewRequestId: number
  /** World-space bbox of the loaded building model (set once the glb loads). */
  buildingBounds: BuildingBounds | null
  /** Overview only: show roof/ceiling volumes (hidden by default). */
  showCeiling: boolean
  /** One-shot "fly the camera to this point" request (Move to). */
  moveToTarget: { position: [number, number, number]; target: [number, number, number] } | null
  focusRoom: (key: string) => void
  exitRoomFocus: () => void
  setInteractionLock: (locked: boolean) => void
  setViewMode: (mode: ViewMode) => void
  setBuildingBounds: (bounds: BuildingBounds) => void
  toggleCeiling: () => void
  requestMoveTo: (position: [number, number, number], target: [number, number, number]) => void
  clearMoveTo: () => void
}

/**
 * Shared viewer session state. One configurator instance per page
 * (iframe embed), so a singleton store is intentional.
 */
export const useConfiguratorSession = create<ConfiguratorSessionState>((set) => ({
  focusedRoomKey: null,
  interactionLock: false,
  viewMode: 'dollhouse',
  viewRequestId: 0,
  buildingBounds: null,
  showCeiling: false,
  moveToTarget: null,
  focusRoom: (key) =>
    set((s) => ({
      focusedRoomKey: key,
      moveToTarget: null,
      viewMode: 'dollhouse',
      viewRequestId: s.viewRequestId + 1,
    })),
  exitRoomFocus: () =>
    set((s) => ({ focusedRoomKey: null, viewRequestId: s.viewRequestId + 1 })),
  setInteractionLock: (locked) => set({ interactionLock: locked }),
  // View modes are scoped: with a room focused they orbit that room,
  // otherwise the whole building — so focus is kept here.
  setViewMode: (mode) =>
    set((s) => ({
      viewMode: mode,
      moveToTarget: null,
      viewRequestId: s.viewRequestId + 1,
    })),
  setBuildingBounds: (bounds) => set({ buildingBounds: bounds }),
  toggleCeiling: () => set((s) => ({ showCeiling: !s.showCeiling })),
  requestMoveTo: (position, target) => set({ moveToTarget: { position, target } }),
  clearMoveTo: () => set({ moveToTarget: null }),
}))
