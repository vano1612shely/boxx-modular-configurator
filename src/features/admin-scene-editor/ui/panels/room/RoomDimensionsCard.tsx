'use client'

import type { RoomDoc } from '@/entities/building'
import { polygonAreaSqFt, roomVertices } from '@/entities/building'
import { SHELL_DEFAULTS } from '@/modules/shared/room-shell'

import type { SceneEditorVm } from '../../../model/use-scene-editor-model'
import { NumberInput } from '../../controls/NumberInput'
import { button, s } from '../../editor-styles'

function Field({
  label,
  value,
  onCommit,
}: {
  label: string
  value: number
  onCommit: (value: number) => void
}) {
  return (
    <label style={s.field}>
      <span style={s.label}>{label}</span>
      <NumberInput style={s.input} value={value} onCommit={onCommit} />
    </label>
  )
}

/**
 * Floor area, empty meaning "work it out from the outline".
 *
 * Not a NumberInput: this field has to be able to hold nothing, and nothing is
 * the state that keeps the figure honest when a corner is dragged later. The
 * traced number shows as the placeholder so it is never a mystery what empty
 * means, and the button stamps it in for anyone who wants it fixed.
 */
function AreaField({
  vm,
  roomIndex,
  room,
}: {
  vm: SceneEditorVm
  roomIndex: number
  room: RoomDoc
}) {
  const traced = Math.round(polygonAreaSqFt(roomVertices(room)))
  const stored = typeof room.areaSqFt === 'number' ? room.areaSqFt : null

  return (
    <label style={{ ...s.field, gridColumn: '1 / -1' }}>
      <span style={s.label}>Floor area (ft²) — empty follows the outline</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          type="number"
          style={{ ...s.input, flex: 1, minWidth: 0 }}
          placeholder={String(traced)}
          value={stored ?? ''}
          onChange={(event) => {
            const raw = event.target.value
            const next = Number.parseFloat(raw)
            vm.onUpdateRoom(roomIndex, {
              areaSqFt: raw === '' || Number.isNaN(next) ? null : next,
            })
          }}
        />
        <button
          type="button"
          style={{ ...button('ghost'), flexShrink: 0 }}
          title={stored === null ? `Write ${traced} ft² in` : 'Follow the outline again'}
          onClick={() =>
            vm.onUpdateRoom(roomIndex, { areaSqFt: stored === null ? traced : null })
          }
        >
          {stored === null ? `= ${traced}` : 'Auto'}
        </button>
      </div>
    </label>
  )
}

export function RoomDimensionsCard({
  vm,
  roomIndex,
  room,
}: {
  vm: SceneEditorVm
  roomIndex: number
  room: RoomDoc
}) {
  const shell = (room.shell ?? {}) as Record<string, number | undefined>

  return (
    <div style={s.card}>
      <h3 style={s.heading}>Dimensions</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <Field
          label="Wall height"
          value={shell.wallHeight ?? SHELL_DEFAULTS.wallHeight}
          onCommit={(wallHeight) => vm.onUpdateShell(roomIndex, { wallHeight })}
        />
        <Field
          label="Wall thickness"
          value={shell.wallThickness ?? SHELL_DEFAULTS.wallThickness}
          onCommit={(wallThickness) => vm.onUpdateShell(roomIndex, { wallThickness })}
        />
        <Field
          label="Floor slab"
          value={shell.floorThickness ?? SHELL_DEFAULTS.floorThickness}
          onCommit={(floorThickness) => vm.onUpdateShell(roomIndex, { floorThickness })}
        />
        <Field
          label="Ceiling slab"
          value={shell.ceilingThickness ?? SHELL_DEFAULTS.ceilingThickness}
          onCommit={(ceilingThickness) => vm.onUpdateShell(roomIndex, { ceilingThickness })}
        />
        <AreaField vm={vm} roomIndex={roomIndex} room={room} />
      </div>
    </div>
  )
}
