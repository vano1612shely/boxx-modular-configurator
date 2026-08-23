'use client'

import type { CSSProperties } from 'react'

import { For, Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../model/use-scene-editor-model'
import { MODE_HINTS } from './controls/mode-hints'
import { tone } from './editor-styles'

type Props = { vm: SceneEditorVm }

const panel: CSSProperties = {
  pointerEvents: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 6,
  borderRadius: 10,
  background: 'rgba(20, 21, 24, 0.86)',
  border: `1px solid ${tone.lineSoft}`,
  backdropFilter: 'blur(6px)',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
}

const groupLabel: CSSProperties = {
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: 0.7,
  color: tone.textFaint,
  margin: '0 0 1px 3px',
}

function tool(active: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    width: '100%',
    padding: '6px 9px',
    borderRadius: 7,
    border: `1px solid ${active ? tone.accent : 'transparent'}`,
    background: active ? tone.accent : 'transparent',
    color: active ? '#ffffff' : tone.textMuted,
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  }
}

function chip(active: boolean): CSSProperties {
  return {
    padding: '5px 9px',
    borderRadius: 6,
    border: `1px solid ${active ? tone.lineStrong : 'transparent'}`,
    background: active ? tone.raised : 'transparent',
    color: active ? tone.text : tone.textMuted,
    fontSize: 11,
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string; title?: string }>
  onChange: (value: T) => void
}) {
  return (
    <div>
      <p style={groupLabel}>{label}</p>
      <div style={{ display: 'flex', gap: 2 }}>
        <For each={options} getKey={(option) => option.value}>
          {(option) => (
            <button
              type="button"
              title={option.title}
              aria-pressed={option.value === value}
              style={chip(option.value === value)}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          )}
        </For>
      </div>
    </div>
  )
}

/**
 * The tools, and how the viewport is being shown, over the viewport itself.
 *
 * These used to live at the top of the sidebar, above everything else it holds,
 * and they are the wrong kind of thing for it: the sidebar says what the
 * building *is*, and every control here says how you are looking at it or what
 * the next click will do. Both are answered while the eye is on the model, and
 * both were costing a scroll past themselves on the way to anything else.
 *
 * The container takes no pointer events; only the two panels do. A bar that
 * swallowed drags would be an invisible patch of viewport that will not turn.
 */
export function EditorViewportBar({ vm }: Props) {
  if (!vm.draft) return null

  const inRoom = vm.roomMode
  const room = vm.selectedRoomIndex === null ? null : vm.draft.rooms?.[vm.selectedRoomIndex]

  const tools = inRoom
    ? [
        { key: 'select', label: 'Select', active: vm.mode === 'select', run: () => vm.onSetMode('select') },
        {
          key: 'door',
          label: '⌷ Door',
          active: vm.mode === 'place-opening' && vm.openingKind === 'door',
          run: () => {
            vm.onSetOpeningKind('door')
            vm.onSetMode('place-opening')
          },
        },
        {
          key: 'window',
          label: '⊞ Window',
          active: vm.mode === 'place-opening' && vm.openingKind === 'window',
          run: () => {
            vm.onSetOpeningKind('window')
            vm.onSetMode('place-opening')
          },
        },
        // Nothing is furnished in a restroom, so there is nothing a cut could
        // mean there — and the tool is gone rather than refusing on press.
        ...(room?.isRestroom === true
          ? []
          : [
              {
                key: 'cut',
                label: '✂ Divide',
                active: vm.mode === 'cut-zone',
                run: () => vm.onSetMode('cut-zone'),
              },
            ]),
        // Only where a picked object has somewhere to go. On the Shape tab it
        // would drop a piece of building into whichever list happened to be
        // scoped, which is a list the admin cannot see from there.
        ...(vm.roomTab === 'built-ins' || vm.roomTab === 'sets'
          ? [
              {
                key: 'pick',
                label: '⦿ Take from model',
                active: vm.mode === 'pick-fitting',
                run: () => vm.onSetMode(vm.mode === 'pick-fitting' ? 'select' : 'pick-fitting'),
              },
            ]
          : []),
      ]
    : [
        { key: 'select', label: 'Select', active: vm.mode === 'select', run: () => vm.onSetMode('select') },
        {
          key: 'draw',
          label: '✏ Draw room',
          active: vm.mode === 'draw-room',
          run: () => vm.onSetMode('draw-room'),
        },
        {
          key: 'roof',
          label: '▩ Roof volume',
          active: vm.mode === 'block-roof',
          run: () => vm.onSetMode('block-roof'),
        },
        {
          key: 'level',
          label: '⇕ Floor level',
          active: vm.mode === 'floor-level',
          run: () => vm.onSetMode('floor-level'),
        },
      ]

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: 12,
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 260 }}>
        <div style={{ ...panel, width: 150 }}>
          <For each={tools} getKey={(entry) => entry.key}>
            {(entry) => (
              <button type="button" style={tool(entry.active)} onClick={entry.run}>
                {entry.label}
              </button>
            )}
          </For>
        </div>

        {/* What the tool in hand expects you to do, next to the thing you do it
            to. In the sidebar it was three panels away from the pointer. */}
        <Show when={MODE_HINTS[vm.mode]}>
          {(hint) => (
            <p
              style={{
                ...panel,
                margin: 0,
                padding: '8px 10px',
                fontSize: 11,
                lineHeight: 1.45,
                color: tone.textMuted,
              }}
            >
              {hint}
            </p>
          )}
        </Show>

        <Show when={vm.mode === 'draw-room' && vm.drawingPoints.length > 0}>
          <div style={{ ...panel, flexDirection: 'row' }}>
            <Show when={vm.drawingPoints.length >= 3}>
              <button
                type="button"
                style={{ ...tool(true), width: 'auto' }}
                onClick={vm.onFinishRoom}
              >
                ✓ Finish ({vm.drawingPoints.length})
              </button>
            </Show>
            <button
              type="button"
              style={{ ...tool(false), width: 'auto' }}
              onClick={vm.onCancelDrawing}
            >
              Cancel
            </button>
          </div>
        </Show>
      </div>

      <div style={{ ...panel, alignItems: 'stretch' }}>
        <div>
          <p style={groupLabel}>View</p>
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              type="button"
              aria-pressed={!vm.planMode}
              style={chip(!vm.planMode)}
              onClick={() => vm.onSetPlanMode(false)}
            >
              3D
            </button>
            <button
              type="button"
              title="Top-down — points land exactly where you click"
              aria-pressed={vm.planMode}
              style={chip(vm.planMode)}
              onClick={() => vm.onSetPlanMode(true)}
            >
              2D plan
            </button>
            {/* With the two it belongs to. It used to float on its own over the
                corner of the viewport, next to a compass that told you which
                way north was — which is not a question anybody was asking of a
                building drawn in its own coordinates. */}
            <button
              type="button"
              title="Bring the camera back to where it started"
              aria-label="Reset view"
              style={{ ...chip(false), padding: '5px 8px' }}
              onClick={vm.onResetView}
            >
              ⟲
            </button>
          </div>
        </div>

        <Show
          when={inRoom}
          fallback={
            <>
              <Segmented
                label="Roof"
                value={vm.roofHidden ? 'hidden' : 'shown'}
                options={[
                  { value: 'shown', label: 'Shown' },
                  { value: 'hidden', label: 'Hidden', title: 'What the visitor sees with the roof off' },
                ]}
                onChange={(value) => vm.onSetRoofHidden(value === 'hidden')}
              />

              <Show when={vm.floors.length > 0}>
                <Segmented
                  label="Storey"
                  value={vm.previewFloorIndex === null ? 'all' : String(vm.previewFloorIndex)}
                  options={[
                    { value: 'all', label: 'All', title: 'The whole building, as it is today' },
                    ...vm.floors.map((floor, index) => ({
                      value: String(index),
                      label: String(index + 1),
                      title: floor.name,
                    })),
                  ]}
                  onChange={(value) => vm.onPreviewFloor(value === 'all' ? null : Number(value))}
                />
              </Show>
            </>
          }
        >
          <Segmented
            label="Building model"
            value={vm.ghostModel ? 'ghost' : 'hidden'}
            options={[
              { value: 'ghost', label: 'Ghost', title: 'Faint, to line the outline up against' },
              { value: 'hidden', label: 'Hidden' },
            ]}
            onChange={(value) => vm.onSetGhostModel(value === 'ghost')}
          />
        </Show>
      </div>
    </div>
  )
}
