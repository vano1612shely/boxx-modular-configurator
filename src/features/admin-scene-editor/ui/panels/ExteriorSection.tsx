'use client'

import { For, Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../model/use-scene-editor-model'
import { button, s, tone } from '../editor-styles'

/**
 * The building's exterior spots, as a list and nothing more.
 *
 * Opening one takes over the sidebar, the way entering a room does: a spot has
 * its own models, its own choices and its own objects, and none of that fits
 * under an accordion on a panel that is already about something else.
 */
export function ExteriorSection({ vm }: { vm: SceneEditorVm }) {
  return (
    <>
      <p style={s.hint}>
        Places outside the building where the visitor picks between a deck, stairs and a ramp. Leave
        this empty and the building is shown exactly as it is, with no panel.
      </p>

      <button type="button" style={{ ...button('primary'), marginTop: 8 }} onClick={vm.onAddSlot}>
        + Spot
      </button>

      <For each={vm.exteriorSlots} getKey={(slot, index) => slot.key || String(index)}>
        {(slot, index) => {
          const variants = slot.variants ?? []

          return (
            <div style={{ ...s.card, marginTop: 8 }}>
              <div style={s.row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, color: tone.text }}>
                    {slot.name || `Entrance ${index + 1}`}
                  </p>
                  <p style={{ ...s.hint, marginTop: 2 }}>
                    {variants.length < 2
                      ? `${variants.length} of 2 choices`
                      : `${variants.length} choices`}
                  </p>
                </div>
                <button
                  type="button"
                  style={{ ...button('danger'), padding: '5px 8px', fontSize: 12 }}
                  title="Delete this spot"
                  onClick={() => vm.onRemoveSlot(index)}
                >
                  ✕
                </button>
              </div>

              <button
                type="button"
                style={{ ...button(), width: '100%', textAlign: 'left' }}
                onClick={() => vm.onSelectSlot(index)}
              >
                Open spot →
              </button>
            </div>
          )
        }}
      </For>

      <Show when={vm.exteriorSlots.length === 0}>
        <p style={{ ...s.hint, marginTop: 8 }}>
          A new spot lands wherever the view is centred, so frame the door first.
        </p>
      </Show>
    </>
  )
}
