import { create } from 'zustand'

import { uniqueId } from '@/shared/lib'

import type { DragPose, PlacedPackage } from './types'

/**
 * A configuration whole: a building, its furniture and its exterior picks.
 *
 * `buildingId` is nullable because this is used in both directions — to open a
 * saved order, and to put back whatever the store held before one was opened,
 * which may be nothing at all.
 */
export type ConfigurationSnapshot = {
  buildingId: number | null
  placed: PlacedPackage[]
  exterior: Record<string, string>
}

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
  /** Opens a configuration that was saved earlier, whole. */
  hydrate: (snapshot: ConfigurationSnapshot) => void
  setExteriorVariant: (slotKey: string, variantKey: string) => void
  addPackage: (placement: Omit<PlacedPackage, 'instanceId'>) => string
  /**
   * Puts down every piece of a group at once, under one shared id.
   *
   * One write rather than a loop of `addPackage`: that action leaves the last
   * piece selected, which would raise a toolbar around whichever chair happened
   * to be listed last, and each call would re-render everything that reads the
   * configuration. Returns the group's id, or null when handed nothing.
   */
  addGroup: (pieces: ReadonlyArray<Omit<PlacedPackage, 'instanceId' | 'groupId'>>) => string | null
  removePackage: (instanceId: string) => void
  movePackage: (instanceId: string, x: number, z: number) => void
  rotatePackage: (instanceId: string, rotationYDeg: number) => void
  selectPackage: (instanceId: string | null) => void
  startDrag: (instanceId: string) => void
  setDragPose: (pose: DragPose) => void
  /** Puts the dragged piece down at `pose`, or back where it was when null. */
  dropDrag: (pose: Omit<DragPose, 'instanceId'> | null) => void
  setDragValid: (valid: boolean) => void
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

  /**
   * One write rather than a loop of `addPackage`.
   *
   * That action mints an id per piece and leaves the last one selected, which
   * on a page that cannot be edited would draw an outline and a toolbar around
   * a piece nobody picked. It also names the building outright, so the guard in
   * `adoptBuilding` cannot mistake a saved order for the session in progress.
   *
   * Unguarded, unlike `adoptBuilding`: this is how the order view both opens a
   * saved configuration and puts back the one it displaced, and putting a
   * configuration back into the building it already belonged to is exactly the
   * case a guard on `buildingId` would refuse.
   */
  hydrate: ({ buildingId, placed, exterior }) =>
    set({
      buildingId,
      placed,
      exterior,
      selectedInstanceId: null,
      draggingInstanceId: null,
      dragPose: null,
      dragValid: true,
    }),

  setExteriorVariant: (slotKey, variantKey) =>
    set((state) => ({ exterior: { ...state.exterior, [slotKey]: variantKey } })),

  // A pinned piece is not selected on the way in: selection raises a toolbar
  // offering to turn and move it, and it is exactly the thing that does neither.
  addPackage: (placement) => {
    const instanceId = uniqueId()
    set((state) => ({
      placed: [...state.placed, { ...placement, instanceId }],
      selectedInstanceId: placement.pinned ? null : instanceId,
    }))
    return instanceId
  },

  addGroup: (pieces) => {
    if (pieces.length === 0) return null

    const groupId = uniqueId()
    set((state) => ({
      placed: [
        ...state.placed,
        ...pieces.map((piece) => ({ ...piece, groupId, instanceId: uniqueId() })),
      ],
      // Nothing is selected on the way in. A single piece is selected because
      // the visitor is expected to want it where they meant it; a group has no
      // one piece to say that about, and picking one would put a toolbar around
      // whichever chair came last.
      selectedInstanceId: null,
    }))
    return groupId
  },

  // Takes the whole group when the piece asked for belongs to one: a table
  // and its chairs are one thing to buy and one thing to be rid of, and leaving
  // three chairs around the space where a table was is not what "remove" means
  // on the card that put them there.
  removePackage: (instanceId) =>
    set((state) => {
      const target = state.placed.find((p) => p.instanceId === instanceId)
      if (!target) return {}

      const doomed = new Set(
        target.groupId
          ? state.placed.filter((p) => p.groupId === target.groupId).map((p) => p.instanceId)
          : [instanceId],
      )

      return {
        placed: state.placed.filter((p) => !doomed.has(p.instanceId)),
        selectedInstanceId:
          state.selectedInstanceId !== null && doomed.has(state.selectedInstanceId)
            ? null
            : state.selectedInstanceId,
      }
    }),

  // The four ways a piece could be edited, each refusing a pinned one.
  //
  // Here rather than only in the scene, where the pinned piece is already drawn
  // with no pointer handlers at all: this is the last door, and it is the one
  // every other way in — the panel, a keyboard shortcut, a future feature —
  // goes through. A rule worth one line in four places is worth having.
  movePackage: (instanceId, x, z) =>
    set((state) => ({
      placed: state.placed.map((p) =>
        p.instanceId === instanceId && !p.pinned ? { ...p, x, z } : p,
      ),
    })),

  rotatePackage: (instanceId, rotationYDeg) =>
    set((state) => ({
      placed: state.placed.map((p) =>
        p.instanceId === instanceId && !p.pinned ? { ...p, rotationYDeg } : p,
      ),
    })),

  selectPackage: (instanceId) =>
    set((state) => ({
      selectedInstanceId:
        instanceId !== null && state.placed.some((p) => p.instanceId === instanceId && p.pinned)
          ? state.selectedInstanceId
          : instanceId,
    })),
  startDrag: (instanceId) =>
    set((state) =>
      state.placed.some((p) => p.instanceId === instanceId && p.pinned)
        ? {}
        : {
            draggingInstanceId: instanceId,
            selectedInstanceId: instanceId,
            dragPose: null,
            dragValid: true,
          },
    ),
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
}))
