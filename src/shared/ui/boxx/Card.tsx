import type { ComponentProps, ElementType } from 'react'
import { tv, type VariantProps } from 'tailwind-variants'

import { cn } from '@/shared/lib'

const card = tv({
  variants: {
    tone: {
      surface: 'bg-card text-card-foreground',
      page: 'bg-background text-foreground',
      cream: 'bg-secondary text-foreground',
      rose: 'bg-brand-soft text-ink',
      success: 'bg-success-soft text-ink',
    },
    radius: {
      panel: 'rounded-xl',
      card: 'rounded-lg',
      media: 'rounded-sm',
    },
    // Ink-tinted so the lift stays warm on White Sand; a neutral black shadow
    // reads grey against the sand ground.
    elevation: {
      none: '',
      soft: 'shadow-sm shadow-ink/8',
      float: 'shadow-xl shadow-ink/15',
    },
    pad: {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-block',
    },
    hairline: {
      true: 'ring-1 ring-border',
      false: '',
    },
  },
  defaultVariants: {
    tone: 'surface',
    radius: 'panel',
    elevation: 'soft',
    pad: 'none',
    hairline: false,
  },
})

export type CardProps = VariantProps<typeof card> &
  ComponentProps<'div'> & {
    as?: ElementType
  }

export function Card({
  as = 'div',
  tone,
  radius,
  elevation,
  pad,
  hairline,
  className,
  ...rest
}: CardProps) {
  const Component = as as 'div'

  return (
    <Component
      className={cn(card({ tone, radius, elevation, pad, hairline }), className)}
      {...rest}
    />
  )
}
