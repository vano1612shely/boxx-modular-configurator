import { cn } from '@/shared/lib'
import { Show } from '@/shared/ui/control-flow'

export type ProgressProps = {
  step?: number
  total?: number
  indeterminate?: boolean
  className?: string
}

const KEYFRAMES = `@keyframes boxx-progress-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(250%); }
}`

export function Progress({ step, total, indeterminate = false, className }: ProgressProps) {
  const counted = typeof step === 'number' && typeof total === 'number' && total > 0

  // Floor, not round: the reference reads step 1 of 6 as 16%.
  const percent = counted ? Math.min(Math.max(Math.floor((step / total) * 100), 0), 100) : 0

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      <style href="boxx-progress" precedence="medium">
        {KEYFRAMES}
      </style>

      <div
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : percent}
        aria-valuetext={counted ? `Step ${step} of ${total}` : undefined}
        className="h-[3px] w-full overflow-hidden bg-background"
      >
        <Show
          when={indeterminate}
          fallback={
            <div
              className="h-full bg-brand transition-[width] duration-500 ease-out"
              style={{ width: `${percent}%` }}
            />
          }
        >
          <div className="h-full w-2/5 animate-[boxx-progress-slide_1.4s_ease-in-out_infinite] bg-brand motion-reduce:w-full motion-reduce:animate-none" />
        </Show>
      </div>

      <Show when={counted}>
        <div className="flex items-baseline justify-between text-[11px] font-medium text-foreground">
          <span>
            Step {step} of {total}
          </span>
          <span>{percent}%</span>
        </div>
      </Show>
    </div>
  )
}
