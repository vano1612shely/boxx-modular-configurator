'use client'

import { ChevronDown, Info, Plus, Sofa, Trash2 } from 'lucide-react'
import { useState } from 'react'

import type { BuildingScene } from '@/entities/building'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
import { cn } from '@/shared/lib'
import { Callout, Card, Chip, Eyebrow, MediaTile, OVERLAY_Z, SceneOverlay } from '@/shared/ui/boxx'
import { For, Show } from '@/shared/ui/control-flow'

import { ModelThumbnailFactory, useModelThumbnail } from '../lib/model-thumbnails'
import {
  usePackagePlacementModel,
  type PackageOffer,
  type PackagePlacementVm,
} from '../model/use-package-placement-model'

const SHEET_INSET = 'px-[max(1.25rem,env(safe-area-inset-left))]'
const SHEET_OPEN = 'max-h-[68dvh]'
const SHEET_CLOSED = 'max-h-[calc(4.75rem+env(safe-area-inset-bottom))]'

type Props = {
  building: BuildingScene
  packages: FurniturePackageEntity[]
}

export function PackagePanel({ building, packages }: Props) {
  const vm = usePackagePlacementModel({ building, packages })
  const [addError, setAddError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [coachedRoom, setCoachedRoom] = useState<string | null>(null)

  // Opened once, on the first room of the session, and only while that room is
  // still bare. The collapsed strip sits at the bottom of a full-screen scene
  // and is easy to miss entirely; seeing it open once is the cheapest way to
  // say it is there, and it costs nothing on every room after.
  //
  // Adjusted during render rather than in an effect — React's own pattern for
  // reacting to a changed input — so the sheet is never painted shut and then
  // flipped open a frame later.
  const focusedKey = vm.focusedRoom?.key ?? null
  if (focusedKey !== null && coachedRoom === null) {
    setCoachedRoom(focusedKey)
    if (vm.placedInFocusedRoom.length === 0) setExpanded(true)
  }

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
    <>
      {/* Outside the panel's own mount: it owns a second WebGL context, and
          tying that to room focus meant tearing a GPU context down and standing
          a new one up — with a fresh environment map — on every room the
          visitor entered or left. */}
      <ModelThumbnailFactory urls={vm.offers.map((offer) => offer.pkg.modelUrl)} />

      <Show when={vm.isPanelOpen}>
      <Show when={expanded}>
        <SceneOverlay corner="bottom-sheet" z="panel" className="top-0 desktop:hidden">
          <button
            type="button"
            aria-label="Close the furniture list"
            onClick={() => setExpanded(false)}
            className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]"
          />
        </SceneOverlay>
      </Show>

      <SceneOverlay corner="bottom-sheet" z="panel" className="desktop:hidden">
        <Card
          tone="page"
          elevation="float"
          hairline
          className={cn(
            'flex flex-col overflow-hidden rounded-b-none pb-[env(safe-area-inset-bottom)]',
            'transition-[max-height] duration-300 ease-out',
            expanded ? SHEET_OPEN : SHEET_CLOSED,
          )}
        >
          {/* Reads as a sheet you can pull rather than a status strip. */}
          <div
            aria-hidden
            className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
          />

          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className={cn('flex h-14 w-full shrink-0 items-center gap-3 text-left', SHEET_INSET)}
          >
            <Sofa size={18} className="shrink-0" />
            <span className="flex-1 truncate text-base font-medium">
              {/* An empty room gets told what to do with the sheet, not what it
                  contains — which is nothing, and says nothing. */}
              {vm.placedInFocusedRoom.length === 0 ? 'Add furniture' : 'Furniture'}
              <span className="font-normal text-muted-foreground"> · {vm.focusedRoom?.name}</span>
            </span>
            <Show when={vm.placedInFocusedRoom.length > 0}>
              <Chip tone="ink" size="sm">
                {vm.placedInFocusedRoom.length}
              </Chip>
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
              'min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4',
              SHEET_INSET,
              !expanded && 'hidden',
            )}
          >
            <PanelBody vm={vm} addError={addError} onAdd={handleAdd} />
          </div>
        </Card>
      </SceneOverlay>

      <aside
        style={{ zIndex: OVERLAY_Z.bar }}
        className="absolute top-0 right-0 hidden h-full w-[22rem] flex-col border-l border-border bg-background/95 backdrop-blur desktop:flex lg:w-[26rem]"
      >
        <header className="flex items-baseline justify-between gap-2 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg leading-normal font-medium">Furniture</h2>
            <Eyebrow className="truncate">{vm.focusedRoom?.name}</Eyebrow>
          </div>
          <Eyebrow className="shrink-0">
            {vm.offers.length} {vm.offers.length === 1 ? 'item' : 'items'}
          </Eyebrow>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <PanelBody vm={vm} addError={addError} onAdd={handleAdd} />
        </div>
      </aside>
      </Show>
    </>
  )
}

type BodyProps = {
  vm: PackagePlacementVm
  addError: string | null
  onAdd: (offer: PackageOffer) => void
}

function PanelBody({ vm, addError, onAdd }: BodyProps) {
  return (
    <>
      <Show when={addError}>
        {(message) => (
          <Callout tone="notice" icon={<Info />} className="mb-card gap-3 p-4">
            {message}
          </Callout>
        )}
      </Show>

      {/* Two blocks only when there is something in the first: a catalogue with
          nothing named for this room would otherwise grow a heading that says
          the same as no heading at all. */}
      <Show when={vm.offerGroups.recommended.length > 0}>
        <Eyebrow as="h3" className="mb-card">
          Recommended for this room
        </Eyebrow>
        <OfferGrid offers={vm.offerGroups.recommended} onAdd={onAdd} />
        <Show when={vm.offerGroups.other.length > 0}>
          <Eyebrow as="h3" className="mt-block mb-card">
            More furniture
          </Eyebrow>
        </Show>
      </Show>

      <OfferGrid
        offers={vm.offerGroups.other}
        onAdd={onAdd}
        empty={vm.offerGroups.recommended.length === 0}
      />

      <Show when={vm.placedInFocusedRoom.length > 0}>
        <Eyebrow as="h3" className="mt-block mb-card">
          In this room
        </Eyebrow>
        <ul className="flex flex-col gap-card">
          <For each={vm.placedInFocusedRoom} getKey={(p) => p.instanceId}>
            {(placedItem) => (
              <Card
                as="li"
                tone="cream"
                radius="card"
                elevation="none"
                className="flex items-center justify-between gap-2 py-1 pr-1 pl-3"
              >
                <span className="truncate text-sm">{placedItem.pkg?.title ?? 'Package'}</span>
                <button
                  type="button"
                  onClick={() => vm.onRemovePackage(placedItem.instanceId)}
                  aria-label={`Remove ${placedItem.pkg?.title ?? 'package'}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Trash2 size={16} />
                </button>
              </Card>
            )}
          </For>
        </ul>
      </Show>
    </>
  )
}

/** `empty` says this grid is the one that has to speak up when there is nothing. */
function OfferGrid({
  offers,
  onAdd,
  empty = false,
}: {
  offers: PackageOffer[]
  onAdd: (offer: PackageOffer) => void
  empty?: boolean
}) {
  if (offers.length === 0 && !empty) return null

  return (
    <div className="grid grid-cols-2 gap-card">
      <For
        each={offers}
        getKey={(offer) => offer.pkg.id}
        fallback={
          <Callout tone="notice" align="center" className="col-span-full p-4">
            Nothing available for this kind of room yet.
          </Callout>
        }
      >
        {(offer) => <OfferTile offer={offer} onAdd={() => onAdd(offer)} />}
      </For>
    </div>
  )
}

type OfferTileProps = {
  offer: PackageOffer
  onAdd: () => void
}

// A component per offer: the thumbnail subscription is a hook and the list length varies.
function OfferTile({ offer, onAdd }: OfferTileProps) {
  const { pkg, fits } = offer
  const rendered = useModelThumbnail(pkg.modelUrl)

  return (
    <MediaTile
      src={pkg.thumbnailUrl ?? rendered}
      fit={pkg.thumbnailUrl ? 'cover' : 'contain'}
      plate="cream"
      title={pkg.title}
      meta={pkg.price === null ? null : `$${pkg.price.toLocaleString('en-US')}`}
      badge={
        <Chip tone="glass" size="xs">
          {pkg.family} · {pkg.tier}
        </Chip>
      }
      disabled={!fits}
      disabledNote="Too large for this room"
      onSelect={onAdd}
      action={{
        icon: <Plus size={20} />,
        label: fits ? `Add ${pkg.title} to the room` : 'Does not fit this room',
        onClick: onAdd,
      }}
    />
  )
}
