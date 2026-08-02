'use client'

import { For, Show } from '@/shared/ui/control-flow'

import type { EditorMode } from '../../model/use-scene-editor-model'
import { s, toolButton } from '../editor-styles'

export type Tool = {
  label: string
  title?: string
  active: boolean
  onSelect: () => void
}

type Props = {
  tools: readonly Tool[]
  hint?: string
}

export function Toolbar({ tools, hint }: Props) {
  return (
    <>
      <div style={s.toolRow}>
        <For each={tools} getKey={(tool) => tool.label}>
          {(tool) => (
            <button
              type="button"
              title={tool.title}
              style={toolButton(tool.active)}
              onClick={tool.onSelect}
            >
              {tool.label}
            </button>
          )}
        </For>
      </div>
      <Show when={hint}>{(text) => <p style={s.hint}>{text}</p>}</Show>
    </>
  )
}

export const MODE_HINTS: Partial<Record<EditorMode, string>> = {
  'draw-room':
    'The 2D plan turns on automatically. Click the floor corners as you see them from above. To close the outline, click the orange first point itself — or press Finish.',
  'block-roof':
    'Drag a rectangle over the roof area. The volume is created at roof height — drag its arrows to adjust.',
  'place-opening': 'Click a wall of the generated room to drop the opening there.',
  'floor-level':
    'Drag the blue plane to the level people walk on, or click a surface of the model to take its height. Press Done when it sits right.',
}
