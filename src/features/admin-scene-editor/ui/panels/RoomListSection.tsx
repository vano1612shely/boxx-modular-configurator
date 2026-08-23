'use client'

import { roomOpenings, roomVertices } from '@/entities/building'
import { For } from '@/shared/ui/control-flow'

import { roomTypeIdOf } from '../../model/use-room-types'

import { s, tone } from '../editor-styles'
import type { PanelProps } from './shared'

const tight: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center' }

const iconButton: React.CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  border: `1px solid ${tone.lineStrong}`,
  background: tone.raised,
  color: tone.text,
  fontSize: 13,
  cursor: 'pointer',
  padding: 0,
}

/**
 * Every room of the building, two lines each.
 *
 * It used to be three blocks and a full-width button per room — a hundred and
 * twenty pixels of sidebar for a name, a type and a way in. Five rooms filled
 * the panel and a real building has more. What a list of rooms is for is
 * finding one, so a room is now as short as its own facts allow, and the way in
 * is the arrow rather than a banner.
 */
export function RoomListSection({ vm, onOpenMenu }: PanelProps) {
  const rooms = vm.draft?.rooms ?? []

  return (
    <div style={s.tabBody}>
      <For
        each={rooms}
        getKey={(_, i) => i}
        fallback={
          <p style={s.hint}>
            No rooms yet. Use <strong>Draw room</strong> in the viewport to trace one on the plan,
            or right-click a floor object in the model.
          </p>
        }
      >
        {(room, index) => (
          <div
            style={{ ...s.card, padding: 8, gap: 6 }}
            onContextMenu={(e) =>
              onOpenMenu(e, [
                { label: 'Open room', onClick: () => vm.onEnterRoom(index) },
                { label: 'Delete room', danger: true, onClick: () => vm.onRemoveRoom(index) },
              ])
            }
          >
            <div style={tight}>
              <input
                style={{
                  ...s.input,
                  flex: 1,
                  minWidth: 0,
                  ...(room.name?.trim() ? null : s.inputInvalid),
                }}
                placeholder="Name this room"
                value={room.name}
                onChange={(e) => vm.onUpdateRoom(index, { name: e.target.value })}
              />
              <button
                type="button"
                style={{ ...iconButton, border: `1px solid ${tone.accent}`, color: tone.accent }}
                title="Open this room"
                aria-label={`Open ${room.name || `room ${index + 1}`}`}
                onClick={() => vm.onEnterRoom(index)}
              >
                →
              </button>
              <button
                type="button"
                style={{ ...iconButton, color: tone.danger }}
                title="Delete room"
                aria-label={`Delete ${room.name || `room ${index + 1}`}`}
                onClick={() => vm.onRemoveRoom(index)}
              >
                ✕
              </button>
            </div>

            <div style={tight}>
              <select
                style={{ ...s.select, flex: 1, minWidth: 0 }}
                value={roomTypeIdOf(room.roomType)}
                onChange={(e) => vm.onUpdateRoom(index, { roomType: Number(e.target.value) })}
              >
                <For each={vm.roomTypes} getKey={(type) => type.id}>
                  {(type) => <option value={type.id}>{type.name}</option>}
                </For>
              </select>
              <span
                style={{ ...s.mono, flexShrink: 0, whiteSpace: 'nowrap' }}
                title="Outline points · openings"
              >
                {roomVertices(room).length} pts · {roomOpenings(room.openings).length} op
              </span>
            </div>
          </div>
        )}
      </For>
    </div>
  )
}
