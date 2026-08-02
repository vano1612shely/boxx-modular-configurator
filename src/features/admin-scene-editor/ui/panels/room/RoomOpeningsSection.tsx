'use client'

import {
  OPENING_KINDS,
  roomOpenings,
  type OpeningKind,
  type RoomDoc,
  type RoomOpening,
} from '@/entities/building'
import { For, Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../../model/use-scene-editor-model'
import { NumberInput } from '../../controls/NumberInput'
import { button, s, SIDE_COLORS, tone } from '../../editor-styles'

function modelledKinds(room: RoomDoc): Set<OpeningKind> {
  return new Set(OPENING_KINDS.filter((kind) => Boolean(room.openingModels?.[kind]?.model)))
}

function Field({
  label,
  value,
  title,
  onCommit,
}: {
  label: string
  value: number
  title: string
  onCommit: (value: number) => void
}) {
  return (
    <label style={s.field}>
      <span style={s.label}>{label}</span>
      <NumberInput style={s.input} step={0.05} title={title} value={value} onCommit={onCommit} />
    </label>
  )
}

function OpeningDetail({
  vm,
  roomIndex,
  opening,
  modelled,
}: {
  vm: SceneEditorVm
  roomIndex: number
  opening: RoomOpening
  modelled: boolean
}) {
  const patch = (update: Partial<RoomOpening>) =>
    vm.onUpdateOpening(roomIndex, opening.id, update)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <Field
          label="Along wall m"
          title="Distance from the start of this wall"
          value={opening.along}
          onCommit={(along) => patch({ along })}
        />
        <Field
          label="Sill m"
          title="Height of the opening's bottom edge above the floor"
          value={opening.sill}
          onCommit={(sill) => patch({ sill })}
        />
        <Field
          label="Width m"
          title="Width of the opening"
          value={opening.width}
          onCommit={(width) => patch({ width })}
        />
        <Field
          label="Height m"
          title="Height of the opening"
          value={opening.height}
          onCommit={(height) => patch({ height })}
        />
      </div>

      <Show when={modelled}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <label style={{ ...s.field, flex: 1 }}>
            <span style={s.label}>Turn °</span>
            <NumberInput
              style={s.input}
              step={15}
              title="On top of the model's own facing"
              value={opening.yawDeg ?? 0}
              onCommit={(yawDeg) => patch({ yawDeg })}
            />
          </label>
          <button
            type="button"
            style={{ ...button(), padding: '7px 9px', fontSize: 12 }}
            title="Face the other way"
            onClick={() => patch({ yawDeg: ((opening.yawDeg ?? 0) + 180) % 360 })}
          >
            180°
          </button>
          <button
            type="button"
            style={{
              ...button(opening.mirror ? 'primary' : 'ghost'),
              padding: '7px 9px',
              fontSize: 12,
            }}
            title="Handed doors — a mirror image, which no rotation reaches"
            onClick={() => patch({ mirror: !opening.mirror })}
          >
            ⇄
          </button>
        </div>
      </Show>
    </div>
  )
}

export function RoomOpeningsSection({
  vm,
  roomIndex,
  room,
}: {
  vm: SceneEditorVm
  roomIndex: number
  room: RoomDoc
}) {
  const openings = roomOpenings(room.openings)
  const modelled = modelledKinds(room)

  return (
    <>
      <p style={s.hint}>
        Pick <strong>Door</strong> or <strong>Window</strong> above and click a wall. Click one in
        the viewport to select it, then drag its handles to move or resize it.
      </p>
      <For
        each={openings}
        getKey={(opening) => opening.id}
        fallback={<p style={s.hint}>No openings yet.</p>}
      >
        {(opening) => {
          const selected = vm.selectedOpeningId === opening.id

          return (
            <div
              style={{
                ...s.listRow,
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 6,
                ...(selected
                  ? { background: '#16302a', border: `1px solid ${SELECTED_BORDER}` }
                  : null),
              }}
            >
              <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                <span
                  aria-hidden
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 2,
                    flexShrink: 0,
                    background: SIDE_COLORS[opening.side],
                  }}
                />
                <button
                  type="button"
                  title={`Wall ${opening.side.toUpperCase()}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: selected ? '#d7f5e6' : tone.text,
                    fontSize: 12,
                  }}
                  onClick={() => vm.onSelectOpening(selected ? null : opening.id)}
                >
                  {opening.kind}
                  <span style={{ ...s.mono, marginLeft: 6, color: tone.textFaint }}>
                    {opening.width.toFixed(2)} × {opening.height.toFixed(2)}
                  </span>
                </button>
                <button
                  type="button"
                  style={s.danger}
                  title="Remove"
                  onClick={() => vm.onRemoveOpening(roomIndex, opening.id)}
                >
                  ✕
                </button>
              </div>

              <Show when={selected}>
                <OpeningDetail
                  vm={vm}
                  roomIndex={roomIndex}
                  opening={opening}
                  modelled={modelled.has(opening.kind)}
                />
              </Show>
            </div>
          )
        }}
      </For>
    </>
  )
}

const SELECTED_BORDER = '#2f6b4f'
