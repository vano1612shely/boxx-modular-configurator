'use client'

import { For, Show } from '@/shared/ui/control-flow'

import { AssetPicker, assetRefOf, useAssetLibrary } from '../controls/AssetPicker'
import { useExteriorCatalogue } from '../controls/exterior-catalogue'
import { button, s, tone } from '../editor-styles'
import type { PanelProps } from './shared'

const MODEL_ACCEPT = '.glb,.gltf,model/gltf-binary,model/gltf+json'

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

/** Objects more than one spot has claimed — an authoring mistake worth naming. */
function contestedPaths(vm: PanelProps['vm']): Set<string> {
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

/**
 * One exterior spot, with the whole sidebar to itself.
 *
 * The same shape as entering a room: a spot is a place with its own contents,
 * and editing it inside an accordion on the building panel meant a column of
 * models and objects squeezed under everything else. Nothing positional is
 * here — that is what the handles in the viewport are for — so what is left
 * says only what exists and which choice is on screen.
 */
export function ExteriorSpotPanel({ vm }: PanelProps) {
  const index = vm.selectedSlotIndex
  const slot = index === null ? undefined : vm.exteriorSlots[index]
  const catalogue = useExteriorCatalogue()
  const { assets, refresh } = useAssetLibrary('models')
  const contested = contestedPaths(vm)

  if (index === null || !slot) return null

  const variants = slot.variants ?? []

  return (
    <>
      <div style={s.header}>
        <button
          type="button"
          style={{ ...button(), width: '100%', textAlign: 'left' }}
          onClick={() => vm.onSelectSlot(null)}
        >
          ← Back to building
        </button>

        <div>
          <p style={s.eyebrow}>Exterior spot</p>
          <div style={s.row}>
            <input
              style={{ ...s.input, flex: 1, fontWeight: 600 }}
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
        </div>

        <div style={s.row}>
          <button
            type="button"
            style={{ ...iconButton, flex: 1 }}
            disabled={vm.selectedNodePaths.length === 0}
            title="Drop the spot onto whatever is selected in Model objects"
            onClick={() => vm.onSnapSlotToSelection(index)}
          >
            ⌖ Snap to selected objects
          </button>
        </div>

        <p style={s.hint}>
          The white puck sets where the spot is and the yellow arrows its height — that is all a
          spot is, and it is where the visitor&apos;s marker hangs. Each model has its own cage:
          corners resize, the puck moves, the blue grip turns.
        </p>
      </div>

      <div style={{ padding: 12 }}>
        <div style={chip}>Choices</div>
        <Show when={variants.length < 2}>
          <p style={{ ...s.hint, marginTop: 4 }}>
            {variants.length} of 2 — the visitor is offered a picker once there are two.
          </p>
        </Show>

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
                  marginTop: 6,
                  borderRadius: 8,
                  border: `1px solid ${shown ? tone.accent : tone.lineSoft}`,
                  background: shown ? '#171b22' : 'transparent',
                }}
              >
                <div style={row}>
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
                    style={{ ...iconButton, color: isDefault ? '#facc15' : tone.textFaint }}
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
                        const caged = vm.selectedPartIndex === partIndex
                        const model = assetRefOf(part.model, assets)

                        return (
                          <div
                            style={{
                              ...row,
                              background: caged ? '#1d2a22' : tone.well,
                              border: `1px solid ${caged ? '#35553f' : tone.line}`,
                              marginTop: 4,
                            }}
                          >
                            <button
                              type="button"
                              style={{
                                ...iconButton,
                                minWidth: 26,
                                color: caged ? '#fff' : tone.textFaint,
                              }}
                              title="Put the cage on this model"
                              onClick={() => vm.onSelectPart(partIndex)}
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

                    {/* Uploads land in the model library from here, so a ramp
                        fresh out of the exporter never means leaving the scene. */}
                    <div style={{ marginTop: 6 }}>
                      <AssetPicker
                        collection="models"
                        accept={MODEL_ACCEPT}
                        library={assets}
                        onLibraryChange={refresh}
                        value={null}
                        emptyLabel="+ Model — pick or upload"
                        onChange={(asset) =>
                          asset && vm.onAddPart(index, variantIndex, { id: asset.id, url: asset.url })
                        }
                      />
                    </div>

                    <button
                      type="button"
                      style={{ ...iconButton, marginTop: 6, width: '100%' }}
                      disabled={vm.selectedNodePaths.length === 0}
                      title="Objects of this building's own model that this choice shows"
                      onClick={() => vm.onClaimNodes(index, variantIndex)}
                    >
                      ⊕ Claim {vm.selectedNodePaths.length || ''} selected
                    </button>

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
                              contested.has(path) ? 'Another spot claims this object too' : path
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
      </div>
    </>
  )
}
