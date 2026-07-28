'use client'

import type { SceneEditorVm } from '../../model/use-scene-editor-model'
import { button, s } from '../editor-styles'

/** The camera the client opens the building with. */
export function CameraSection({ vm }: { vm: SceneEditorVm }) {
  const camera = vm.draft?.sceneConfig?.camera

  return (
    <>
      <button type="button" style={button()} onClick={vm.onSetDefaultCameraFromView}>
        Set from current view
      </button>
      <p style={s.hint}>
        Where the visitor lands when the configurator opens. Frame it in 3D, then press the
        button.
      </p>
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
    </>
  )
}
