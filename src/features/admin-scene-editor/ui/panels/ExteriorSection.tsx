'use client'

import { For, Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../model/use-scene-editor-model'
import { useExteriorCatalogue } from '../controls/exterior-catalogue'
import { NumberInput } from '../controls/NumberInput'
import { button, s, tone } from '../editor-styles'

const NUDGE = 0.1

/** Paths more than one spot has claimed — an authoring mistake worth naming. */
function contestedPaths(vm: SceneEditorVm): Set<string> {
  const owners = new Map<string, string>()
  const contested = new Set<string>()

  for (const slot of vm.exteriorSlots) {
    for (const variant of slot.variants ?? []) {
      for (const path of Array.isArray(variant.nodes) ? variant.nodes : []) {
        if (typeof path !== 'string') continue
        const owner = owners.get(path)
        if (owner !== undefined && owner !== slot.key) contested.add(path)
        else owners.set(path, slot.key)
      }
    }
  }

  return contested
}

export function ExteriorSection({ vm }: { vm: SceneEditorVm }) {
  const catalogue = useExteriorCatalogue()
  const contested = contestedPaths(vm)

  return (
    <>
      <p style={s.hint}>
        Places outside the building where the visitor picks between a deck, stairs and a ramp. A
        choice can show objects that are already in the model, or place models of its own, or both.
        Leave this empty and the building is shown exactly as it is, with no panel.
      </p>

      <button type="button" style={{ ...button('primary'), marginTop: 8 }} onClick={vm.onAddSlot}>
        + Spot
      </button>

      <For each={vm.exteriorSlots} getKey={(slot, index) => slot.key || String(index)}>
        {(slot, index) => {
          const selected = vm.selectedSlotIndex === index
          const variants = slot.variants ?? []

          return (
            <div style={{ ...(selected ? s.cardSelected : s.card), marginTop: 8 }}>
              <div style={s.row}>
                <input
                  style={{ ...s.input, flex: 1 }}
                  value={slot.name ?? ''}
                  onChange={(event) => vm.onRenameSlot(index, event.target.value)}
                />
                <button
                  type="button"
                  style={button(selected ? 'primary' : undefined)}
                  onClick={() => vm.onSelectSlot(selected ? null : index)}
                >
                  {selected ? 'Done' : 'Edit'}
                </button>
                <button
                  type="button"
                  style={button('danger')}
                  title="Delete this spot"
                  onClick={() => vm.onRemoveSlot(index)}
                >
                  ✕
                </button>
              </div>

              <Show when={!selected}>
                <p style={{ ...s.hint, marginTop: 6 }}>
                  {variants.length} {variants.length === 1 ? 'choice' : 'choices'}
                  {variants.length < 2 ? ' — needs two before the visitor sees a picker' : ''}
                </p>
              </Show>

              <Show when={selected}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
                  <label style={s.field}>
                    <span style={s.label}>X m</span>
                    <NumberInput
                      style={s.input}
                      value={slot.position?.x ?? 0}
                      onCommit={(value) =>
                        vm.onMoveSlot(index, value, slot.position?.y ?? 0, slot.position?.z ?? 0)
                      }
                    />
                  </label>
                  <label style={s.field}>
                    <span style={s.label}>Y m</span>
                    <NumberInput
                      style={s.input}
                      value={slot.position?.y ?? 0}
                      onCommit={(value) =>
                        vm.onMoveSlot(index, slot.position?.x ?? 0, value, slot.position?.z ?? 0)
                      }
                    />
                  </label>
                  <label style={s.field}>
                    <span style={s.label}>Z m</span>
                    <NumberInput
                      style={s.input}
                      value={slot.position?.z ?? 0}
                      onCommit={(value) =>
                        vm.onMoveSlot(index, slot.position?.x ?? 0, slot.position?.y ?? 0, value)
                      }
                    />
                  </label>
                </div>

                <div style={{ ...s.row, marginTop: 6 }}>
                  <label style={{ ...s.field, flex: 1 }}>
                    <span style={s.label}>Facing °</span>
                    <NumberInput
                      style={s.input}
                      step={5}
                      value={slot.yawDeg ?? 0}
                      onCommit={(value) => vm.onSetSlotYaw(index, value)}
                    />
                  </label>
                  <button
                    type="button"
                    style={{ ...button(), alignSelf: 'flex-end' }}
                    title="Quarter turn"
                    onClick={() => vm.onSetSlotYaw(index, ((slot.yawDeg ?? 0) + 90) % 360)}
                  >
                    ↻
                  </button>
                  <button
                    type="button"
                    style={{ ...button(), alignSelf: 'flex-end' }}
                    title={`Down ${NUDGE} m`}
                    onClick={() =>
                      vm.onMoveSlot(
                        index,
                        slot.position?.x ?? 0,
                        (slot.position?.y ?? 0) - NUDGE,
                        slot.position?.z ?? 0,
                      )
                    }
                  >
                    −
                  </button>
                  <button
                    type="button"
                    style={{ ...button(), alignSelf: 'flex-end' }}
                    title={`Up ${NUDGE} m`}
                    onClick={() =>
                      vm.onMoveSlot(
                        index,
                        slot.position?.x ?? 0,
                        (slot.position?.y ?? 0) + NUDGE,
                        slot.position?.z ?? 0,
                      )
                    }
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  style={{ ...button(), marginTop: 6, width: '100%' }}
                  disabled={vm.selectedNodePaths.length === 0}
                  title="Move the spot onto whatever is selected in Model objects"
                  onClick={() => vm.onSnapSlotToSelection(index)}
                >
                  ⌖ Snap to selected objects
                </button>

                <p style={{ ...s.hint, marginTop: 6 }}>
                  Drag the white puck to move the spot, the yellow arrows for height, and the blue
                  grip round the ring to turn it. The fields above are the same numbers.
                </p>

                <p style={{ ...s.hint, marginTop: 10 }}>Choices</p>

                <For each={variants} getKey={(variant, i) => variant.key || String(i)}>
                  {(variant, variantIndex) => {
                    const claimed = Array.isArray(variant.nodes)
                      ? variant.nodes.filter((path): path is string => typeof path === 'string')
                      : []
                    const isDefault = slot.defaultVariantKey === variant.key
                    const previewed = vm.previewVariantIndex === variantIndex
                    const option = catalogue.find(
                      (entry) =>
                        entry.id ===
                        (typeof variant.option === 'number' ? variant.option : variant.option?.id),
                    )

                    return (
                      <div style={{ ...(previewed ? s.cardSelected : s.card), marginTop: 6 }}>
                        <div style={s.row}>
                          <span style={{ flex: 1, fontSize: 12 }}>
                            {option?.title ?? 'Catalogue entry'}
                            <Show when={option?.price != null}>
                              <span style={{ opacity: 0.6 }}> · ${option?.price}</span>
                            </Show>
                          </span>
                          <button
                            type="button"
                            style={button(previewed ? 'primary' : undefined)}
                            title="Show exactly what the visitor sees for this choice"
                            onClick={() => vm.onPreviewVariant(variant.key ?? null)}
                          >
                            👁
                          </button>
                          <button
                            type="button"
                            style={button(isDefault ? 'primary' : undefined)}
                            title="What the visitor arrives on"
                            onClick={() => vm.onSetDefaultVariant(index, variant.key ?? '')}
                          >
                            ★
                          </button>
                          <button
                            type="button"
                            style={button('danger')}
                            onClick={() => vm.onRemoveVariant(index, variantIndex)}
                          >
                            ✕
                          </button>
                        </div>

                        <button
                          type="button"
                          style={{ ...button(), marginTop: 6, width: '100%' }}
                          disabled={vm.selectedNodePaths.length === 0}
                          title="Objects of this building's model that this choice shows"
                          onClick={() => vm.onClaimNodes(index, variantIndex)}
                        >
                          ⊕ Claim selected objects ({vm.selectedNodePaths.length})
                        </button>

                        <For each={claimed} getKey={(path) => path}>
                          {(path) => (
                            <div style={{ ...s.row, marginTop: 4 }}>
                              <span
                                style={{
                                  flex: 1,
                                  fontSize: 11,
                                  opacity: contested.has(path) ? 1 : 0.7,
                                  color: contested.has(path) ? tone.danger : undefined,
                                }}
                                title={
                                  contested.has(path)
                                    ? 'Another spot claims this object too — it will show whenever either one asks for it'
                                    : path
                                }
                              >
                                {vm.modelNodes.find((node) => node.path === path)?.name ?? path}
                                {contested.has(path) ? ' ⚠' : ''}
                              </span>
                              <button
                                type="button"
                                style={button()}
                                onClick={() => vm.onUnclaimNode(index, variantIndex, path)}
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </For>

                        <For each={variant.parts ?? []} getKey={(_, i) => String(i)}>
                          {(part, partIndex) => (
                            <div style={{ marginTop: 6, paddingLeft: 8, borderLeft: `2px solid ${tone.lineSoft}` }}>
                              <div style={s.row}>
                                <span style={{ flex: 1, fontSize: 11, opacity: 0.7 }}>
                                  {typeof part.model === 'object'
                                    ? (part.model?.title ?? part.model?.filename ?? 'Model')
                                    : `#${part.model}`}
                                </span>
                                <button
                                  type="button"
                                  style={button('danger')}
                                  onClick={() => vm.onRemovePart(index, variantIndex, partIndex)}
                                >
                                  ✕
                                </button>
                              </div>
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr 1fr',
                                  gap: 4,
                                  marginTop: 4,
                                }}
                              >
                                <NumberInput
                                  style={s.input}
                                  value={part.position?.x ?? 0}
                                  onCommit={(value) =>
                                    vm.onMovePart(
                                      index,
                                      variantIndex,
                                      partIndex,
                                      value,
                                      part.position?.y ?? 0,
                                      part.position?.z ?? 0,
                                    )
                                  }
                                />
                                <NumberInput
                                  style={s.input}
                                  value={part.position?.y ?? 0}
                                  onCommit={(value) =>
                                    vm.onMovePart(
                                      index,
                                      variantIndex,
                                      partIndex,
                                      part.position?.x ?? 0,
                                      value,
                                      part.position?.z ?? 0,
                                    )
                                  }
                                />
                                <NumberInput
                                  style={s.input}
                                  value={part.position?.z ?? 0}
                                  onCommit={(value) =>
                                    vm.onMovePart(
                                      index,
                                      variantIndex,
                                      partIndex,
                                      part.position?.x ?? 0,
                                      part.position?.y ?? 0,
                                      value,
                                    )
                                  }
                                />
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
                                <label style={s.field}>
                                  <span style={s.label}>Facing °</span>
                                  <NumberInput
                                    style={s.input}
                                    step={5}
                                    value={part.yawDeg ?? 0}
                                    onCommit={(value) =>
                                      vm.onSetPartYaw(index, variantIndex, partIndex, value)
                                    }
                                  />
                                </label>
                                <label style={s.field}>
                                  <span style={s.label}>Scale</span>
                                  <NumberInput
                                    style={s.input}
                                    step={0.01}
                                    value={part.scale ?? 1}
                                    onCommit={(value) =>
                                      vm.onSetPartScale(index, variantIndex, partIndex, value)
                                    }
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    )
                  }}
                </For>

                <select
                  style={{ ...s.input, marginTop: 8, width: '100%' }}
                  value=""
                  onChange={(event) => {
                    const option = catalogue.find((entry) => entry.id === Number(event.target.value))
                    if (option) vm.onAddVariant(index, option)
                  }}
                >
                  <option value="">+ Add a choice from the catalogue…</option>
                  <For each={catalogue} getKey={(option) => option.id}>
                    {(option) => <option value={option.id}>{option.title}</option>}
                  </For>
                </select>
              </Show>
            </div>
          )
        }}
      </For>
    </>
  )
}
