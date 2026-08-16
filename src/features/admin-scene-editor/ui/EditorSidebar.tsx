'use client'

import { useState } from 'react'

import { Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../model/use-scene-editor-model'
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

      <div style={s.footer}>
        <button type="button" style={button()} title="Ctrl+Z" onClick={vm.onUndo}>
          ↶ Undo
        </button>
        <button
          type="button"
          style={{ ...button('primary'), flex: 1 }}
          disabled={!vm.dirty || vm.saveState === 'saving'}
          onClick={vm.onSave}
        >
          {SAVE_LABEL[vm.saveState] ?? 'Save changes'}
        </button>
      </div>

      <EditorMenuPopup menu={menu} onClose={() => setMenu(null)} />
    </aside>
  )
}
