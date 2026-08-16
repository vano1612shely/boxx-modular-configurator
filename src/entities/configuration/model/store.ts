import { create } from 'zustand'

import { uniqueId } from '@/shared/lib'

import type { DragPose, PlacedPackage } from './types'

type ConfigurationState = {
  /**
   * The building everything below was chosen for, or null before one is open.
   *
   * Held here rather than worked out by whoever is on screen: a placement is a
   * position inside one particular building, and the two models of a line share
   * room keys. Furniture chosen for the eight-office model and left standing
   * when the visitor came back as a one-office therefore did not vanish — it
   * found a room of the same name in a building of another shape and hung in
   * the air where the old room used to be.
   */
  buildingId: number | null
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
  /**
   * Where the piece under the finger is right now, or null.
   *
   * Deliberately not written into `placed`. A drag produces a pose per pointer
   * move, and `placed` is the configuration itself — the furniture panel, the
   * quote and the view bar all read it, so rewriting it sixty times a second
   * re-rendered the entire screen for a change only one mesh in the canvas cares
   * about. That mesh reads this imperatively in the frame loop, and nothing
   * re-renders until the piece is put down.
   */
  dragPose: DragPose | null
  /** False while the dragged package overlaps another one or leaves its room. */
  dragValid: boolean
  /** Opens a building, emptying a configuration that belonged to another one. */
  adoptBuilding: (buildingId: number) => void
  setExteriorVariant: (slotKey: string, variantKey: string) => void
  addPackage: (placement: Omit<PlacedPackage, 'instanceId'>) => string
  removePackage: (instanceId: string) => void
  movePackage: (instanceId: string, x: number, z: number) => void
  rotatePackage: (instanceId: string, rotationYDeg: number) => void
  selectPackage: (instanceId: string | null) => void
  startDrag: (instanceId: string) => void
  setDragPose: (pose: DragPose) => void
  /** Puts the dragged piece down at `pose`, or back where it was when null. */
  dropDrag: (pose: Omit<DragPose, 'instanceId'> | null) => void
  setDragValid: (valid: boolean) => void
  clear: () => void
}

export const useConfiguration = create<ConfigurationState>((set) => ({
  buildingId: null,
  placed: [],
  exterior: {},
  selectedInstanceId: null,
  draggingInstanceId: null,
  dragPose: null,
  dragValid: true,

  // Guarded on the id it already holds rather than on anything the caller
  // remembers: the configurator screen is unmounted and mounted again on the way
  // through the quiz, so a component that only watched its own prop change never
  // saw the switch at all.
  adoptBuilding: (buildingId) =>
    set((state) =>
      state.buildingId === buildingId
        ? {}
        : {
            buildingId,
            placed: [],
            exterior: {},
            selectedInstanceId: null,
            draggingInstanceId: null,
            dragPose: null,
            dragValid: true,
          },
    ),

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
      placed: state.placed.map((p) => (p.instanceId === instanceId ? { ...p, rotationYDeg } : p)),
    })),

  selectPackage: (instanceId) => set({ selectedInstanceId: instanceId }),
  startDrag: (instanceId) =>
    set({
      draggingInstanceId: instanceId,
      selectedInstanceId: instanceId,
      dragPose: null,
      dragValid: true,
    }),
  setDragPose: (dragPose) => set({ dragPose }),
  // One write for the whole landing: the pose, the end of the drag and the
  // clearing of the live one. Three would be three renders of everything that
  // reads the configuration, for one thing happening.
  dropDrag: (pose) =>
    set((state) => ({
      placed:
        pose && state.draggingInstanceId
          ? state.placed.map((p) =>
              p.instanceId === state.draggingInstanceId
                ? { ...p, x: pose.x, z: pose.z, rotationYDeg: pose.rotationYDeg }
                : p,
            )
          : state.placed,
      draggingInstanceId: null,
      dragPose: null,
      dragValid: true,
    })),
  setDragValid: (valid) => set({ dragValid: valid }),
  clear: () =>
    set({
      placed: [],
      exterior: {},
      selectedInstanceId: null,
      draggingInstanceId: null,
      dragPose: null,
    }),
}))
