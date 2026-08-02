'use client'

import type { RoomDoc } from '@/entities/building'
import { SUN_DIRECTION_OPTIONS, type SunDirection } from '@/modules/shared/room-shell'
import { For } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../../model/use-scene-editor-model'
import { s } from '../../editor-styles'

export function RoomDaylightCard({
  vm,
  roomIndex,
  room,
}: {
  vm: SceneEditorVm
  roomIndex: number
  room: RoomDoc
}) {
  const shell = (room.shell ?? {}) as { sunDirection?: SunDirection | null }
  const chosen = shell.sunDirection ?? ''

  return (
    <div style={s.card}>
      <h3 style={s.heading}>Daylight</h3>

      <div style={s.row}>
        <span aria-hidden style={{ fontSize: 15, flexShrink: 0, opacity: chosen ? 1 : 0.35 }}>
          ☀
        </span>
        <select
          style={{ ...s.select, flex: 1, minWidth: 0 }}
          value={chosen}
          onChange={(event) =>
            vm.onUpdateShell(roomIndex, {
              sunDirection:
                event.target.value === '' ? null : (event.target.value as SunDirection),
            })
          }
        >
          <option value="">Auto — outside the wall with the most glass</option>
          <For each={SUN_DIRECTION_OPTIONS} getKey={(option) => option.value}>
            {(option) => <option value={option.value}>Sun in the {option.label}</option>}
          </For>
        </select>
      </div>

      <p style={s.hint}>
        Windows in walls facing the sun throw daylight in; the shaded side does not. The marker in
        the viewport shows where it is — check it against the compass.
      </p>
    </div>
  )
}
