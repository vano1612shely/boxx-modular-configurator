'use client'

import { useState } from 'react'

import type { BuildingScene } from '@/entities/building'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
import { cn } from '@/shared/lib'
import { For, Show } from '@/shared/ui/control-flow'

import { usePackagePlacementModel, type PackageOffer } from '../model/use-package-placement-model'

type Props = {
  building: BuildingScene
  packages: FurniturePackageEntity[]
}

export function PackagePanel({ building, packages }: Props) {
  const vm = usePackagePlacementModel({ building, packages })
  const [addError, setAddError] = useState<string | null>(null)

  const handleAdd = (offer: PackageOffer) => {
    setAddError(null)
    const added = vm.onAddPackage(offer.pkg)
    if (!added) setAddError(`No free space left for “${offer.pkg.title}” in this room.`)
  }

  return (
    <Show when={vm.isPanelOpen}>
      <aside className="absolute inset-x-0 bottom-0 max-h-[45dvh] overflow-y-auto border-t bg-background/95 p-4 shadow-lg backdrop-blur md:inset-x-auto md:top-0 md:right-0 md:h-full md:max-h-none md:w-80 md:border-t-0 md:border-l">
        <h2 className="text-sm font-semibold">Furniture for {vm.focusedRoom?.name}</h2>

        <Show when={addError}>
          {(message) => <p className="mt-2 text-xs text-destructive">{message}</p>}
        </Show>

        <div className="mt-3 space-y-2">
          <For
            each={vm.offers}
            getKey={(offer) => offer.pkg.id}
            fallback={
              <p className="text-xs text-muted-foreground">
                No packages available for this room type yet.
              </p>
            }
          >
            {(offer) => (
              <div
                className={cn(
                  'rounded-lg border p-3',
                  !offer.fits && 'opacity-50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{offer.pkg.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {offer.pkg.family} · {offer.pkg.tier}
                      <Show when={offer.pkg.price}>{(price) => <> · ${price.toLocaleString()}</>}</Show>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!offer.fits}
                    onClick={() => handleAdd(offer)}
                    className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed"
                  >
                    + Add
                  </button>
                </div>
                <Show when={!offer.fits}>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Does not fit this room’s dimensions.
                  </p>
                </Show>
              </div>
            )}
          </For>
        </div>

        <Show when={vm.placedInFocusedRoom.length > 0}>
          <h3 className="mt-5 text-xs font-semibold text-muted-foreground uppercase">In this room</h3>
          <div className="mt-2 space-y-1.5">
            <For each={vm.placedInFocusedRoom} getKey={(p) => p.instanceId}>
              {(placedItem) => (
                <div className="flex items-center justify-between rounded-md bg-secondary/60 px-3 py-1.5">
                  <span className="text-xs">{placedItem.pkg?.title ?? 'Package'}</span>
                  <button
                    type="button"
                    onClick={() => vm.onRemovePackage(placedItem.instanceId)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </aside>
    </Show>
  )
}
