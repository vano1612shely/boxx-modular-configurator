'use client'

import type { RoomDoc } from '@/entities/building'
import { SHELL_DEFAULTS } from '@/modules/shared/room-shell'

import type { SceneEditorVm } from '../../../model/use-scene-editor-model'
import { NumberInput } from '../../controls/NumberInput'
import { s } from '../../editor-styles'

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

/** How tall and how thick — the numbers the room is generated from. */
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
      </div>
    </div>
  )
}
