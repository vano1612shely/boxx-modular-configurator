'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { For } from '@/shared/ui/control-flow'

import type { ModelNode } from '../../model/use-scene-editor-model'
import { nodeRow, s } from '../editor-styles'
import { nodeMenuItems } from '../menu-items'
import type { PanelProps } from './shared'

/** Outliner of the loaded glb, synced with clicks in the viewport. */
export function ModelNodesSection({ vm, onOpenMenu }: PanelProps) {
  const [filter, setFilter] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)

  const visibleNodes = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return vm.modelNodes
    return vm.modelNodes.filter((node) => node.name.toLowerCase().includes(query))
  }, [vm.modelNodes, filter])

  // Clicking an object in the viewport selects it here — keep it in view.
  useEffect(() => {
    if (vm.selectedNodeId === null) return
    listRef.current
      ?.querySelector(`[data-node-id="${vm.selectedNodeId}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [vm.selectedNodeId])

  if (!vm.modelNodes.length) return <p style={s.hint}>Loading model…</p>

  const nodeGlyph = (node: ModelNode) => (node.kind === 'mesh' ? '▪' : '▸')

  return (
    <>
      <input
        style={s.input}
        placeholder="Filter objects…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div style={s.list} ref={listRef}>
        <For each={visibleNodes} getKey={(n) => n.id}>
          {(node) => {
            const hidden = vm.hiddenNodePaths.includes(node.path)
            return (
              <button
                type="button"
                data-node-id={node.id}
                title={hidden ? `${node.name} (hidden)` : node.name}
                style={nodeRow(
                  filter ? 0 : node.depth,
                  vm.selectedNodePaths.includes(node.path),
                  hidden,
                )}
                onClick={(e) =>
                  e.shiftKey
                    ? vm.onToggleNodeSelection(node.path)
                    : vm.onSelectNode(vm.selectedNodeId === node.id ? null : node.id)
                }
                onContextMenu={(e) =>
                  onOpenMenu(e, nodeMenuItems(vm, node.path, { includeSelect: true }))
                }
              >
                {nodeGlyph(node)} {node.name}
              </button>
            )
          }}
        </For>
      </div>
      <p style={s.hint}>
        Click objects in the scene to select them — click again to cycle through everything under
        the cursor. Shift+click adds to the selection. Hidden objects are struck through.
      </p>
    </>
  )
}
