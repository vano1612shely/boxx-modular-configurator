'use client'

import { createContext, useContext, type ComponentPropsWithoutRef, type ElementType } from 'react'
import { tv } from 'tailwind-variants'

/* The configurator is a rectangle inside the client's page: their sticky header
   has to win, so nothing anywhere may reach past 50. */
export const OVERLAY_Z = {
  header: 20,
  bar: 20,
  quote: 30,
  panel: 40,
  modal: 50,
} as const

export type OverlayLayer = keyof typeof OVERLAY_Z

export type FloatingBarTone = 'surface' | 'ink'

const ToneContext = createContext<FloatingBarTone>('surface')

const bar = tv({
  base: 'flex items-center',
  variants: {
    tone: {
      surface: 'bg-card text-foreground shadow-xl ring-1 ring-border',
      ink: 'bg-ink/95 text-surface shadow-lg backdrop-blur',
    },
    shape: {
      pill: 'gap-1 rounded-full p-1.5',
      panel: 'gap-2 rounded-xl p-2',
    },
  },
  defaultVariants: { tone: 'surface', shape: 'pill' },
})

const divider = tv({
  base: 'shrink-0 rounded-full',
  variants: {
    tone: {
      surface: 'bg-border',
      ink: 'bg-surface/20',
    },
    orientation: {
      vertical: 'h-6 w-px',
      horizontal: 'h-px w-full',
    },
  },
  defaultVariants: { orientation: 'vertical' },
})

export type FloatingBarProps = ComponentPropsWithoutRef<'div'> & {
  tone?: FloatingBarTone
  shape?: 'pill' | 'panel'
}

export function FloatingBar({
  tone = 'surface',
  shape = 'pill',
  className,
  children,
  ...rest
}: FloatingBarProps) {
  return (
    <ToneContext value={tone}>
      <div className={bar({ tone, shape, className })} {...rest}>
        {children}
      </div>
    </ToneContext>
  )
}

export type FloatingBarDividerProps = {
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

function Divider({ orientation = 'vertical', className }: FloatingBarDividerProps) {
  const tone = useContext(ToneContext)

  return <span aria-hidden className={divider({ tone, orientation, className })} />
}

FloatingBar.Divider = Divider

const overlay = tv({
  base: 'pointer-events-none absolute [&>*]:pointer-events-auto',
  variants: {
    corner: {
      'top-left':
        'top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))]',
      'top-right':
        'top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))]',
      'bottom-center':
        'bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2',
      /* Between the header on the left and the quote button on the right. On a
         phone those two leave no room across the top, so it drops to its own
         row underneath rather than being squeezed between them. */
      'top-center':
        'top-[calc(max(1rem,env(safe-area-inset-top))+3.5rem)] left-1/2 -translate-x-1/2 desktop:top-[max(1rem,env(safe-area-inset-top))]',
      /* A sheet pads its own bottom inset, so its surface keeps reaching the
         screen edge instead of leaving a strip of canvas under the home bar. */
      'bottom-sheet': 'inset-x-0 bottom-0',
    },
  },
})

export type SceneOverlayProps = ComponentPropsWithoutRef<'div'> & {
  as?: ElementType
  corner: 'top-left' | 'top-right' | 'top-center' | 'bottom-center' | 'bottom-sheet'
  z?: OverlayLayer
}

export function SceneOverlay({
  as = 'div',
  corner,
  z = 'bar',
  className,
  style,
  children,
  ...rest
}: SceneOverlayProps) {
  const Component = as as 'div'

  return (
    <Component
      className={overlay({ corner, className })}
      style={{ zIndex: OVERLAY_Z[z], ...style }}
      {...rest}
    >
      {children}
    </Component>
  )
}
