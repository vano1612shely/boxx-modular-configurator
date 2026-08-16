'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'

import { Show } from '@/shared/ui/control-flow'

import type { ExteriorOptionRef } from '../../model/use-exterior-catalogue'
import { AssetPicker, useAssetLibrary, type AssetRef } from '../controls/AssetPicker'
import { button, s, tone } from '../editor-styles'

const MODEL_ACCEPT = '.glb,.gltf,model/gltf-binary,model/gltf+json'
const IMAGE_ACCEPT = 'image/*'

type Props = {
  onClose: () => void
  /** Handed the entry as created, so the caller can add it to a spot at once. */
  onCreated: (option: ExteriorOptionRef) => void
}

/**
 * A new catalogue entry, made without leaving the scene.
 *
 * The model comes first because it is the reason anyone opens this: a ramp has
 * just come out of the exporter and the question is where it stands. The rest
 * is what a customer reads on the card, and it is asked here rather than left
 * for later — an entry with no title and no price is one somebody has to go
 * back and finish, and the going back is the part that gets forgotten.
 */
export function NewExteriorOption({ onClose, onCreated }: Props) {
  const { assets, refresh } = useAssetLibrary('models')
  const [model, setModel] = useState<AssetRef | null>(null)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnail, setThumbnail] = useState<{ id: number; url: string | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Both are required by the collection, so refusing here says so before a
  // round trip does.
  const ready = model !== null && title.trim().length > 0

  const save = async () => {
    if (!model || saving) return
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/exterior-options', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          model: model.id,
          price: price.trim() === '' ? null : Number(price),
          description: description.trim() || null,
          thumbnail: thumbnail?.id ?? null,
        }),
      })
      if (!response.ok) throw new Error(await response.text())

      const created = (await response.json()) as { doc: { id: number } }

      // The url comes from the file just picked rather than from the response,
      // which populates relationships at whatever depth it feels like. This
      // way the viewport can draw the ramp on the next frame.
      onCreated({
        id: created.doc.id,
        title: title.trim(),
        price: price.trim() === '' ? null : Number(price),
        modelUrl: model.url,
      })
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the option.')
    } finally {
      setSaving(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(0,0,0,0.55)',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="New exterior option"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(420px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          background: tone.panel,
          border: `1px solid ${tone.lineStrong}`,
          borderRadius: 10,
          padding: 14,
          display: 'grid',
          gap: 10,
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div>
          <p style={s.eyebrow}>New exterior option</p>
          <p style={{ ...s.hint, marginTop: 4 }}>
            Goes into the catalogue and onto this spot, ready to position.
          </p>
        </div>

        <label style={{ display: 'grid', gap: 4 }}>
          <span style={s.eyebrow}>Model</span>
          <AssetPicker
            collection="models"
            accept={MODEL_ACCEPT}
            library={assets}
            onLibraryChange={refresh}
            value={model}
            emptyLabel="Pick or upload a model"
            onChange={(asset) => {
              setModel(asset)
              // A filename is a better first guess at the name than nothing,
              // and it stays editable.
              if (asset && title.trim() === '') setTitle(asset.title)
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          <span style={s.eyebrow}>Title</span>
          <input
            style={s.input}
            value={title}
            placeholder="Front ramp"
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          <span style={s.eyebrow}>Price, USD</span>
          <input
            style={s.input}
            value={price}
            inputMode="decimal"
            placeholder="Left blank it is offered without a price"
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          <span style={s.eyebrow}>Thumbnail</span>
          <ThumbnailPicker value={thumbnail} onChange={setThumbnail} />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          <span style={s.eyebrow}>Description</span>
          <textarea
            style={{ ...s.input, minHeight: 64, resize: 'vertical' }}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <Show when={error}>
          {(message) => (
            <p style={{ ...s.hint, color: tone.danger }} role="alert">
              {message}
            </p>
          )}
        </Show>

        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button type="button" style={button()} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={{ ...button('primary'), opacity: ready && !saving ? 1 : 0.5 }}
            disabled={!ready || saving}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save and place'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * The card picture, uploaded straight to images.
 *
 * AssetPicker only knows the two libraries the editor keeps in memory, and a
 * thumbnail is the one upload here that is neither, so this is the plain form
 * of the same gesture rather than a third library nothing else reads.
 */
function ThumbnailPicker({
  value,
  onChange,
}: {
  value: { id: number; url: string | null } | null
  onChange: (image: { id: number; url: string | null } | null) => void
}) {
  const [busy, setBusy] = useState(false)

  const upload = async (file: File) => {
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('_payload', JSON.stringify({ alt: file.name.replace(/\.[^.]+$/, '') }))

      const response = await fetch('/api/images', { method: 'POST', body, credentials: 'include' })
      if (!response.ok) throw new Error(await response.text())

      const created = (await response.json()) as { doc: { id: number; url?: string | null } }
      onChange({ id: created.doc.id, url: created.doc.url ?? null })
    } catch (error) {
      console.error('Thumbnail upload failed', error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: 5,
          border: `1px solid ${tone.lineStrong}`,
          background: value?.url ? `center/cover url(${value.url})` : tone.well,
        }}
      />
      <input
        type="file"
        accept={IMAGE_ACCEPT}
        style={{ ...s.input, flex: 1, minWidth: 0, padding: 4 }}
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
          event.target.value = ''
        }}
      />
      <Show when={value !== null}>
        <button type="button" style={s.danger} title="Clear" onClick={() => onChange(null)}>
          ✕
        </button>
      </Show>
    </div>
  )
}
