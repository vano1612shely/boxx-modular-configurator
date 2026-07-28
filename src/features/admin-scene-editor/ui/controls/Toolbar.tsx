'use client'

import { For, Show } from '@/shared/ui/control-flow'

import type { EditorMode } from '../../model/use-scene-editor-model'
import { s, toolButton } from '../editor-styles'

/**
 * The tools available right now.
 *
 * Every entry here is usable the moment it is drawn — there are no
 * disabled-with-a-tooltip buttons any more. A tool that needs a room simply
 * lives in the room panel.
 */

export type Tool = {
  label: string
  title?: string
  active: boolean
  onSelect: () => void
}

type Props = {
  tools: readonly Tool[]
  /** Shown only while a tool is armed — the select hint was pure noise. */
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
    'The 2D plan turns on automatically. Click the floor corners as you see them from above; click the first point (orange) or press Finish to close the outline.',
  'block-roof':
    'Drag a rectangle over the roof area. The volume is created at roof height — drag its arrows to adjust.',
  'place-opening': 'Click a wall of the generated room to drop the opening there.',
  'pick-floor-y':
    'Click any surface of the model at the level people walk on. Its height becomes this room’s floor.',
}
