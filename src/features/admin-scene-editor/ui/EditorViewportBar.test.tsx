import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { SceneEditorVm } from '../model/use-scene-editor-model'
import { Breadcrumb } from './controls/Breadcrumb'
import { EditorViewportBar } from './EditorViewportBar'

afterEach(cleanup)

/**
 * As much of the editor's view model as these two read.
 *
 * A stub rather than the real hook: the hook talks to Payload and to a WebGL
 * canvas, and what is under test here is a question neither of those answers —
 * whether every control the sidebar used to carry still exists somewhere after
 * it was taken apart.
 */
function vmStub(over: Record<string, unknown> = {}): SceneEditorVm {
  return {
    draft: { rooms: [{ name: 'Room 1' }, { name: 'Kitchen' }], sceneConfig: {} },
    doc: { title: 'BOXXPlex 4' },
    mode: 'select',
    roomMode: false,
    spotMode: false,
    selectedRoomIndex: null,
    selectedSlotIndex: null,
    exteriorSlots: [],
    roomTab: 'shape',
    openingKind: 'door',
    planMode: false,
    ghostModel: true,
    roofHidden: false,
    floors: [{ name: 'Ground' }, { name: 'First' }],
    previewFloorIndex: null,
    drawingPoints: [],
    onSetMode: () => {},
    onSetOpeningKind: () => {},
    onSetPlanMode: () => {},
    onSetGhostModel: () => {},
    onSetRoofHidden: () => {},
    onPreviewFloor: () => {},
    onFinishRoom: () => {},
    onCancelDrawing: () => {},
    onExitRoom: () => {},
    onEnterRoom: () => {},
    onSelectSlot: () => {},
    ...over,
  } as unknown as SceneEditorVm
}

const inRoom = (over: Record<string, unknown> = {}) =>
  vmStub({ roomMode: true, selectedRoomIndex: 0, ...over })

describe('the viewport bar — the building', () => {
  /**
   * Every tool the building panel's own toolbar used to carry. They moved onto
   * the viewport; this is the list that says none of them was dropped on the
   * way, which is the whole risk of moving a toolbar.
   */
  it('carries every tool the sidebar used to', () => {
    render(<EditorViewportBar vm={vmStub()} />)

    for (const label of ['Select', '✏ Draw room', '▩ Roof volume', '⇕ Floor level']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
  })

  it('carries the view, the roof and the storey', () => {
    render(<EditorViewportBar vm={vmStub()} />)

    expect(screen.getByRole('button', { name: '3D' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '2D plan' })).toBeTruthy()
    // Beside the two views rather than floating over a corner of the viewport
    // on its own, which is where it was when it shared that corner with a
    // compass nobody was asking.
    expect(screen.getByRole('button', { name: 'Reset view' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Shown' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hidden' })).toBeTruthy()
    // "All" plus one per storey.
    expect(screen.getByRole('button', { name: 'All' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '2' })).toBeTruthy()
  })

  // Finishing an outline is a viewport gesture and the button belongs with it.
  it('offers to finish an outline only once one can be closed', () => {
    render(<EditorViewportBar vm={vmStub({ mode: 'draw-room', drawingPoints: [{}, {}] })} />)
    expect(screen.queryByRole('button', { name: /Finish/ })).toBeNull()

    cleanup()
    render(<EditorViewportBar vm={vmStub({ mode: 'draw-room', drawingPoints: [{}, {}, {}] })} />)
    expect(screen.getByRole('button', { name: '✓ Finish (3)' })).toBeTruthy()
  })
})

describe('the viewport bar — a room', () => {
  it('carries every tool the room panel used to', () => {
    render(<EditorViewportBar vm={inRoom()} />)

    for (const label of ['Select', '⌷ Door', '⊞ Window', '✂ Divide']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
  })

  // Nothing is furnished in a restroom, so a cut there would mean nothing.
  it('drops the divide tool in a restroom', () => {
    render(
      <EditorViewportBar
        vm={inRoom({ draft: { rooms: [{ name: 'WC', isRestroom: true }], sceneConfig: {} } })}
      />,
    )
    expect(screen.queryByRole('button', { name: '✂ Divide' })).toBeNull()
  })

  /**
   * The tool exists to put a piece of the building into one of the room's two
   * fitting lists. From the Shape tab there is no such list on screen, and the
   * picked object would land somewhere the admin cannot see.
   */
  it('offers the model picker only where a picked object has somewhere to go', () => {
    render(<EditorViewportBar vm={inRoom({ roomTab: 'shape' })} />)
    expect(screen.queryByRole('button', { name: /Take from model/ })).toBeNull()

    cleanup()
    render(<EditorViewportBar vm={inRoom({ roomTab: 'built-ins' })} />)
    expect(screen.getByRole('button', { name: '⦿ Take from model' })).toBeTruthy()
  })

  it('swaps the building-wide switches for the ones a room has', () => {
    render(<EditorViewportBar vm={inRoom()} />)

    expect(screen.getByRole('button', { name: 'Ghost' })).toBeTruthy()
    // A storey picker inside a room says nothing: the room is on one storey.
    expect(screen.queryByRole('button', { name: 'All' })).toBeNull()
  })
})

describe('the breadcrumb', () => {
  it('names the building, and cannot leave it when it is where you are', () => {
    render(<Breadcrumb vm={vmStub()} />)

    const home = screen.getByRole('button', { name: /BOXXPlex 4/ })
    expect(home.hasAttribute('disabled')).toBe(true)
  })

  /**
   * The move this replaces: out to the building, find the room list, scroll,
   * open. Four gestures to change one thing, on a building with a dozen rooms.
   */
  it('turns the room you are in into the list of rooms you could be in', () => {
    render(<Breadcrumb vm={inRoom()} />)

    const picker = screen.getByLabelText('Room') as HTMLSelectElement
    expect([...picker.options].map((option) => option.text)).toEqual(['Room 1', 'Kitchen'])
    expect(picker.value).toBe('0')
    expect(screen.getByRole('button', { name: /BOXXPlex 4/ }).hasAttribute('disabled')).toBe(false)
  })

  it('names an exterior spot as the third place you can be', () => {
    render(
      <Breadcrumb
        vm={vmStub({ spotMode: true, selectedSlotIndex: 1, exteriorSlots: [{}, { name: 'Rear deck' }] })}
      />,
    )

    expect(screen.getByText('Rear deck')).toBeTruthy()
    expect(screen.queryByLabelText('Room')).toBeNull()
  })
})
