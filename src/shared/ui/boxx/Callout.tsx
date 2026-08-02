import type { ComponentProps, ElementType, ReactNode } from 'react'
import { tv } from 'tailwind-variants'

import { cn } from '@/shared/lib'
import { Show } from '@/shared/ui/control-flow'

const callout = tv({
  slots: {
    root: 'flex gap-4 rounded-lg p-6',
    disc: 'grid size-12 shrink-0 place-items-center rounded-full [&_svg]:size-5 [&_svg]:shrink-0',
    body: 'flex min-w-0 flex-col gap-2',
    title: 'text-lg leading-normal font-medium',
    copy: 'text-base leading-normal',
    action: 'mt-2 flex flex-wrap gap-card',
  },
  variants: {
    tone: {
      // Where a constraint is explained rather than a failure reported.
      notice: { root: 'bg-muted text-foreground', disc: 'bg-ink/8 text-ink' },
      info: { root: 'bg-brand-soft text-ink', disc: 'bg-brand/15 text-brand' },
      // Green carries the icons only; on White Sand + green the copy is ink.
      success: { root: 'bg-success-soft text-ink', disc: 'bg-success/20 text-success' },
      danger: {
        root: 'bg-destructive/10 text-destructive',
        disc: 'bg-destructive/15 text-destructive',
      },
    },
    align: {
      start: { root: 'items-start text-left', action: 'justify-start' },
      center: {
        root: 'flex-col items-center text-center',
        body: 'items-center',
        action: 'justify-center',
      },
    },
  },
  defaultVariants: {
    align: 'start',
  },
})

export type CalloutProps = Omit<ComponentProps<'div'>, 'title'> & {
  tone: 'notice' | 'info' | 'success' | 'danger'
  icon?: ReactNode
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  align?: 'start' | 'center'
}

export function Callout({
  tone,
  icon,
  title,
  children,
  action,
  align,
  className,
  ...rest
}: CalloutProps) {
  const styles = callout({ tone, align })

  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className={cn(styles.root(), className)}
      {...rest}
    >
      <Show when={icon}>
        <span aria-hidden className={styles.disc()}>
          {icon}
        </span>
      </Show>

      <div className={styles.body()}>
        <Show when={title}>
          <p className={styles.title()}>{title}</p>
        </Show>

        <Show when={children}>
          <div className={styles.copy()}>{children}</div>
        </Show>

        <Show when={action}>
          <div className={styles.action()}>{action}</div>
        </Show>
      </div>
    </div>
  )
}

export type CenteredPanelProps = ComponentProps<'div'> & {
  as?: ElementType
}

export function CenteredPanel({ as = 'div', className, ...rest }: CenteredPanelProps) {
  const Component = as as 'div'

  return (
    <Component
      className={cn(
        'flex min-h-dvh w-full flex-col items-center justify-center gap-block bg-background p-6 text-center',
        className,
      )}
      {...rest}
    />
  )
}
