'use client'

import { For, Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../../model/use-scene-editor-model'
import { useFittedCatalogue } from '../../../model/use-fitted-catalogue'
import { button, s, tone } from '../../editor-styles'
import { PartList } from './PartList'

/**
 * Arrangements this room offers, of which the visitor may have one.
 *
 * Each names a row of the furniture catalogue — that row is what it is called,
 * what it costs and what its picture is — and holds the pieces it is made of,
 * each where the admin put them. On the furniture panel it is a tile like any
 * other; the only thing the visitor cannot do to it is move it.
 *
 * Separate from the built-ins next door, because they are separate ideas: one
 * is the room, the other is a product. Sharing a list behind a dropdown made
 * the two look like settings of one thing.
 */
export function RoomSetsSection({ vm }: { vm: SceneEditorVm }) {
  const fitted = useFittedCatalogue()
  const scope = vm.fittingScope
  const titleOf = (packageId: number) =>
    fitted.find((pkg) => pkg.id === packageId)?.title ?? `Package #${packageId}`

  return (
    <div style={s.tabBody}>
      <Show
        when={vm.fittedSets.length > 0}
        fallback={
          <p style={s.hint}>
            Nothing offered here yet. Pick a fitted package below — that catalogue row gives the
            arrangement its name, its price and its picture, and this room gives it its contents.
          </p>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <For each={vm.fittedSets} getKey={(set) => set.key}>
            {(set) => {
              const open = scope.kind === 'set' && scope.key === set.key
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: open ? tone.raised : 'transparent',
                  }}
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
                      fontWeight: open ? 600 : 400,
                    }}
                    onClick={() =>
                      vm.onScopeFittings(open ? { kind: 'built-ins' } : { kind: 'set', key: set.key })
                    }
                  >
                    {titleOf(set.packageId)}
                    <span style={{ color: tone.textFaint }}>{` · ${set.parts.length} pcs`}</span>
                  </button>
                  <button
                    type="button"
                    style={{ ...button(), padding: '5px 8px', fontSize: 12 }}
                    title="Stop offering this arrangement in this room"
                    onClick={() => vm.onRemoveFittedSet(set.key)}
                  >
                    ✕
                  </button>
                </div>
              )
            }}
          </For>
        </div>
      </Show>

      {/* Only the arrangement being worked on is opened, because the viewport
          draws one at a time: three kitchens on top of each other is nobody's
          idea of a preview. */}
      <Show
        when={scope.kind === 'set'}
        fallback={
          <Show when={vm.fittedSets.length > 0}>
            <p style={{ ...s.hint, marginTop: 8 }}>Pick one above to arrange what is in it.</p>
          </Show>
        }
      >
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${tone.line}` }}>
          <PartList vm={vm} />
        </div>
      </Show>

      <div style={{ ...s.field, marginTop: 14 }}>
        <span style={s.label}>Offer another arrangement</span>
        <Show
          when={fitted.length > 0}
          fallback={
            <p style={s.hint}>
              No fitted packages in the catalogue yet. Tick &ldquo;Fitted&rdquo; on a furniture
              package first.
            </p>
          }
        >
          <select
            style={s.select}
            value=""
            onChange={(e) => {
              const id = Number(e.target.value)
              if (Number.isFinite(id) && id > 0) vm.onAddFittedSet(id)
            }}
          >
            <option value="">Pick a fitted package…</option>
            <For each={fitted} getKey={(pkg) => pkg.id}>
              {(pkg) => (
                <option
                  value={pkg.id}
                  disabled={vm.fittedSets.some((set) => set.packageId === pkg.id)}
                >
                  {pkg.title}
                  {pkg.price === null ? '' : ` · $${pkg.price.toLocaleString('en-US')}`}
                </option>
              )}
            </For>
          </select>
        </Show>
      </div>
    </div>
  )
}
