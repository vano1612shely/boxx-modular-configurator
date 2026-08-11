import { create } from 'zustand'

import { uniqueId } from '@/shared/lib'

import type { PlacedPackage } from './types'

type ConfigurationState = {
  placed: PlacedPackage[]
  /**
   * What is picked at each exterior spot, by spot key.
   *
   * Absent means the spot's own default, so nothing has to be seeded when a
   * building loads and no effect can race the first frame. Typed here as plain
   * keys rather than against the building's own type: this store knows what the
   * visitor chose, not what a building offers.
   */
  exterior: Record<string, string>
  selectedInstanceId: string | null
  draggingInstanceId: string | null
  /** False while the dragged package overlaps another one or leaves its room. */
  dragValid: boolean
  setExteriorVariant: (slotKey: string, variantKey: string) => void
  addPackage: (placement: Omit<PlacedPackage, 'instanceId'>) => string
  removePackage: (instanceId: string) => void
  movePackage: (instanceId: string, x: number, z: number) => void
  rotatePackage: (instanceId: string, rotationYDeg: number) => void
  selectPackage: (instanceId: string | null) => void
  startDrag: (instanceId: string) => void
  endDrag: () => void
  setDragValid: (valid: boolean) => void
  clear: () => void
}

export const useConfiguration = create<ConfigurationState>((set) => ({
  placed: [],
  exterior: {},
  selectedInstanceId: null,
  draggingInstanceId: null,
  dragValid: true,

  setExteriorVariant: (slotKey, variantKey) =>
    set((state) => ({ exterior: { ...state.exterior, [slotKey]: variantKey } })),

  addPackage: (placement) => {
    const instanceId = uniqueId()
    set((state) => ({
      placed: [...state.placed, { ...placement, instanceId }],
      selectedInstanceId: instanceId,
    }))
    return instanceId
  },

  removePackage: (instanceId) =>
    set((state) => ({
      placed: state.placed.filter((p) => p.instanceId !== instanceId),
      selectedInstanceId: state.selectedInstanceId === instanceId ? null : state.selectedInstanceId,
    })),

  movePackage: (instanceId, x, z) =>
    set((state) => ({
      placed: state.placed.map((p) => (p.instanceId === instanceId ? { ...p, x, z } : p)),
    })),

  rotatePackage: (instanceId, rotationYDeg) =>
    set((state) => ({
      placed: state.placed.map((p) =>
        p.instanceId === instanceId ? { ...p, rotationYDeg } : p,
      ),
    })),

  selectPackage: (instanceId) => set({ selectedInstanceId: instanceId }),
  startDrag: (instanceId) =>
    set({ draggingInstanceId: instanceId, selectedInstanceId: instanceId, dragValid: true }),
  endDrag: () => set({ draggingInstanceId: null, dragValid: true }),
  setDragValid: (valid) => set({ dragValid: valid }),
  clear: () =>
    set({ placed: [], exterior: {}, selectedInstanceId: null, draggingInstanceId: null }),
}))
