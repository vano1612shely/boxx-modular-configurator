'use client'

import { CircleAlert, Minus, Plus } from 'lucide-react'
import { useId, useState, type ComponentPropsWithRef, type KeyboardEvent, type ReactNode } from 'react'
import { tv } from 'tailwind-variants'

import { cn } from '@/shared/lib'
import { Show } from '@/shared/ui/control-flow'

export type FieldControlProps = {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': true | undefined
}

export type FieldProps = {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  className?: string
  children: ReactNode | ((control: FieldControlProps) => ReactNode)
}

const control = tv({
  base: 'h-12 w-full rounded-full bg-card px-5 text-base text-foreground ring-1 ring-input outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50',
  variants: {
    invalid: { true: 'ring-destructive' },
  },
})

const shell = tv({
  base: 'flex h-12 w-full items-center rounded-full bg-card ring-1 ring-input has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-background',
  variants: {
    invalid: { true: 'ring-destructive' },
  },
})

const stepButton =
  'flex size-12 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40'

export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId()
  const controlId = `${id}-control`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  const described = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  const props: FieldControlProps = {
    id: controlId,
    'aria-describedby': described || undefined,
    'aria-invalid': error ? true : undefined,
  }

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <label htmlFor={controlId} className="text-sm font-medium text-foreground">
        {label}
      </label>

      {typeof children === 'function' ? children(props) : children}

      <Show when={hint}>
        <p id={hintId} className="px-5 text-xs text-muted-foreground">
          {hint}
        </p>
      </Show>

      <Show when={error}>
        <p id={errorId} className="flex items-start gap-1.5 px-5 text-xs text-destructive">
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      </Show>
    </div>
  )
}

export type FieldTextProps = Omit<
  ComponentPropsWithRef<'input'>,
  'id' | 'className' | 'aria-describedby' | 'aria-invalid'
> & {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  className?: string
  inputClassName?: string
}

function FieldText({
  label,
  hint,
  error,
  className,
  inputClassName,
  type = 'text',
  ...rest
}: FieldTextProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(props) => (
        <input
          {...rest}
          {...props}
          type={type}
          className={control({ invalid: Boolean(error), className: inputClassName })}
        />
      )}
    </Field>
  )
}

export type FieldStepperProps = {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  className?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  name?: string
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max)

function FieldStepper({
  label,
  hint,
  error,
  className,
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  disabled = false,
  name,
}: FieldStepperProps) {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (next: number) => {
    setDraft(null)
    onChange(clamp(next, min, max))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      commit(value + step)
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      commit(value - step)
    }
  }

  const suffix = typeof label === 'string' ? ` ${label}` : ''

  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(props) => (
        <div className={shell({ invalid: Boolean(error) })}>
          <button
            type="button"
            aria-label={`Decrease${suffix}`}
            className={stepButton}
            disabled={disabled || value <= min}
            onClick={() => commit(value - step)}
          >
            <Minus aria-hidden className="size-4" />
          </button>

          <input
            {...props}
            name={name}
            role="spinbutton"
            inputMode="numeric"
            autoComplete="off"
            disabled={disabled}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            value={draft ?? String(value)}
            onChange={(event) => {
              const raw = event.target.value
              setDraft(raw)
              const parsed = Number.parseInt(raw, 10)
              if (!Number.isNaN(parsed)) onChange(clamp(parsed, min, max))
            }}
            onBlur={() => setDraft(null)}
            onKeyDown={handleKeyDown}
            className="min-w-0 flex-1 bg-card text-center text-base text-foreground outline-none disabled:opacity-50"
          />

          <button
            type="button"
            aria-label={`Increase${suffix}`}
            className={stepButton}
            disabled={disabled || value >= max}
            onClick={() => commit(value + step)}
          >
            <Plus aria-hidden className="size-4" />
          </button>
        </div>
      )}
    </Field>
  )
}

Field.Text = FieldText
Field.Stepper = FieldStepper
