'use client'

import { For, Show } from '@/shared/ui/control-flow'

import { button, s, tone } from '../editor-styles'
import type { PanelProps } from './shared'

const STOREY_COLOR = '#f59e0b'

function metres(value: number): string {
  return `${(Math.round(value * 100) / 100).toFixed(2)}`
}

export function StoreysSection({ vm }: PanelProps) {
  const floors = vm.floors
  const off = vm.roomsOffStoreys

  return (
    <>
      <p style={s.hint}>
        A storey is the slice of the building that stays visible when the visitor picks it —
        everything above and below is cut away, roof included. Set the top just under the
        ceiling so they can look in. The picker only appears once there are two.
      </p>

      <For
        each={floors}
        getKey={(floor, i) => floor.key || `floor-${i}`}
        fallback={<p style={s.hint}>No storeys yet — this building reads as a single one.</p>}
      >
        {(floor, index) => {
          const selected = vm.previewFloorIndex === index
          const box = floor.box
          const rooms = vm.storeyRoomCounts[index] ?? 0

          return (
            <div style={{ ...s.card, borderColor: selected ? STOREY_COLOR : undefined }}>
              <div style={s.row}>
                <input
                  style={{ ...s.input, flex: 1 }}
                  value={floor.name}
                  aria-label={`Storey ${index + 1} name`}
                  onChange={(e) => vm.onRenameFloor(index, e.target.value)}
                />
                <button
                  type="button"
                  style={s.danger}
                  title="Delete storey"
                  onClick={() => vm.onRemoveBlock({ scope: 'floor', index })}
                >
                  ✕
                </button>
              </div>

              <div style={s.row}>
                <span style={s.mono}>
                  {metres(box.min.y)} → {metres(box.max.y)} m · {rooms}{' '}
                  {rooms === 1 ? 'room' : 'rooms'}
                </span>
              </div>

              <button
                type="button"
                style={{ ...button(selected ? 'primary' : undefined), width: '100%' }}
                onClick={() => vm.onPreviewFloor(selected ? null : index)}
              >
                {selected ? 'Stop previewing' : 'Preview & edit →'}
              </button>
            </div>
          )
        }}
      </For>

      {/* Every room is assigned to something, so a volume dragged slightly off
          would move rooms silently. These are the ones it lost. */}
      <Show when={off.length > 0}>
        <p style={{ ...s.hint, color: tone.danger }}>
          Outside every storey: {off.join(', ')}. They still show, on the nearest storey — set
          each room&apos;s floor level, or stretch a storey to reach it.
        </p>
      </Show>

      <button type="button" style={{ ...button(), width: '100%' }} onClick={vm.onAddFloor}>
        + Add storey
      </button>
    </>
  )
}
