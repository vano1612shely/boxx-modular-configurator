'use client'

import { useState } from 'react'

import { For, Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../model/use-scene-editor-model'
import { Breadcrumb } from './controls/Breadcrumb'
import { button, s } from './editor-styles'
import { EditorMenuPopup, type EditorMenuState } from './EditorMenu'
import { BuildingPanel } from './panels/BuildingPanel'
import { ExteriorSpotPanel } from './panels/ExteriorSpotPanel'
import { RoomPanel } from './panels/RoomPanel'
import type { OpenMenu } from './panels/shared'

type Props = { vm: SceneEditorVm }

const SAVE_LABEL: Record<string, string> = {
  saving: 'Saving…',
  saved: 'Saved ✓',
  error: 'Save failed — retry',
}

export function EditorSidebar({ vm }: Props) {
  const [menu, setMenu] = useState<EditorMenuState>(null)

  const openMenu: OpenMenu = (event, items) => {
    event.preventDefault()
    event.stopPropagation()
    if (items.length) setMenu({ x: event.clientX, y: event.clientY, items })
  }

  if (!vm.draft) return null

  return (
    <aside style={s.sidebar}>
      {/* Above every panel, because it is the one thing true of all of them:
          where you are, and how to be somewhere else. */}
      <Breadcrumb vm={vm} />

      <Show
        when={vm.roomMode}
        fallback={
          <Show
            when={vm.spotMode}
            fallback={<BuildingPanel vm={vm} onOpenMenu={openMenu} />}
          >
            <ExteriorSpotPanel vm={vm} onOpenMenu={openMenu} />
          </Show>
        }
      >
        <RoomPanel vm={vm} onOpenMenu={openMenu} />
      </Show>

      {/* Above the button it disables, and naming the thing to go and fix
          rather than just refusing. A blank name is a thing the visitor would
          have read, so it is worth stopping — but not worth stopping silently. */}
      <Show when={vm.problems.length > 0}>
        <div style={s.problems}>
          <For each={vm.problems} getKey={(problem, index) => `${problem.where}-${index}`}>
            {(problem) => (
              <p style={s.problem}>
                <strong>{problem.where}</strong> {problem.what}
              </p>
            )}
          </For>
        </div>
      </Show>

      <div style={s.footer}>
        <button type="button" style={button()} title="Ctrl+Z" onClick={vm.onUndo}>
          ↶ Undo
        </button>
        <button
          type="button"
          style={{
            ...button('primary'),
            flex: 1,
            // A control that refuses has to look like one. Reading the label to
            // find out a button is off is one word too late.
            ...(!vm.dirty || vm.saveState === 'saving' || vm.problems.length > 0
              ? { opacity: 0.45, cursor: 'not-allowed' }
              : null),
          }}
          disabled={!vm.dirty || vm.saveState === 'saving' || vm.problems.length > 0}
          title={vm.problems.length > 0 ? 'Fix what is listed above first' : undefined}
          onClick={vm.onSave}
        >
          {vm.problems.length > 0
            ? `${vm.problems.length} to fix`
            : (SAVE_LABEL[vm.saveState] ?? 'Save changes')}
        </button>
      </div>

      <EditorMenuPopup menu={menu} onClose={() => setMenu(null)} />
    </aside>
  )
}
