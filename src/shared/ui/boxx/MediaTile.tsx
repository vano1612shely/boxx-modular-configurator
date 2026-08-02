'use client'

import type { ReactNode } from 'react'
import { tv } from 'tailwind-variants'

import { cn } from '@/shared/lib'
import { Show } from '@/shared/ui/control-flow'

const plateClass = tv({
  base: 'absolute inset-0 overflow-hidden',
  variants: {
    plate: {
      cream: 'bg-secondary',
      page: 'bg-background',
      surface: 'bg-card',
    },
  },
})

const imageClass = tv({
  base: 'size-full transition-transform duration-300',
  variants: {
    fit: {
      cover: 'object-cover',
      contain: 'object-contain p-4',
    },
    dimmed: {
      true: 'opacity-45',
      false: 'group-hover:scale-105',
    },
  },
})

export type MediaTileProps = {
  src?: string | null
  /* Thumbnails here are transparent product renders framed with padding from a
     high camera — cover-cropping one clips the furniture. */
  fit: 'cover' | 'contain'
  plate: 'cream' | 'page' | 'surface'
  title: ReactNode
  meta?: ReactNode
  badge?: ReactNode
  disabled?: boolean
  disabledNote?: ReactNode
  action: { icon: ReactNode; label: string; onClick: () => void }
  onSelect?: () => void
  className?: string
}

export function MediaTile({
  src,
  fit,
  plate,
  title,
  meta,
  badge,
  disabled = false,
  disabledNote,
  action,
  onSelect,
  className,
}: MediaTileProps) {
  const body = (
    <>
      <span className={plateClass({ plate })}>
        <Show when={src} fallback={<span className="block size-full animate-pulse bg-muted" />}>
          {(url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              loading="lazy"
              className={imageClass({ fit, dimmed: disabled })}
            />
          )}
        </Show>
      </span>

      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 block h-2/3 bg-gradient-to-t from-ink/75 via-ink/25 to-transparent"
      />

      <span className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-1 p-4">
        <Show when={disabled ? disabledNote : null}>
          {(note) => (
            <span className="rounded-full bg-surface/90 px-2 py-0.5 text-xs text-ink">{note}</span>
          )}
        </Show>
        <span className="text-base leading-snug font-medium text-surface">{title}</span>
        <Show when={meta}>
          {(value) => <span className="text-sm text-surface/85">{value}</span>}
        </Show>
      </span>
    </>
  )

  const bodyClass = 'absolute inset-0 block text-left'

  return (
    <div
      className={cn(
        'group relative isolate aspect-square overflow-hidden rounded-sm ring-1 ring-border',
        className,
      )}
    >
      <Show when={onSelect} fallback={<div className={bodyClass}>{body}</div>}>
        {(select) => (
          <button
            type="button"
            onClick={select}
            disabled={disabled}
            className={cn(
              bodyClass,
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              disabled && 'cursor-not-allowed',
            )}
          >
            {body}
          </button>
        )}
      </Show>

      <Show when={badge}>
        {(content) => <div className="absolute top-3 left-3">{content}</div>}
      </Show>

      <button
        type="button"
        onClick={action.onClick}
        disabled={disabled}
        aria-label={action.label}
        title={action.label}
        className={cn(
          'absolute top-3 right-3 flex size-11 items-center justify-center rounded-full',
          'bg-card text-foreground shadow-md ring-1 ring-border transition-transform',
          'hover:scale-105 active:scale-95',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        {action.icon}
      </button>
    </div>
  )
}
