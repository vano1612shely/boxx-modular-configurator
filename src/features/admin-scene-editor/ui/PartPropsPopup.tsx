'use client'

import { useEffect } from 'react'

import { Show } from '@/shared/ui/control-flow'

import { partName } from '../lib/part-groups'
import type { SceneEditorVm } from '../model/use-scene-editor-model'

import { button, tone } from './editor-styles'
import { PartFields } from './panels/room/PartFields'

export type PartPropsState = { x: number; y: number } | null

/**
 * The selection's numbers, opened where the admin right-clicked.
 *
 * The same fields the panel carries, brought to the pointer: arranging a
 * kitchen is done looking at the kitchen, and crossing to the far side of the
 * screen to type 0.75 into a sidebar and back again is the part of it that
 * wears thin.
 *
 * Deliberately not dismissed by clicking away, unlike the menu above it. It is
 * a small form, and a form that vanishes when the pointer lands on the model
 * behind it cannot be typed into twice.
 */
export function PartPropsPopup({
  vm,
  at,
  onClose,
}: {
  vm: SceneEditorVm
  at: PartPropsState
  onClose: () => void
}) {
  const empty = vm.selectedPartKeys.length === 0

  useEffect(() => {
    if (!at) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [at, onClose])

  // Nothing selected is nothing to set — deleting the fitting the popup was
  // opened on would otherwise leave a form editing thin air.
  useEffect(() => {
    if (at && empty) onClose()
  }, [at, empty, onClose])

  const first = vm.scopedParts.find((part) => part.key === vm.selectedPartKeys[0])
  const title = !first
    ? 'Selection'
    : vm.selectedPartKeys.length > 1
      ? `${partName(first)} · ${vm.selectedPartKeys.length} pcs`
      : partName(first)

  return (
    <Show when={at && !empty ? at : null}>
      {(pos) => (
        <div
          style={{
            position: 'fixed',
            left: Math.min(pos.x, typeof window === 'undefined' ? pos.x : window.innerWidth - 280),
            top: Math.min(pos.y, typeof window === 'undefined' ? pos.y : window.innerHeight - 240),
            zIndex: 1001,
            width: 260,
            background: '#1b1d21',
            border: `1px solid ${tone.line}`,
            borderRadius: 8,
            padding: 10,
            boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: 12,
                color: tone.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </span>
            <button
              type="button"
              style={{ ...button(), padding: '3px 7px', fontSize: 12 }}
              title="Close"
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          <PartFields vm={vm} compact />
        </div>
      )}
    </Show>
  )
}
