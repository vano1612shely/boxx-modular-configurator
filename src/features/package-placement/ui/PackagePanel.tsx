'use client'

import { ChevronDown, Sofa, Trash2 } from 'lucide-react'
import { useState } from 'react'

import type { BuildingScene } from '@/entities/building'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
import { cn } from '@/shared/lib'
import { For, Show } from '@/shared/ui/control-flow'

import { ModelThumbnailFactory } from '../lib/model-thumbnails'
import { usePackagePlacementModel, type PackageOffer } from '../model/use-package-placement-model'
import { PackageCard } from './PackageCard'

type Props = {
  building: BuildingScene
  packages: FurniturePackageEntity[]
}

export function PackagePanel({ building, packages }: Props) {
  const vm = usePackagePlacementModel({ building, packages })
  const [addError, setAddError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const handleAdd = (offer: PackageOffer) => {
    setAddError(null)
    const added = vm.onAddPackage(offer.pkg)

    if (!added) {
      setAddError(`No room left for “${offer.pkg.title}” here.`)
      return
    }

    // The phone sheet covers the half of the screen the furniture landed in.
    setExpanded(false)
  }

  return (
    <Show when={vm.isPanelOpen}>
      <ModelThumbnailFactory urls={vm.offers.map((offer) => offer.pkg.modelUrl)} />

      <div className="absolute inset-x-0 bottom-0 z-30 desktop:hidden">
        <Show when={expanded}>
          <button
            type="button"
            aria-label="Close the furniture list"
            onClick={() => setExpanded(false)}
            className="absolute inset-0 -z-10 bg-ink/20 backdrop-blur-[2px]"
          />
        </Show>

        <div
          className={cn(
            'rounded-t-3xl bg-background pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] ring-1 ring-border',
            'transition-[max-height] duration-300 ease-out',
            expanded ? 'max-h-[68dvh]' : 'max-h-16',
          )}
        >
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className="flex h-16 w-full items-center gap-3 px-[max(1.25rem,env(safe-area-inset-left))] text-left"
          >
            <Sofa size={18} className="shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-sm font-semibold">
              Furniture
              <span className="font-normal text-muted-foreground">
                {' '}
                · {vm.focusedRoom?.name}
              </span>
            </span>
            <Show when={vm.placedInFocusedRoom.length > 0}>
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                {vm.placedInFocusedRoom.length}
              </span>
            </Show>
            <ChevronDown
              size={18}
              className={cn(
                'shrink-0 text-muted-foreground transition-transform duration-300',
                expanded ? 'rotate-0' : 'rotate-180',
              )}
            />
          </button>

          <div
            className={cn(
              'overflow-y-auto overscroll-contain px-[max(1rem,env(safe-area-inset-left))] pb-4',
              expanded ? 'max-h-[calc(68dvh-4rem)]' : 'hidden',
            )}
          >
            <PanelBody vm={vm} addError={addError} onAdd={handleAdd} columns="grid-cols-2" />
          </div>
        </div>
      </div>

      <aside className="absolute top-0 right-0 z-20 hidden h-full w-[22rem] flex-col border-l bg-background/95 backdrop-blur desktop:flex lg:w-[26rem]">
        <header className="flex items-baseline justify-between gap-2 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">Furniture</h2>
            <p className="truncate text-xs text-muted-foreground">{vm.focusedRoom?.name}</p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {vm.offers.length} {vm.offers.length === 1 ? 'item' : 'items'}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <PanelBody
            vm={vm}
            addError={addError}
            onAdd={handleAdd}
            columns="grid-cols-2 lg:grid-cols-2"
          />
        </div>
      </aside>
    </Show>
  )
}

type BodyProps = {
  vm: ReturnType<typeof usePackagePlacementModel>
  addError: string | null
  onAdd: (offer: PackageOffer) => void
  columns: string
}

function PanelBody({ vm, addError, onAdd, columns }: BodyProps) {
  return (
    <>
      <Show when={addError}>
        {(message) => (
          <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {message}
          </p>
        )}
      </Show>

      <div className={cn('grid gap-3', columns)}>
        <For
          each={vm.offers}
          getKey={(offer) => offer.pkg.id}
          fallback={
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              Nothing available for this kind of room yet.
            </p>
          }
        >
          {(offer) => <PackageCard offer={offer} onAdd={() => onAdd(offer)} />}
        </For>
      </div>

      <Show when={vm.placedInFocusedRoom.length > 0}>
        <h3 className="mt-6 mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          In this room
        </h3>
        <ul className="space-y-1.5">
          <For each={vm.placedInFocusedRoom} getKey={(p) => p.instanceId}>
            {(placedItem) => (
              <li className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 py-2 pr-2 pl-3">
                <span className="truncate text-xs font-medium">
                  {placedItem.pkg?.title ?? 'Package'}
                </span>
                <button
                  type="button"
                  onClick={() => vm.onRemovePackage(placedItem.instanceId)}
                  aria-label={`Remove ${placedItem.pkg?.title ?? 'package'}`}
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </>
  )
}

