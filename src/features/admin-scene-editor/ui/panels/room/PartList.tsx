'use client'

import { useState, type MouseEvent } from 'react'

import { For, Show } from '@/shared/ui/control-flow'

import type { PartRow } from '../../../lib/part-groups'
import type { SceneEditorVm } from '../../../model/use-scene-editor-model'
import { AssetPicker, useAssetLibrary } from '../../controls/AssetPicker'
import { EditorMenuPopup, type EditorMenuState } from '../../EditorMenu'
import { button, s, tone } from '../../editor-styles'
import { partMenuItems } from '../../menu-items'

import { PartFields } from './PartFields'

type Props = { vm: SceneEditorVm }

const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 8px',
  borderRadius: 6,
}

const iconButton = { ...button(), padding: '5px 8px', fontSize: 12 }

/** Held down, a click adds to the selection instead of replacing it. */
function additiveClick(event: MouseEvent): boolean {
  return event.shiftKey || event.ctrlKey || event.metaKey
}

/**
 * The things standing in a room, and the numbers for whatever is picked.
 *
 * One editor for both of a room's lists. A counter that came with the building
 * and a fridge that is being sold are the same job to arrange, and giving each
 * its own panel would have been two of everything below for no difference an
 * admin could name — the difference between them is what they mean, which is
 * what the two tabs above are for.
 *
 * A merged object takes one row. Several rows can be held at once with shift or
 * ctrl, and right-clicking any of them offers the same menu the viewport does —
 * so merging, arranging and removing are in the same place whichever half of
 * the editor an admin is working in.
 */
export function PartList({ vm }: Props) {
  const { assets, refresh } = useAssetLibrary('models')
  const picking = vm.mode === 'pick-fitting'
  const [menu, setMenu] = useState<EditorMenuState>(null)
  const nameOf = (path: string) => vm.modelNodes.find((node) => node.path === path)?.name ?? null

  /** What a row calls itself. A path is not a name; the model's own name is. */
  const labelOf = (entry: PartRow): string => {
    if (entry.grouped) return `${entry.label} · ${entry.keys.length} pcs`

    const part = vm.scopedParts.find((candidate) => candidate.key === entry.keys[0])
    if (part?.source === 'node') {
      const name = part.nodePath ? nameOf(part.nodePath) : null
      return `⌂ ${name ?? part.nodePath ?? '?'}`
    }
    return entry.label
  }

  const openMenu = (event: MouseEvent, entry: PartRow) => {
    event.preventDefault()

    const held = entry.keys.every((key) => vm.selectedPartKeys.includes(key))
    const keys = held ? vm.selectedPartKeys : entry.keys
    vm.onSelectPartRow(keys)

    setMenu({
      x: event.clientX,
      y: event.clientY,
      items: partMenuItems(vm, keys, null),
    })
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <button
          type="button"
          style={button(picking ? 'primary' : undefined)}
          title="Click the counter, the sink — anything the building already has"
          onClick={() => vm.onSetMode(picking ? 'select' : 'pick-fitting')}
        >
          {picking ? '⦿ Click it now' : '＋ From the building'}
        </button>
        {/* Adds on pick rather than holding a value: this is a way in, not a
            setting. The list below is what the room has. */}
        <AssetPicker
          collection="models"
          accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
          library={assets}
          onLibraryChange={refresh}
          value={null}
          emptyLabel="＋ From the library"
          onChange={(asset) => {
            if (asset?.url) vm.onAddModelFitting(asset.url)
          }}
        />
      </div>

      {/* The name of whatever is under the pointer, while one is being picked.
          The highlight in the viewport says which object; this says which one
          it is going to be called, since a path never will. */}
      <Show when={picking}>
        <div
          style={{
            marginTop: 6,
            padding: '7px 9px',
            borderRadius: 6,
            background: tone.card,
            border: `1px solid ${vm.hoveredNodeName ? tone.accent : tone.lineSoft}`,
            fontSize: 12,
            color: vm.hoveredNodeName ? tone.text : tone.textFaint,
            minHeight: 30,
          }}
        >
          {vm.hoveredNodeName ?? 'Point at the building — what you are over lights up.'}
        </div>
      </Show>

      {/* A kitchen is tens of megabytes, and until it has been read nothing can
          be said about how many fittings are in it. */}
      <Show when={vm.importingModelUrl !== null}>
        <p style={{ ...s.hint, marginTop: 6 }}>Reading the model…</p>
      </Show>

      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <For
          each={vm.partRows}
          getKey={(entry) => entry.id}
          fallback={<p style={s.hint}>Nothing yet.</p>}
        >
          {(entry) => {
            const held = entry.keys.every((key) => vm.selectedPartKeys.includes(key))
            return (
              <div
                style={{ ...row, background: held ? tone.raised : 'transparent' }}
                onContextMenu={(event) => openMenu(event, entry)}
              >
                <button
                  type="button"
                  style={{
                    ...button(),
                    flex: 1,
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    padding: '2px 0',
                    fontSize: 12,
                  }}
                  title="Shift or ctrl to hold several — then right-click to merge them"
                  onClick={(event) => vm.onSelectPart(entry.keys[0], additiveClick(event))}
                >
                  {labelOf(entry)}
                </button>
                <button
                  type="button"
                  style={iconButton}
                  title="Take it out of the room"
                  onClick={() => vm.onRemoveParts(entry.keys)}
                >
                  ✕
                </button>
              </div>
            )
          }}
        </For>
      </div>

      <Show when={vm.selectedPartKeys.length > 0}>
        <Show when={vm.selectedPartKeys.length > 1}>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button type="button" style={{ ...button(), flex: 1 }} onClick={vm.onGroupSelection}>
              ⛓ Merge into one object
            </button>
          </div>
        </Show>
        <Show when={vm.selectionGrouped}>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button type="button" style={{ ...button(), flex: 1 }} onClick={vm.onUngroupSelection}>
              ⛓ Split back into pieces
            </button>
          </div>
        </Show>

        <PartFields vm={vm} />
      </Show>

      <EditorMenuPopup menu={menu} onClose={() => setMenu(null)} />
    </>
  )
}
