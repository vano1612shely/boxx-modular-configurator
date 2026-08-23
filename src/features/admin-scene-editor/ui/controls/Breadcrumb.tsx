'use client'

import { For, Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../model/use-scene-editor-model'
import { tone } from '../editor-styles'

type Props = { vm: SceneEditorVm }

/**
 * Where you are, and the only two ways out of it.
 *
 * It replaces a "← Back to building" button that could only do one of them.
 * Going from one room to the next used to be: out to the building, find the
 * room list, scroll, open — four moves to change one thing, on a building with
 * a dozen rooms. The room segment is a picker, so it is one.
 */
export function Breadcrumb({ vm }: Props) {
  const rooms = vm.draft?.rooms ?? []
  const inRoom = vm.selectedRoomIndex !== null
  const spot = vm.spotMode ? vm.exteriorSlots[vm.selectedSlotIndex ?? -1] : undefined
  const deep = inRoom || spot !== undefined

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '9px 12px',
        borderBottom: `1px solid ${tone.line}`,
        background: tone.panel,
        minHeight: 42,
      }}
    >
      <button
        type="button"
        title="The whole building"
        onClick={() => {
          vm.onExitRoom()
          vm.onSelectSlot(null)
        }}
        disabled={!deep}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 6px',
          borderRadius: 6,
          border: '1px solid transparent',
          background: 'transparent',
          color: deep ? tone.textMuted : tone.text,
          fontSize: 12,
          fontWeight: deep ? 500 : 600,
          cursor: deep ? 'pointer' : 'default',
          maxWidth: deep ? 120 : '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        ⌂ {vm.doc?.title ?? 'Scene'}
      </button>

      {/* An exterior spot is the third place you can be. It has no picker of
          its own — there are rarely more than a handful, and the list is one
          click away under the building's Exterior tab. */}
      <Show when={spot}>
        {(picked) => (
          <>
            <span aria-hidden style={{ color: tone.textFaint, fontSize: 12 }}>
              ▸
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 12,
                fontWeight: 600,
                color: tone.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {picked.name || 'Spot'}
            </span>
          </>
        )}
      </Show>

      <Show when={inRoom}>
        <span aria-hidden style={{ color: tone.textFaint, fontSize: 12 }}>
          ▸
        </span>

        {/* A picker rather than a label: the name of the room you are in is
            also the list of the rooms you could be in instead. */}
        <select
          aria-label="Room"
          value={String(vm.selectedRoomIndex)}
          onChange={(event) => vm.onEnterRoom(Number(event.target.value))}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '4px 6px',
            borderRadius: 6,
            border: `1px solid ${tone.lineSoft}`,
            background: tone.card,
            color: tone.text,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <For each={rooms} getKey={(_, index) => index}>
            {(room, index) => <option value={index}>{room.name || `Room ${index + 1}`}</option>}
          </For>
        </select>
      </Show>
    </div>
  )
}
