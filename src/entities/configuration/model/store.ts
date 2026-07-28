import { create } from 'zustand'

import type { PlacedPackage } from './types'

type ConfigurationState = {
  placed: PlacedPackage[]
  selectedInstanceId: string | null
  draggingInstanceId: string | null
  /** False while the dragged package overlaps another one or leaves its room. */
  dragValid: boolean
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
  selectedInstanceId: null,
  draggingInstanceId: null,
  dragValid: true,

  addPackage: (placement) => {
    const instanceId = crypto.randomUUID()
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
    set({ placed: [], selectedInstanceId: null, draggingInstanceId: null }),
}))
