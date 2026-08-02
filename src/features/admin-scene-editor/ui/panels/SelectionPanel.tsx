'use client'

import type { ChangeEvent } from 'react'

import { Show } from '@/shared/ui/control-flow'

import type { EditorBox, SceneEditorVm } from '../../model/use-scene-editor-model'
import { button, s } from '../editor-styles'
import { round3 } from './shared'

function BlockNumericFields({
  box,
  onChange,
  onRemove,
}: {
  box: EditorBox
  onChange: (next: EditorBox) => void
  onRemove: () => void
}) {
  const width = box.max.x - box.min.x
  const depth = box.max.z - box.min.z

  // Intermediate keystrokes ("3.", "-", empty) read as NaN; ignore, don't jump to 0.
  const parse = (e: ChangeEvent<HTMLInputElement>): number | null => {
    const value = e.target.valueAsNumber
    return Number.isNaN(value) ? null : value
  }

  const field = (label: string, value: number, apply: (v: number) => EditorBox) => (
    <>
      <label style={s.hint}>{label}</label>
      <input
        style={s.inputTiny}
        type="number"
        step={0.001}
        value={round3(value)}
        onChange={(e) => {
          const v = parse(e)
          if (v !== null) onChange(apply(v))
        }}
      />
    </>
  )

  return (
    <>
      <div style={s.row}>
        {field('bottom Y', box.min.y, (v) => ({ min: { ...box.min, y: v }, max: { ...box.max } }))}
        {field('top Y', box.max.y, (v) => ({ min: { ...box.min }, max: { ...box.max, y: v } }))}
        <button type="button" style={s.danger} onClick={onRemove}>
          delete
        </button>
      </div>
      <div style={s.row}>
        {field('x', box.min.x, (v) => ({
          min: { ...box.min, x: v },
          max: { ...box.max, x: v + width },
        }))}
        {field('z', box.min.z, (v) => ({
          min: { ...box.min, z: v },
          max: { ...box.max, z: v + depth },
        }))}
      </div>
      <div style={s.row}>
        {field('width', width, (v) => ({
          min: { ...box.min },
          max: { ...box.max, x: box.min.x + Math.max(v, 0.02) },
        }))}
        {field('depth', depth, (v) => ({
          min: { ...box.min },
          max: { ...box.max, z: box.min.z + Math.max(v, 0.02) },
        }))}
      </div>
    </>
  )
}

export function SelectionPanel({ vm }: { vm: SceneEditorVm }) {
  const draft = vm.draft
  if (!draft) return null

  const multi = vm.selectedBlocks.length > 1
  const ref = vm.selectedBlock
  const block = ref ? (draft.sceneConfig?.roofBlocks ?? [])[ref.index] : null
  const node = vm.selectedNode

  if (!multi && !block && !node) return null

  return (
    <>
      <Show when={multi}>
        <div style={s.selectionCard}>
          <h3 style={s.heading}>Selection · {vm.selectedBlocks.length} volumes</h3>
          <button
            type="button"
            style={button('danger')}
            onClick={() =>
              [...vm.selectedBlocks]
                .sort((a, b) => b.index - a.index)
                .forEach((r) => vm.onRemoveBlock(r))
            }
          >
            Delete all
          </button>
        </div>
      </Show>

      <Show when={!multi && ref && block ? { ref, block } : null}>
        {(sel) => (
          <div style={s.selectionCard}>
            <h3 style={s.heading}>Roof volume #{sel.ref.index + 1}</h3>
            <BlockNumericFields
              box={sel.block}
              onChange={(next) => vm.onUpdateBlock(sel.ref, next)}
              onRemove={() => vm.onRemoveBlock(sel.ref)}
            />
          </div>
        )}
      </Show>

      <Show when={vm.selectedNodePaths.length > 1}>
        <div style={s.selectionCard}>
          <h3 style={s.heading}>Selection · {vm.selectedNodePaths.length} objects</h3>
          <div style={s.row}>
            <button
              type="button"
              style={button()}
              onClick={() => vm.selectedNodePaths.forEach((path) => vm.onHideNode(path))}
            >
              Hide all
            </button>
            <button type="button" style={button()} onClick={() => vm.onAddBlockFromNodes()}>
              ▩ Roof volume from selection
            </button>
          </div>
        </div>
      </Show>

      <Show when={node}>
        {(selectedNode) => {
          const hidden = vm.hiddenNodePaths.includes(selectedNode.path)
          return (
            <div style={s.selectionCard}>
              <h3 style={s.heading}>Model object</h3>
              <p
                style={{
                  ...s.hint,
                  color: '#c4b5fd',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={selectedNode.path}
              >
                {selectedNode.name}
              </p>
              <div style={s.row}>
                <button
                  type="button"
                  style={button()}
                  onClick={() =>
                    hidden ? vm.onShowNode(selectedNode.path) : vm.onHideNode(selectedNode.path)
                  }
                >
                  {hidden ? 'Show object' : 'Hide object'}
                </button>
                <button
                  type="button"
                  disabled={!selectedNode.box}
                  style={{ ...button(), opacity: selectedNode.box ? 1 : 0.4 }}
                  onClick={() => vm.onAddBlockFromNodes()}
                >
                  ▩ Roof volume
                </button>
                <button
                  type="button"
                  disabled={!selectedNode.box}
                  title="Creates a NEW room traced from this object's footprint"
                  style={{ ...button(), opacity: selectedNode.box ? 1 : 0.4 }}
                  onClick={() => vm.onAddRoomFromNode(selectedNode.path)}
                >
                  ⬒ New room from object
                </button>
              </div>
            </div>
          )
        }}
      </Show>
    </>
  )
}
