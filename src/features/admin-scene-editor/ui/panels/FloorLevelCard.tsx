'use client'

import { Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../model/use-scene-editor-model'
import { NumberInput } from '../controls/NumberInput'
import { button, s, toolButton } from '../editor-styles'

const STEP = 0.05

// The glb's own zero is the underside of the chassis, never a walkable floor.
export function FloorLevelCard({ vm, hint }: { vm: SceneEditorVm; hint?: string }) {
  const adjusting = vm.mode === 'floor-level'

  return (
    <div style={s.card}>
      <h3 style={s.heading}>Floor level</h3>

      <div style={s.row}>
        <button
          type="button"
          style={{ ...button(), padding: '6px 12px' }}
          title={`Down ${STEP} m`}
          onClick={() => vm.onNudgeFloorLevel(-STEP)}
        >
          −
        </button>
        <NumberInput
          style={{ ...s.input, flex: 1, textAlign: 'center' }}
          value={vm.floorPlaneY}
          onCommit={vm.onSetFloorLevel}
        />
        <button
          type="button"
          style={{ ...button(), padding: '6px 12px' }}
          title={`Up ${STEP} m`}
          onClick={() => vm.onNudgeFloorLevel(STEP)}
        >
          +
        </button>
      </div>

      <button
        type="button"
        style={adjusting ? button('primary') : toolButton(false)}
        onClick={() => vm.onSetMode(adjusting ? 'select' : 'floor-level')}
      >
        {adjusting ? '✓ Done' : '⇕ Adjust in the viewport'}
      </button>

      <Show when={hint}>{(text) => <p style={s.hint}>{text}</p>}</Show>
    </div>
  )
}
