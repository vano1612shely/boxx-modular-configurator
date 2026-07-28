'use client'

import { roomOpenings, roomVertices, type RoomDoc } from '@/entities/building'
import { WALL_SIDE_OPTIONS } from '@/modules/shared/room-shell'
import { For } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../../model/use-scene-editor-model'
import { button, s, SIDE_COLORS } from '../../editor-styles'

/**
 * Which outline edge belongs to which of the four walls.
 *
 * The colours live here rather than in a global legend: they only mean
 * anything next to the thing they colour, and the legend was still claiming
 * three colours that no longer existed.
 */
export function RoomWallsSection({
  vm,
  roomIndex,
  room,
}: {
  vm: SceneEditorVm
  roomIndex: number
  room: RoomDoc
}) {
  const vertices = roomVertices(room)
  const openings = roomOpenings(room.openings)

  return (
    <>
      <p style={s.hint}>
        A wall may span several edges, so a recess stays part of the wall it faces. This grouping
        is what the dollhouse hides.
      </p>

      <button
        type="button"
        style={button()}
        onClick={() => vm.onAutoAssignSides(roomIndex)}
      >
        Auto-assign from geometry
      </button>
      <For each={WALL_SIDE_OPTIONS} getKey={(option) => option.value}>
        {(option) => (
          <div style={s.listRow}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                flexShrink: 0,
                background: SIDE_COLORS[option.value],
              }}
            />
            <span style={{ flex: 1, fontSize: 12 }}>{option.label}</span>
            <span style={s.mono}>
              {vertices.filter((v) => v.side === option.value).length} edges ·{' '}
              {openings.filter((o) => o.side === option.value).length} openings
            </span>
          </div>
        )}
      </For>
    </>
  )
}
