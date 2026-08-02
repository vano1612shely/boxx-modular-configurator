'use client'

import { useEffect } from 'react'

import { For, Show } from '@/shared/ui/control-flow'

export type EditorMenuItem = {
  label: string
  danger?: boolean
  onClick: () => void
}

export type EditorMenuState = { x: number; y: number; items: EditorMenuItem[] } | null

export function EditorMenuPopup({
  menu,
  onClose,
}: {
  menu: EditorMenuState
  onClose: () => void
}) {
  useEffect(() => {
    if (!menu) return
    const close = () => onClose()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menu, onClose])

  return (
    <Show when={menu}>
      {(m) => (
        <div
          style={{
            position: 'fixed',
            left: Math.min(m.x, typeof window === 'undefined' ? m.x : window.innerWidth - 260),
            top: Math.min(
              m.y,
              typeof window === 'undefined' ? m.y : window.innerHeight - m.items.length * 32 - 16,
            ),
            zIndex: 1000,
            background: '#1b1d21',
            border: '1px solid #33383f',
            borderRadius: 8,
            padding: 4,
            minWidth: 210,
            boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <For each={m.items} getKey={(item, i) => `${i}-${item.label}`}>
            {(item) => (
              <button
                type="button"
                onClick={() => {
                  item.onClick()
                  onClose()
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#272a31')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 5,
                  padding: '7px 10px',
                  fontSize: 12.5,
                  lineHeight: 1.3,
                  color: item.danger ? '#f87171' : '#e7e9ec',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 320,
                }}
              >
                {item.label}
              </button>
            )}
          </For>
        </div>
      )}
    </Show>
  )
}
