'use client'

import { For } from '@/shared/ui/control-flow'

import { sameBlockRef, type BlockRef } from '../../model/use-scene-editor-model'
import { blockRowStyle, rowActionStyle, s, tone } from '../editor-styles'
import { blockMenuItems } from '../menu-items'
import type { PanelProps } from './shared'

/**
 * The volumes the client's Ceiling toggle takes away.
 *
 * There used to be a second, per-room list for ceilings. Same job, same
 * behaviour, two places to look — now there is one.
 */
export function RoofVolumesSection({ vm, onOpenMenu }: PanelProps) {
  const blocks = vm.draft?.sceneConfig?.roofBlocks ?? []

  return (
    <>
      <p style={s.hint}>
        Everything inside these boxes disappears when the visitor hides the roof. Draw one with
        the Roof volume tool, or build it from selected model objects.
      </p>
      <For
        each={blocks}
        getKey={(_, i) => i}
        fallback={<p style={s.hint}>No roof volumes yet.</p>}
      >
        {(_, index) => {
          const ref: BlockRef = { index }
          const selected = vm.selectedBlocks.some((r) => sameBlockRef(r, ref))
          return (
            <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <button
                type="button"
                style={blockRowStyle(selected)}
                title="Right-click for actions"
                onClick={(e) =>
                  e.shiftKey ? vm.onToggleBlockSelection(ref) : vm.onSelectBlock(ref)
                }
                onContextMenu={(e) => onOpenMenu(e, blockMenuItems(vm, ref))}
              >
                <span style={{ color: tone.roof }}>▩</span> Roof volume #{index + 1}
              </button>
              <button
                type="button"
                style={rowActionStyle}
                title="Delete volume"
                onClick={() => vm.onRemoveBlock(ref)}
              >
                ✕
              </button>
            </div>
          )
        }}
      </For>
    </>
  )
}
