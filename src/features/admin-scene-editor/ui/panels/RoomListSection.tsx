'use client'

import { roomOpenings, roomVertices } from '@/entities/building'
import { ROOM_TYPE_OPTIONS } from '@/modules/shared/room-types'
import { For } from '@/shared/ui/control-flow'

import { button, s } from '../editor-styles'
import type { PanelProps } from './shared'

/**
 * The rooms of this building, each a door into room mode.
 *
 * A card is a summary plus one obvious way in — the old version made the whole
 * card a click target for "select", which then quietly changed what half the
 * toolbar did.
 */
export function RoomListSection({ vm, onOpenMenu }: PanelProps) {
  const rooms = vm.draft?.rooms ?? []

  return (
    <For
      each={rooms}
      getKey={(_, i) => i}
      fallback={
        <p style={s.hint}>
          No rooms yet. Use <strong>Draw room</strong> to trace one on the plan, or right-click a
          floor object in the model.
        </p>
      }
    >
      {(room, index) => (
        <div
          style={s.card}
          onContextMenu={(e) =>
            onOpenMenu(e, [
              { label: 'Open room', onClick: () => vm.onEnterRoom(index) },
              { label: 'Camera from view', onClick: () => vm.onSetRoomCameraFromView(index) },
              { label: 'Delete room', danger: true, onClick: () => vm.onRemoveRoom(index) },
            ])
          }
        >
          <div style={s.row}>
            <input
              style={{ ...s.input, flex: 1 }}
              value={room.name}
              onChange={(e) => vm.onUpdateRoom(index, { name: e.target.value })}
            />
            <button
              type="button"
              style={s.danger}
              title="Delete room"
              onClick={() => vm.onRemoveRoom(index)}
            >
              ✕
            </button>
          </div>

          <div style={s.row}>
            <select
              style={{ ...s.select, flex: 1 }}
              value={room.roomType}
              onChange={(e) =>
                vm.onUpdateRoom(index, {
                  roomType: e.target.value as (typeof ROOM_TYPE_OPTIONS)[number]['value'],
                })
              }
            >
              <For each={ROOM_TYPE_OPTIONS} getKey={(option) => option.value}>
                {(option) => <option value={option.value}>{option.label}</option>}
              </For>
            </select>
            <span style={s.mono}>
              {roomVertices(room).length} pts · {roomOpenings(room.openings).length} openings
            </span>
          </div>

          <button
            type="button"
            style={{ ...button('primary'), width: '100%' }}
            onClick={() => vm.onEnterRoom(index)}
          >
            Open room →
          </button>
        </div>
      )}
    </For>
  )
}
