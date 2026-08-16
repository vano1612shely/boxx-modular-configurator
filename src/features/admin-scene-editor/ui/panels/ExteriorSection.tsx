'use client'

import { For, Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../model/use-scene-editor-model'
import { AssetPicker, assetRefOf, useAssetLibrary } from '../controls/AssetPicker'
import { useExteriorCatalogue } from '../controls/exterior-catalogue'
import { button, s, tone } from '../editor-styles'

const MODEL_ACCEPT = '.glb,.gltf,model/gltf-binary,model/gltf+json'

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

const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 8px',
  borderRadius: 6,
}

const chip: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: tone.textFaint,
}

const iconButton = { ...button(), padding: '5px 8px', fontSize: 12 }

/**
 * Exterior spots, as few controls as the job allows.
 *
 * Everything positional is done by dragging in the viewport, so nothing here is
 * a coordinate: the panel says what exists, what is being previewed, and what
 * the handles are currently on. Picking a part hands it the handles — imported
 * models rarely agree on where their origin is, and each one has to be placed
 * on its own before the spot can carry them as a set.
 */
export function ExteriorSection({ vm }: { vm: SceneEditorVm }) {
  const catalogue = useExteriorCatalogue()
  const { assets, refresh } = useAssetLibrary('models')
  const contested = contestedPaths(vm)

  return (
    <>
      <p style={s.hint}>
        Places outside the building where the visitor picks between a deck, stairs and a ramp. Leave
        this empty and the building is shown exactly as it is, with no panel.
      </p>

      <button type="button" style={{ ...button('primary'), marginTop: 8 }} onClick={vm.onAddSlot}>
        + Spot
      </button>

      <For each={vm.exteriorSlots} getKey={(slot, index) => slot.key || String(index)}>
        {(slot, index) => {
          const open = vm.selectedSlotIndex === index
          const variants = slot.variants ?? []

          return (
            <div style={{ ...(open ? s.cardSelected : s.card), marginTop: 8 }}>
              <div style={s.row}>
                <button
                  type="button"
                  style={{ ...iconButton, minWidth: 26 }}
                  title={open ? 'Collapse' : 'Open'}
                  onClick={() => vm.onSelectSlot(open ? null : index)}
                >
                  {open ? '▾' : '▸'}
                </button>
                <input
                  style={{ ...s.input, flex: 1 }}
                  value={slot.name ?? ''}
                  onChange={(event) => vm.onRenameSlot(index, event.target.value)}
                />
                <button
                  type="button"
                  style={{ ...iconButton, color: tone.danger }}
                  title="Delete this spot"
                  onClick={() => vm.onRemoveSlot(index)}
                >
                  ✕
                </button>
              </div>

              <Show when={!open}>
                <p style={{ ...s.hint, marginTop: 4 }}>
                  {variants.length < 2
                    ? `${variants.length} of 2 choices — the visitor needs two`
                    : `${variants.length} choices`}
                </p>
              </Show>

              <Show when={open}>
                <div style={{ ...s.row, marginTop: 6 }}>
                  <button
                    type="button"
                    style={{
                      ...button(vm.selectedPartIndex === null ? 'primary' : undefined),
                      flex: 1,
                    }}
                    title="Put the handles back on the spot itself"
                    onClick={() => vm.onSelectPart(null)}
                  >
                    ⊹ Move the spot
                  </button>
                  <button
                    type="button"
                    style={iconButton}
                    disabled={vm.selectedNodePaths.length === 0}
                    title="Drop the spot onto whatever is selected in Model objects"
                    onClick={() => vm.onSnapSlotToSelection(index)}
                  >
                    ⌖ Snap
                  </button>
                </div>

                <p style={{ ...s.hint, marginTop: 4 }}>
                  White puck moves, yellow arrows lift, blue grip turns.
                </p>

                <div style={{ ...chip, marginTop: 10 }}>Choices</div>

                <For each={variants} getKey={(variant, i) => variant.key || String(i)}>
                  {(variant, variantIndex) => {
                    const shown = vm.previewVariantIndex === variantIndex
                    const isDefault = slot.defaultVariantKey === variant.key
                    const claimed = Array.isArray(variant.nodes)
                      ? variant.nodes.filter((path): path is string => typeof path === 'string')
                      : []
                    const option = catalogue.find(
                      (entry) =>
                        entry.id ===
                        (typeof variant.option === 'number' ? variant.option : variant.option?.id),
                    )

                    return (
                      <div
                        style={{
                          marginTop: 4,
                          borderRadius: 8,
                          border: `1px solid ${shown ? tone.accent : tone.lineSoft}`,
                          background: shown ? '#171b22' : 'transparent',
                        }}
                      >
                        <div style={{ ...row, cursor: 'pointer' }}>
                          <button
                            type="button"
                            style={{ ...iconButton, minWidth: 26 }}
                            title="Show this choice in the viewport"
                            onClick={() => vm.onPreviewVariant(variant.key ?? null)}
                          >
                            {shown ? '◉' : '○'}
                          </button>
                          <span style={{ flex: 1, fontSize: 12, color: tone.text }}>
                            {option?.title ?? 'Catalogue entry'}
                          </span>
                          <button
                            type="button"
                            style={{
                              ...iconButton,
                              color: isDefault ? '#facc15' : tone.textFaint,
                            }}
                            title="What the visitor arrives on"
                            onClick={() => vm.onSetDefaultVariant(index, variant.key ?? '')}
                          >
                            ★
                          </button>
                          <button
                            type="button"
                            style={{ ...iconButton, color: tone.danger }}
                            onClick={() => vm.onRemoveVariant(index, variantIndex)}
                          >
                            ✕
                          </button>
                        </div>

                        <Show when={shown}>
                          <div style={{ padding: '0 8px 8px' }}>
                            <For each={variant.parts ?? []} getKey={(_, i) => String(i)}>
                              {(part, partIndex) => {
                                const held = vm.selectedPartIndex === partIndex
                                const model = assetRefOf(part.model, assets)

                                return (
                                  <div
                                    style={{
                                      ...row,
                                      background: held ? '#1d2a22' : tone.well,
                                      border: `1px solid ${held ? '#35553f' : tone.line}`,
                                      marginTop: 4,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      style={{
                                        ...iconButton,
                                        minWidth: 26,
                                        color: held ? '#fff' : tone.textFaint,
                                      }}
                                      title="Put the handles on this model"
                                      onClick={() => vm.onSelectPart(held ? null : partIndex)}
                                    >
                                      ⊹
                                    </button>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <AssetPicker
                                        collection="models"
                                        accept={MODEL_ACCEPT}
                                        library={assets}
                                        onLibraryChange={refresh}
                                        value={model}
                                        emptyLabel="Pick a model"
                                        onChange={(asset) =>
                                          asset &&
                                          vm.onSetPartModel(index, variantIndex, partIndex, {
                                            id: asset.id,
                                            url: asset.url,
                                          })
                                        }
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      style={{ ...iconButton, color: tone.danger }}
                                      onClick={() => vm.onRemovePart(index, variantIndex, partIndex)}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                )
                              }}
                            </For>

                            {/* Uploads land in the model library from here, so a
                                new ramp never means leaving the scene. */}
                            <div style={{ marginTop: 6 }}>
                              <AssetPicker
                                collection="models"
                                accept={MODEL_ACCEPT}
                                library={assets}
                                onLibraryChange={refresh}
                                value={null}
                                emptyLabel="+ Model — pick or upload"
                                onChange={(asset) =>
                                  asset &&
                                  vm.onAddPart(index, variantIndex, { id: asset.id, url: asset.url })
                                }
                              />
                            </div>

                            <div style={{ ...s.row, marginTop: 6 }}>
                              <button
                                type="button"
                                style={{ ...iconButton, flex: 1 }}
                                disabled={vm.selectedNodePaths.length === 0}
                                title="Objects of this building's own model that this choice shows"
                                onClick={() => vm.onClaimNodes(index, variantIndex)}
                              >
                                ⊕ Claim {vm.selectedNodePaths.length || ''} selected
                              </button>
                            </div>

                            <For each={claimed} getKey={(path) => path}>
                              {(path) => (
                                <div style={{ ...row, marginTop: 2 }}>
                                  <span
                                    style={{
                                      flex: 1,
                                      fontSize: 11,
                                      color: contested.has(path) ? tone.danger : tone.textMuted,
                                    }}
                                    title={
                                      contested.has(path)
                                        ? 'Another spot claims this object too'
                                        : path
                                    }
                                  >
                                    {vm.modelNodes.find((node) => node.path === path)?.name ?? path}
                                    {contested.has(path) ? ' ⚠' : ''}
                                  </span>
                                  <button
                                    type="button"
                                    style={iconButton}
                                    onClick={() => vm.onUnclaimNode(index, variantIndex, path)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                            </For>
                          </div>
                        </Show>
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
                  <option value="">+ Choice from the catalogue…</option>
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
