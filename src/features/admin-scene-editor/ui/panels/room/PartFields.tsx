'use client'

import { Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../../model/use-scene-editor-model'
import { NumberInput } from '../../controls/NumberInput'
import { button, s } from '../../editor-styles'

const iconButton = { ...button(), padding: '5px 8px', fontSize: 12 }

/**
 * Where the selection stands, as numbers.
 *
 * The selection rather than one fitting, so a merged water cooler reads as one
 * position and turns about its own middle — the same thing the puck and the
 * ring in the viewport do, because they call the same three actions.
 *
 * Shared by the panel and the right-click popup. They are the same fields in
 * two places, and one of them drifting from the other is exactly the sort of
 * thing nobody notices until an admin types a number into the wrong one.
 */
export function PartFields({ vm, compact = false }: { vm: SceneEditorVm; compact?: boolean }) {
  const centre = vm.selectionCentre

  if (!centre) return null

  if (!vm.selectionArrangeable) {
    return (
      <p style={{ ...s.hint, marginTop: compact ? 0 : 8 }}>
        A piece of the building stands where the building has it. Nothing to set.
      </p>
    )
  }

  return (
    <>
      <div
        style={{
          marginTop: compact ? 0 : 8,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
        }}
      >
        <label style={s.field}>
          <span style={s.label}>X m</span>
          {/* Only the axis the field owns; the others are left alone rather
              than handed back from this render's copy of the centre. */}
          <NumberInput
            style={s.input}
            value={centre.x}
            onCommit={(value) => vm.onMoveSelectionTo(value, null, null)}
          />
        </label>
        <label style={s.field}>
          <span style={s.label}>Z m</span>
          <NumberInput
            style={s.input}
            value={centre.z}
            onCommit={(value) => vm.onMoveSelectionTo(null, null, value)}
          />
        </label>
        <label style={s.field}>
          <span style={s.label}>Height m</span>
          <NumberInput
            style={s.input}
            step={0.01}
            value={centre.y}
            onCommit={(value) => vm.onMoveSelectionTo(null, value, null)}
          />
        </label>
        <div style={s.field}>
          <span style={s.label}>Facing °</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <NumberInput
              style={{ ...s.input, flex: 1, minWidth: 0 }}
              step={5}
              value={vm.selectionYawDeg}
              onCommit={(value) => vm.onSetSelectionYaw(value)}
            />
            <button
              type="button"
              style={{ ...iconButton, flexShrink: 0 }}
              title="Quarter turn"
              onClick={() => vm.onSetSelectionYaw((vm.selectionYawDeg + 90) % 360)}
            >
              ↻
            </button>
          </div>
        </div>
        <label style={s.field}>
          <span style={s.label}>Scale</span>
          <NumberInput
            style={s.input}
            step={0.01}
            value={vm.selectionScale}
            onCommit={(value) => vm.onSetSelectionScale(value)}
          />
        </label>
      </div>

      <Show when={!compact}>
        <p style={{ ...s.hint, marginTop: 6 }}>
          In the viewport: the white puck under it moves it across the floor, the yellow arrow over
          it sets the height, and the blue grip on the ring turns it. Height is measured from this
          room&rsquo;s floor, so a microwave on a 0.92 m worktop stays on it if the storey is ever
          re-levelled.
        </p>
      </Show>
    </>
  )
}
