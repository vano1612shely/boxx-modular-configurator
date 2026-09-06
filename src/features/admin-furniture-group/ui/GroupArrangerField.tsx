'use client'

import { useState } from 'react'

import { For, Gate, Show } from '@/shared/ui/control-flow'

import { ArrangerCanvas } from './ArrangerCanvas'
import { useGroupArrangerModel } from '../model/use-group-arranger-model'

/** Quarter turns are what furniture is arranged in; the rest is typed by hand. */
const TURN = 90

const shell: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 8,
  overflow: 'hidden',
  marginBottom: 16,
}

const note: React.CSSProperties = {
  color: 'var(--theme-elevation-500)',
  fontSize: 13,
  margin: 0,
}

/**
 * Where a group is laid out: the scene the pieces are dragged around in.
 *
 * A group of models has no arrangement until somebody gives it one, and typed
 * coordinates are no way to find out that the chairs are inside the table —
 * every piece starts at the origin, so a group of five arrives as one heap. The
 * scene is the answer to that, and the plates under the pieces are the part of
 * it that speaks: a piece standing inside another goes red.
 *
 * It writes to the same array rows the fields above it show, so a number typed
 * by hand and a piece dragged by eye are the same edit, and Save is Payload's
 * own — this owns no draft of its own to get out of step.
 */
export function GroupArrangerField() {
  const vm = useGroupArrangerModel()
  const [selected, setSelected] = useState<number | null>(null)

  const piece = vm.pieces.find((candidate) => candidate.index === selected) ?? null

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, marginBottom: 8 }}>Arrangement</h3>

      <Gate
        loading={false}
        empty={!vm.hasPieces}
        emptyFallback={
          <p style={note}>
            Add a piece above to lay this group out. A package with no pieces is an ordinary one and
            is placed by its own model instead.
          </p>
        }
      >
        <div style={{ ...shell, height: 460 }}>
          <ArrangerCanvas vm={vm} selected={selected} onSelect={setSelected} />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <For each={vm.pieces} getKey={(row) => row.index}>
            {(row) => (
              <button
                type="button"
                onClick={() => setSelected(row.index === selected ? null : row.index)}
                aria-pressed={row.index === selected}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  fontSize: 13,
                  cursor: 'pointer',
                  border: '1px solid var(--theme-elevation-150)',
                  background:
                    row.index === selected ? 'var(--theme-elevation-150)' : 'transparent',
                  color: 'inherit',
                }}
              >
                {row.name}
              </button>
            )}
          </For>
        </div>

        {/* Turning is a button rather than a handle in the scene. A quarter turn
            is what a chair actually wants, and a ring to drag would be one more
            thing to catch a pointer that was aiming at the chair. */}
        <Show
          when={piece}
          fallback={
            <p style={{ ...note, marginTop: 12 }}>
              Drag a piece to move it. Pick one to turn it.
            </p>
          }
        >
          {(row) => (
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                marginTop: 12,
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--theme-elevation-500)' }}>
                {row.name} · {row.x.toFixed(2)} m, {row.z.toFixed(2)} m · {row.rotationYDeg}°
              </span>
              <button
                type="button"
                onClick={() => vm.onRotate(row.index, row.rotationYDeg - TURN)}
                style={turnButton}
              >
                ⟲ 90°
              </button>
              <button
                type="button"
                onClick={() => vm.onRotate(row.index, row.rotationYDeg + TURN)}
                style={turnButton}
              >
                ⟳ 90°
              </button>
              <button
                type="button"
                onClick={() => vm.onMove(row.index, 0, 0)}
                style={turnButton}
                title="Put this piece back on the middle of the group"
              >
                Centre
              </button>
            </div>
          )}
        </Show>

        <Show when={vm.unresolved > 0}>
          <p style={{ ...note, marginTop: 8 }}>
            {vm.unresolved === 1
              ? 'One piece has no model picked yet, so it is not drawn.'
              : `${vm.unresolved} pieces have no model picked yet, so they are not drawn.`}
          </p>
        </Show>
      </Gate>
    </div>
  )
}

const turnButton: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: 13,
  cursor: 'pointer',
  border: '1px solid var(--theme-elevation-150)',
  background: 'transparent',
  color: 'inherit',
}
