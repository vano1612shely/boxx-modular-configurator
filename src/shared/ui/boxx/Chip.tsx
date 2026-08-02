import type { ComponentProps, ElementType, ReactNode } from 'react'
import { tv } from 'tailwind-variants'

import { Show } from '@/shared/ui/control-flow'

const chip = tv({
  slots: {
    root: 'inline-flex shrink-0 items-center rounded-full font-medium whitespace-nowrap',
    icon: 'inline-flex shrink-0 items-center',
  },
  variants: {
    tone: {
      neutral: { root: 'bg-secondary text-foreground' },
      ink: { root: 'bg-ink text-surface' },
      rose: { root: 'bg-brand-soft text-foreground' },
      gold: { root: 'bg-gold text-ink' },
      success: { root: 'bg-success-soft text-ink', icon: 'text-success' },
      glass: { root: 'bg-ink/70 text-surface backdrop-blur' },
    },
    size: {
      xs: { root: 'h-5 gap-1 px-2 text-[0.6875rem] [&_svg]:size-3' },
      sm: { root: 'h-6 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5' },
      md: { root: 'h-8 gap-1.5 px-3 text-sm [&_svg]:size-4' },
    },
  },
  defaultVariants: { tone: 'neutral', size: 'md' },
})

const eyebrow = tv({ base: 'text-[0.8125rem] text-muted-foreground' })

type ChipOwnProps = {
  tone?: 'neutral' | 'ink' | 'rose' | 'gold' | 'success' | 'glass'
  size?: 'xs' | 'sm' | 'md'
  icon?: ReactNode
  children?: ReactNode
}

export type ChipProps = ChipOwnProps & Omit<ComponentProps<'span'>, keyof ChipOwnProps>
export type EyebrowProps = ComponentProps<'p'> & { as?: ElementType }

export function Chip({ tone, size, icon, className, children, ...rest }: ChipProps) {
  const { root, icon: iconSlot } = chip({ tone, size })

  return (
    <span className={root({ className })} {...rest}>
      <Show when={icon}>
        <span className={iconSlot()}>{icon}</span>
      </Show>
      {children}
    </span>
  )
}

export function Eyebrow({ as = 'p', className, ...rest }: EyebrowProps) {
  const Component = as as 'p'

  return <Component className={eyebrow({ className })} {...rest} />
}
