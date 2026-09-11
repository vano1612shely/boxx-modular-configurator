'use client'

import { useProgress } from '@react-three/drei'

import { cn } from '@/shared/lib'
import { Progress } from '@/shared/ui/boxx'

export function SceneLoader({
  /** Still building the scene, even if nothing is downloading. */
  busy = false,
  /**
   * True once the building is up and warm.
   *
   * From then on a download is never the visitor's wait: doors, windows,
   * textures and furniture are fetched in the background, on purpose, and
   * the first of them used to bring this whole veil back — blurred, mid-flight
   * into a room — for the half second the door took to arrive.
   */
  settled = false,
}: {
  busy?: boolean
  settled?: boolean
}) {
  const active = useProgress((state) => state.active) && !settled
  const loaded = useProgress((state) => state.loaded)
  const total = useProgress((state) => state.total)
  const waiting = active || busy

  return (
    <div
      aria-busy={waiting}
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center gap-3',
        'bg-background/80 backdrop-blur-sm transition-opacity',
        waiting ? 'opacity-100 duration-100' : 'pointer-events-none opacity-0 duration-500',
      )}
    >
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {active ? 'Loading the model' : 'Preparing the building'}
      </p>
      <Progress
        className="w-56 max-w-[70%]"
        indeterminate={!active}
        step={active ? loaded : undefined}
        total={active ? total : undefined}
      />
    </div>
  )
}
