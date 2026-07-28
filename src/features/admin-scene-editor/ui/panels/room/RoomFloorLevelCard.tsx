'use client'

import type { SceneEditorVm } from '../../../model/use-scene-editor-model'
import { NumberInput } from '../../controls/NumberInput'
import { button, s, toolButton } from '../../editor-styles'

const STEP = 0.05

/**
 * The height the room sits at.
 *
 * Three ways to set it, all landing on the same value: drag the blue plane in
 * the viewport, nudge it in 5 cm steps, or point at a surface of the model and
 * take its height. The glb's own zero is the underside of the building, which
 * is never a floor anybody walks on — so this always needs setting.
 */
export function RoomFloorLevelCard({ vm }: { vm: SceneEditorVm }) {
  const picking = vm.mode === 'pick-floor-y'

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
        style={toolButton(picking)}
        onClick={() => vm.onSetMode(picking ? 'select' : 'pick-floor-y')}
      >
        {picking ? 'Click a surface…' : '⌖ Snap to a surface'}
      </button>

      <p style={s.hint}>
        Drag the blue plane in the viewport, or snap it to a floor slab of the model.
      </p>
    </div>
  )
}
