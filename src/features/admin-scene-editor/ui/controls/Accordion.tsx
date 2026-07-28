'use client'

import { useState, type ReactNode } from 'react'

import { Show } from '@/shared/ui/control-flow'

import { s } from '../editor-styles'

type Props = {
  title: string
  badge?: number
  defaultOpen?: boolean
  children: ReactNode
}

export function Accordion({ title, badge, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section style={s.accordion}>
      <button type="button" style={s.accordionHeader} onClick={() => setOpen((v) => !v)}>
        <span style={{ opacity: 0.6 }}>{open ? '▾' : '▸'}</span>
        {title}
        <Show when={badge !== undefined}>
          <span style={s.accordionBadge}>{badge}</span>
        </Show>
      </button>
      <Show when={open}>
        <div style={s.body}>{children}</div>
      </Show>
    </section>
  )
}
