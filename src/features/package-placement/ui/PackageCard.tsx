'use client'

import { Plus } from 'lucide-react'

import { cn } from '@/shared/lib'
import { Show } from '@/shared/ui/control-flow'

import { useModelThumbnail } from '../lib/model-thumbnails'
import type { PackageOffer } from '../model/use-package-placement-model'

export function PackageCard({
  offer,
  onAdd,
}: {
  offer: PackageOffer
  onAdd: () => void
}) {
  const { pkg, fits } = offer
  const rendered = useModelThumbnail(pkg.modelUrl)
  const image = pkg.thumbnailUrl ?? rendered

  return (
    <button
      type="button"
      disabled={!fits}
      onClick={onAdd}
      title={fits ? `Add ${pkg.title} to the room` : 'Does not fit this room'}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl bg-card text-left',
        'ring-1 ring-border transition-all duration-200',
        fits
          ? 'hover:-translate-y-0.5 hover:shadow-lg hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary'
          : 'cursor-not-allowed opacity-55',
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-b from-muted/40 to-muted">
        <Show
          when={image}
          fallback={
            <div className="size-full animate-pulse bg-muted" />
          }
        >
          {(src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={pkg.title}
              loading="lazy"
              className="size-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
            />
          )}
        </Show>

        <Show when={fits}>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/10 group-hover:opacity-100"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-white text-neutral-900 shadow-lg">
              <Plus size={20} strokeWidth={2.5} />
            </span>
          </span>
        </Show>

        <Show when={!fits}>
          <span className="absolute inset-x-2 bottom-2 rounded-lg bg-background/95 px-2 py-1 text-center text-[11px] font-medium text-muted-foreground">
            Too large for this room
          </span>
        </Show>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          {pkg.family} · {pkg.tier}
        </span>
        <span className="line-clamp-2 text-sm leading-snug font-medium">{pkg.title}</span>
        <Show when={pkg.price}>
          {(price) => (
            <span className="mt-auto pt-1 text-sm font-semibold">
              ${price.toLocaleString('en-US')}
            </span>
          )}
        </Show>
      </div>
    </button>
  )
}
