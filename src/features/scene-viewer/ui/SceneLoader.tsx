'use client'

import { useProgress } from '@react-three/drei'

import { cn } from '@/shared/lib'

export function SceneLoader({
  /** Still building the scene, even if nothing is downloading. */
  busy = false,
}: {
  busy?: boolean
}) {
  const active = useProgress((state) => state.active)
  const progress = useProgress((state) => state.progress)
  const waiting = active || busy

  return (
    <div
      aria-live="polite"
      aria-busy={waiting}
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center gap-4',
        'bg-background/80 backdrop-blur-sm transition-opacity',
        waiting ? 'opacity-100 duration-100' : 'pointer-events-none opacity-0 duration-500',
      )}
    >
      {active ? <ProgressRing progress={progress} /> : <Spinner />}
      <p className="text-sm font-medium text-muted-foreground">
        {active ? 'Loading the model' : 'Preparing the building'}
      </p>
    </div>
  )
}

function Spinner() {
  return (
    <div className="size-14" aria-hidden>
      <svg className="size-full animate-spin" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="22" fill="none" strokeWidth="3" className="stroke-border" />
        <path
          d="M 28 6 A 22 22 0 0 1 50 28"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-primary"
        />
      </svg>
    </div>
  )
}

function ProgressRing({ progress }: { progress: number }) {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const shown = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 100) : 0

  return (
    <div className="relative size-14">
      <svg className="size-full -rotate-90" viewBox="0 0 56 56" aria-hidden>
        <circle cx="28" cy="28" r={radius} fill="none" strokeWidth="3" className="stroke-border" />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-out"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
        {Math.round(shown)}%
      </span>
    </div>
  )
}
