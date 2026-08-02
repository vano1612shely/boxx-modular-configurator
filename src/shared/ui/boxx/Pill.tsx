'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { tv } from 'tailwind-variants'

import { Match, Show, Switch } from '@/shared/ui/control-flow'

const pill = tv({
  base: [
    'inline-flex shrink-0 items-center justify-center rounded-full font-medium whitespace-nowrap',
    'transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40',
  ],
  variants: {
    variant: {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
      secondary: 'text-foreground ring-1 ring-border hover:bg-ink/5',
      ghost: 'text-foreground hover:bg-secondary',
      'ghost-inverted': 'text-surface/85 hover:bg-surface/10',
      brand: 'bg-brand text-surface hover:bg-brand-deep',
    },
    size: {
      sm: 'h-9 min-w-9 gap-1.5 px-3.5 text-sm',
      md: 'h-11 min-w-11 gap-2 px-5 text-base',
      lg: 'h-13 min-w-13 gap-2.5 px-6 text-lg',
    },
    arrow: { none: '', bare: '', circled: '' },
    labelFrom: { always: '', desktop: '' },
    selected: { true: '', false: '' },
    block: { true: 'w-full whitespace-normal', false: '' },
  },
  compoundVariants: [
    {
      selected: true,
      variant: ['primary', 'secondary', 'ghost', 'brand'],
      class: 'bg-primary text-primary-foreground ring-transparent hover:bg-primary/90',
    },
    {
      selected: true,
      variant: 'ghost-inverted',
      class: 'bg-surface/20 text-surface hover:bg-surface/20',
    },
    { labelFrom: 'desktop', size: 'sm', class: 'px-2.5 desktop:px-3.5' },
    { labelFrom: 'desktop', size: 'md', class: 'px-3 desktop:px-5' },
    { labelFrom: 'desktop', size: 'lg', class: 'px-3.5 desktop:px-6' },
    { block: true, arrow: ['bare', 'circled'], class: 'justify-between text-left' },
    { block: true, size: 'sm', class: 'h-auto min-h-9 py-2' },
    { block: true, size: 'md', class: 'h-auto min-h-11 py-2.5' },
    { block: true, size: 'lg', class: 'h-auto min-h-13 py-3' },
  ],
  defaultVariants: {
    variant: 'secondary',
    size: 'md',
    arrow: 'none',
    labelFrom: 'always',
    selected: false,
    block: false,
  },
})

const arrowRing = tv({
  base: 'grid shrink-0 place-items-center rounded-full ring-1 ring-current/30',
  variants: { size: { sm: 'size-5', md: 'size-6', lg: 'size-7' } },
  defaultVariants: { size: 'md' },
})

const ARROW_SIZE = { sm: 14, md: 16, lg: 18 } as const

export type PillSize = keyof typeof ARROW_SIZE
export type PillLabelFrom = 'always' | 'desktop'

type PillOwnProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'ghost-inverted' | 'brand'
  size?: PillSize
  arrow?: 'none' | 'bare' | 'circled'
  leadingIcon?: ReactNode
  labelFrom?: PillLabelFrom
  selected?: boolean
  block?: boolean
  children?: ReactNode
}

export type PillProps = PillOwnProps & Omit<ComponentProps<'button'>, keyof PillOwnProps>
export type PillLinkProps = PillOwnProps & Omit<ComponentProps<typeof Link>, keyof PillOwnProps>

/** `hidden` drops the label out of the accessibility tree, so a string label becomes aria-label. */
function collapsedLabel(labelFrom: PillLabelFrom, children: ReactNode) {
  if (labelFrom !== 'desktop') return undefined

  return typeof children === 'string' ? children : undefined
}

type PillBodyProps = {
  arrow: 'none' | 'bare' | 'circled'
  labelFrom: PillLabelFrom
  leadingIcon?: ReactNode
  size: PillSize
  children?: ReactNode
}

function PillBody({ arrow, labelFrom, leadingIcon, size, children }: PillBodyProps) {
  return (
    <>
      <Show when={leadingIcon}>{leadingIcon}</Show>
      <Show when={labelFrom === 'desktop'} fallback={children}>
        <span className="hidden desktop:inline">{children}</span>
      </Show>
      <Switch>
        <Match when={arrow === 'bare'}>
          <ArrowRight size={ARROW_SIZE[size]} className="shrink-0" />
        </Match>
        <Match when={arrow === 'circled'}>
          <span className={arrowRing({ size })}>
            <ArrowRight size={ARROW_SIZE[size] - 2} />
          </span>
        </Match>
      </Switch>
    </>
  )
}

export function Pill({
  variant,
  size = 'md',
  arrow = 'none',
  leadingIcon,
  labelFrom = 'always',
  selected,
  block,
  className,
  children,
  type = 'button',
  ...rest
}: PillProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      aria-label={collapsedLabel(labelFrom, children)}
      className={pill({ variant, size, arrow, labelFrom, selected, block, className })}
      {...rest}
    >
      <PillBody arrow={arrow} labelFrom={labelFrom} leadingIcon={leadingIcon} size={size}>
        {children}
      </PillBody>
    </button>
  )
}

export function PillLink({
  variant,
  size = 'md',
  arrow = 'none',
  leadingIcon,
  labelFrom = 'always',
  selected,
  block,
  className,
  children,
  ...rest
}: PillLinkProps) {
  return (
    <Link
      aria-current={selected ? 'true' : undefined}
      aria-label={collapsedLabel(labelFrom, children)}
      className={pill({ variant, size, arrow, labelFrom, selected, block, className })}
      {...rest}
    >
      <PillBody arrow={arrow} labelFrom={labelFrom} leadingIcon={leadingIcon} size={size}>
        {children}
      </PillBody>
    </Link>
  )
}
