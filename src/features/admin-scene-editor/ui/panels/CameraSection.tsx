'use client'

import type { SceneEditorVm } from '../../model/use-scene-editor-model'
import { s } from '../editor-styles'

/**
 * How near and how wide the visitor's camera may go.
 *
 * Where it opens from is not here, and is not anywhere: the rig frames whatever
 * is on screen the moment it has bounds to frame it against, so an authored
 * opening pose was being overwritten before anybody saw it. These three are the
 * part the rig still reads.
 */
export function CameraSection({ vm }: { vm: SceneEditorVm }) {
  const camera = vm.draft?.sceneConfig?.camera

  return (
    <>
      <div style={s.row}>
        <label style={s.hint}>fov</label>
        <input
          style={s.inputTiny}
          type="number"
          value={camera?.fov ?? 50}
          onChange={(e) => vm.onSetCameraLimits({ fov: Number(e.target.value) })}
        />
        <label style={s.hint}>min d</label>
        <input
          style={s.inputTiny}
          type="number"
          value={camera?.minDistance ?? 2}
          onChange={(e) => vm.onSetCameraLimits({ minDistance: Number(e.target.value) })}
        />
        <label style={s.hint}>max d</label>
        <input
          style={s.inputTiny}
          type="number"
          value={camera?.maxDistance ?? 30}
          onChange={(e) => vm.onSetCameraLimits({ maxDistance: Number(e.target.value) })}
        />
      </div>
      <p style={s.hint}>
        How close the visitor may get and how far back they may pull, and the lens the scene is
        drawn with.
      </p>
    </>
  )
}
