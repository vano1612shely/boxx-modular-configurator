'use client'

import type { RoomDoc } from '@/entities/building'
import { polygonAreaSqFt, polygonSignedArea, roomVertices } from '@/entities/building'
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
 * Floor area in both units, empty meaning "work it out from the outline".
 *
 * Not NumberInputs: these have to be able to hold nothing, and nothing is the
 * state that keeps the figure honest when a corner is dragged later. The traced
 * number shows as the placeholder so it is never a mystery what empty means.
 *
 * Filling one and leaving the other empty is a supported answer — the client
 * converts the empty one from the filled one, on the grounds that whoever typed
 * a figure was holding a better drawing than the trace. The button fills both
 * at once from the outline rather than one from the other, so a stamped pair is
 * never a conversion of a rounded number.
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
  const polygon = roomVertices(room)
  const traced = {
    areaSqFt: Math.round(polygonAreaSqFt(polygon)),
    areaSqM: Math.round(Math.abs(polygonSignedArea(polygon)) * 10) / 10,
  }
  const stored = {
    areaSqFt: typeof room.areaSqFt === 'number' ? room.areaSqFt : null,
    areaSqM: typeof room.areaSqM === 'number' ? room.areaSqM : null,
  }
  const authored = stored.areaSqFt !== null || stored.areaSqM !== null

  const field = (key: 'areaSqFt' | 'areaSqM', unit: string) => (
    <label style={s.field}>
      <span style={s.label}>{unit}</span>
      <input
        type="number"
        style={{ ...s.input, minWidth: 0 }}
        placeholder={String(traced[key])}
        value={stored[key] ?? ''}
        onChange={(event) => {
          const raw = event.target.value
          const next = Number.parseFloat(raw)
          vm.onUpdateRoom(roomIndex, {
            [key]: raw === '' || Number.isNaN(next) ? null : next,
          })
        }}
      />
    </label>
  )

  return (
    <div style={{ ...s.field, gridColumn: '1 / -1' }}>
      <span style={s.label}>Floor area — empty follows the outline</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 4 }}>
        {field('areaSqFt', 'ft²')}
        {field('areaSqM', 'm²')}
        <button
          type="button"
          style={{ ...button('ghost'), flexShrink: 0, alignSelf: 'end' }}
          title={authored ? 'Follow the outline again' : 'Write the traced figures in'}
          onClick={() =>
            vm.onUpdateRoom(
              roomIndex,
              authored ? { areaSqFt: null, areaSqM: null } : traced,
            )
          }
        >
          {authored ? 'Auto' : '= traced'}
        </button>
      </div>
    </div>
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
