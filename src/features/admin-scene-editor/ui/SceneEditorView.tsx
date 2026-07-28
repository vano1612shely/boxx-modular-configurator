'use client'

import { Gate } from '@/shared/ui/control-flow'

import { useSceneEditorModel } from '../model/use-scene-editor-model'
import { EditorCanvas } from './EditorCanvas'
import { EditorSidebar } from './EditorSidebar'

/**
 * Custom Payload document view: visual setup of a building model's scene —
 * camera, hidden meshes and the rooms the client can step into.
 */
export function SceneEditorView() {
  const vm = useSceneEditorModel()

  return (
    <div
      className="scene-editor-root"
      style={{
        display: 'flex',
        height: 'calc(100vh - 170px)',
        minHeight: 480,
        background: '#0f1012',
      }}
    >
      <Gate
        loading={vm.isLoading}
        loadingFallback={
          <p style={{ margin: 'auto', color: '#9aa1ab', fontSize: 14 }}>Loading scene…</p>
        }
        error={vm.modelUrl === null && !vm.isLoading ? 'no-model' : undefined}
        errorFallback={
          <p style={{ margin: 'auto', color: '#9aa1ab', fontSize: 14 }}>
            Attach a 3D model to this building first, then reopen the Scene Editor.
          </p>
        }
      >
        <div style={{ flex: 1, position: 'relative' }}>
          <EditorCanvas vm={vm} />
        </div>
        <EditorSidebar vm={vm} />
      </Gate>
    </div>
  )
}

export default SceneEditorView
