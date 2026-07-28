'use client'

import { useState } from 'react'

import { Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../model/use-scene-editor-model'
import { button, s } from './editor-styles'
import { EditorMenuPopup, type EditorMenuState } from './EditorMenu'
import { BuildingPanel } from './panels/BuildingPanel'
import { RoomPanel } from './panels/RoomPanel'
import type { OpenMenu } from './panels/shared'

type Props = { vm: SceneEditorVm }

const SAVE_LABEL: Record<string, string> = {
  saving: 'Saving…',
  saved: 'Saved ✓',
  error: 'Save failed — retry',
}

/**
 * The sidebar is two panels, not one.
 *
 * Opening a room swaps the entire contents: the building's tools, roof volumes
 * and object outliner have nothing to say about a room, and leaving them on
 * screen was most of why the editor felt like a control panel rather than a
 * tool.
 */
export function EditorSidebar({ vm }: Props) {
  // Hook before the early return: the sidebar shares the viewport's popup, so
  // right-clicking a list row offers the same actions as right-clicking in 3D.
  const [menu, setMenu] = useState<EditorMenuState>(null)

  const openMenu: OpenMenu = (event, items) => {
    event.preventDefault()
    event.stopPropagation()
    if (items.length) setMenu({ x: event.clientX, y: event.clientY, items })
  }

  if (!vm.draft) return null

  return (
    <aside style={s.sidebar}>
      <Show when={vm.roomMode} fallback={<BuildingPanel vm={vm} onOpenMenu={openMenu} />}>
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
