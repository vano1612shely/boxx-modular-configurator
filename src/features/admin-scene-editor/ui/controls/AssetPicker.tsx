'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { For, Show } from '@/shared/ui/control-flow'

import { button, s, tone } from '../editor-styles'
import { AssetPreview } from './AssetPreview'
import type { AssetCollection, AssetRef } from './asset-library'

export { assetRefOf, useAssetLibrary, type AssetCollection, type AssetRef } from './asset-library'

/**
 * Choosing an uploaded file, for the two collections the editor writes to.
 *
 * A `<select>` was the obvious control and the wrong one: a dropdown of
 * filenames makes you pick a wall finish by reading "adskMatBasic_Wall_
 * Interior_baseColor.jpeg". Hovering a row here shows the texture, or renders
 * the model, before the choice is made.
 *
 * The list is a portal for the same reason the preview is — the sidebar
 * scrolls, and a panel inside a scroll box is clipped by it.
 */

type Props = {
  collection: AssetCollection
  accept: string
  library: AssetRef[]
  onLibraryChange: () => void
  value: AssetRef | null
  onChange: (asset: AssetRef | null) => void
  /** Textures get an image swatch; models only have a name to show. */
  swatch?: boolean
  emptyLabel?: string
}

export function AssetPicker({
  collection,
  accept,
  library,
  onLibraryChange,
  value,
  onChange,
  swatch = false,
  emptyLabel = 'None',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)
  // The trigger's position, captured when it was clicked. Held as state rather
  // than read off the ref at render time, which is a thing React forbids.
  const [panel, setPanel] = useState<DOMRect | null>(null)
  const [hovered, setHovered] = useState<{ asset: AssetRef; anchor: DOMRect } | null>(null)
  const open = panel !== null

  useEffect(() => {
    if (!open) return

    const close = (event: Event) => {
      const target = event.target as Node | null
      // A click on the trigger toggles; the trigger's own handler owns that.
      if (target && triggerRef.current?.contains(target)) return
      setPanel(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null)
    }

    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKey)
    // Any scroll moves the anchor out from under the panel.
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  const upload = async (file: File) => {
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('_payload', JSON.stringify({ title: file.name.replace(/\.[^.]+$/, '') }))
      const response = await fetch(`/api/${collection}`, {
        method: 'POST',
        body,
        credentials: 'include',
      })
      if (!response.ok) throw new Error(await response.text())

      const created = (await response.json()) as {
        doc: { id: number; url?: string | null; title?: string | null; filename?: string | null }
      }
      // The populated shape, not the id: the viewport previews the draft, and
      // an id alone has no URL to load from.
      onChange({
        id: created.doc.id,
        url: created.doc.url ?? null,
        title: created.doc.title || created.doc.filename || `#${created.doc.id}`,
      })
      onLibraryChange()
    } catch (error) {
      console.error(`Upload to ${collection} failed`, error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <Show when={swatch}>
        <Swatch url={value?.url ?? null} size={28} />
      </Show>

      <button
        ref={triggerRef}
        type="button"
        style={{
          ...s.select,
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          textAlign: 'left',
        }}
        onClick={(event) => {
          // Measured HERE, not inside the updater. React clears
          // `currentTarget` once the handler returns, and a state updater runs
          // later — reading it there threw "Cannot read properties of null".
          const rect = event.currentTarget.getBoundingClientRect()
          setPanel((current) => (current ? null : rect))
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: value ? tone.text : tone.textFaint,
          }}
        >
          {busy ? 'uploading…' : (value?.title ?? emptyLabel)}
        </span>
        <span style={{ color: tone.textFaint, fontSize: 10 }}>▾</span>
      </button>

      <button
        type="button"
        style={{ ...button(), padding: '6px 9px', fontSize: 12 }}
        title="Upload a new file"
        onClick={() => inputRef.current?.click()}
      >
        ↑
      </button>
      <Show when={value !== null}>
        <button type="button" style={s.danger} title="Clear" onClick={() => onChange(null)}>
          ✕
        </button>
      </Show>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
          event.target.value = ''
        }}
      />

      <Show when={panel}>
        {(rect) => (
          <AssetList
            rect={rect}
            library={library}
            collection={collection}
            value={value}
            emptyLabel={emptyLabel}
            swatch={swatch}
            onHover={setHovered}
            onPick={(asset) => {
              onChange(asset)
              setPanel(null)
            }}
          />
        )}
      </Show>

      {/* Gated on the list being open rather than cleared when it closes —
          a stale hover cannot outlive the panel it came from. */}
      <Show when={open ? hovered : null}>
        {(item) => (
          <AssetPreview asset={item.asset} collection={collection} anchor={item.anchor} />
        )}
      </Show>
    </div>
  )
}

function Swatch({ url, size }: { url: string | null; size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 5,
        border: `1px solid ${tone.lineStrong}`,
        background: url ? `center/cover url(${url})` : tone.well,
      }}
    />
  )
}

type ListProps = {
  rect: DOMRect
  library: AssetRef[]
  collection: AssetCollection
  value: AssetRef | null
  emptyLabel: string
  swatch: boolean
  onHover: (item: { asset: AssetRef; anchor: DOMRect } | null) => void
  onPick: (asset: AssetRef | null) => void
}

function AssetList({
  rect,
  library,
  collection,
  value,
  emptyLabel,
  swatch,
  onHover,
  onPick,
}: ListProps) {
  if (typeof document === 'undefined') return null

  const maxHeight = 280
  const below = window.innerHeight - rect.bottom - 12
  const openUpwards = below < 160

  return createPortal(
    <div
      onMouseLeave={() => onHover(null)}
      style={{
        position: 'fixed',
        left: rect.left,
        width: Math.max(rect.width, 180),
        ...(openUpwards
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
        maxHeight,
        overflowY: 'auto',
        zIndex: 999,
        background: tone.panel,
        border: `1px solid ${tone.lineStrong}`,
        borderRadius: 8,
        padding: 4,
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
      }}
    >
      <Row label={emptyLabel} selected={value === null} onSelect={() => onPick(null)} />
      <For each={library} getKey={(asset) => asset.id}>
        {(asset) => (
          <Row
            label={asset.title}
            selected={value?.id === asset.id}
            url={swatch ? asset.url : null}
            onSelect={() => onPick(asset)}
            onHover={(anchor) => onHover(anchor ? { asset, anchor } : null)}
          />
        )}
      </For>
      <Show when={library.length === 0}>
        <p style={{ ...s.hint, padding: '6px 8px' }}>
          Nothing uploaded to {collection} yet.
        </p>
      </Show>
    </div>,
    document.body,
  )
}

function Row({
  label,
  selected,
  url = null,
  onSelect,
  onHover,
}: {
  label: string
  selected: boolean
  url?: string | null
  onSelect: () => void
  onHover?: (anchor: DOMRect | null) => void
}) {
  const ref = useRef<HTMLButtonElement>(null)

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover?.(ref.current?.getBoundingClientRect() ?? null)}
      onFocus={() => onHover?.(ref.current?.getBoundingClientRect() ?? null)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        width: '100%',
        background: selected ? tone.accent : 'transparent',
        color: selected ? '#fff' : tone.text,
        border: 'none',
        borderRadius: 5,
        padding: '5px 6px',
        fontSize: 12,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <Show when={url}>{(src) => <Swatch url={src} size={22} />}</Show>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </button>
  )
}
