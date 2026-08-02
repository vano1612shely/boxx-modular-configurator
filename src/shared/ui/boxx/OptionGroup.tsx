'use client'

import { ArrowRight } from 'lucide-react'
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { tv } from 'tailwind-variants'

import { cn } from '@/shared/lib'
import { For, Show } from '@/shared/ui/control-flow'

export type OptionGroupOption<T> = {
  value: T
  label: ReactNode
  hint?: ReactNode
  disabled?: boolean
}

export type OptionGroupProps<T> = {
  value: T | null
  onChange: (value: T) => void
  options: Array<OptionGroupOption<T>>
  label: string
  className?: string
}

const pill = tv({
  slots: {
    root: 'flex min-h-13 w-full items-center gap-4 rounded-full px-6 py-3 text-left text-base transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-45',
    body: 'flex min-w-0 flex-1 flex-col gap-0.5',
    hint: 'text-xs',
    arrow: 'size-4 shrink-0',
  },
  variants: {
    selected: {
      true: {
        root: 'bg-primary text-primary-foreground',
        hint: 'text-primary-foreground/70',
      },
      false: {
        root: 'bg-card text-foreground ring-1 ring-border hover:ring-foreground/25',
        hint: 'text-muted-foreground',
      },
    },
  },
})

export function OptionGroup<T>({ value, onChange, options, label, className }: OptionGroupProps<T>) {
  const items = useRef<Array<HTMLButtonElement | null>>([])

  const enabled = options.flatMap((option, index) => (option.disabled ? [] : [index]))
  const selectedIndex = options.findIndex(
    (option) => !option.disabled && Object.is(option.value, value),
  )
  const tabStop = selectedIndex >= 0 ? selectedIndex : (enabled[0] ?? -1)

  const focusAndSelect = (index: number | undefined) => {
    if (index === undefined) return
    const option = options[index]
    if (!option) return
    onChange(option.value)
    items.current[index]?.focus()
  }

  const step = (from: number, delta: number) => {
    const position = enabled.indexOf(from)
    if (position < 0) return enabled[0]
    return enabled[(position + delta + enabled.length) % enabled.length]
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (enabled.length === 0) return

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault()
        focusAndSelect(step(index, 1))
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault()
        focusAndSelect(step(index, -1))
        break
      case 'Home':
        event.preventDefault()
        focusAndSelect(enabled[0])
        break
      case 'End':
        event.preventDefault()
        focusAndSelect(enabled[enabled.length - 1])
        break
    }
  }

  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-col gap-2', className)}>
      <For each={options}>
        {(option, index) => {
          const selected = !option.disabled && Object.is(option.value, value)
          const styles = pill({ selected })

          return (
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={option.disabled}
              tabIndex={index === tabStop ? 0 : -1}
              ref={(node) => {
                items.current[index] = node
              }}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={styles.root()}
            >
              <span className={styles.body()}>
                <span>{option.label}</span>
                <Show when={option.hint}>
                  <span className={styles.hint()}>{option.hint}</span>
                </Show>
              </span>
              <ArrowRight aria-hidden className={styles.arrow()} />
            </button>
          )
        }}
      </For>
    </div>
  )
}
