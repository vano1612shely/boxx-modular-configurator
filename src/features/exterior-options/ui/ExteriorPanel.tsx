'use client'

import { Check, ChevronDown, DoorOpen } from 'lucide-react'
import { useState } from 'react'

import type { BuildingScene, ExteriorVariant } from '@/entities/building'
import { cn } from '@/shared/lib'
import { Card, Chip, Eyebrow, OVERLAY_Z, SceneOverlay } from '@/shared/ui/boxx'
import { For, Show } from '@/shared/ui/control-flow'

import { useExteriorModel, type ExteriorSpotVm, type ExteriorVm } from '../model/use-exterior-model'

const SHEET_INSET = 'px-[max(1.25rem,env(safe-area-inset-left))]'
const SHEET_OPEN = 'max-h-[68dvh]'
const SHEET_CLOSED = 'max-h-[calc(4.75rem+env(safe-area-inset-bottom))]'

/**
 * What the visitor may pick outside the building — decks, stairs, ramps.
 *
 * The furniture panel's twin, on the same edge and in the same shapes, because
 * it answers the same kind of question one level out. Only one of the two is
 * ever on screen: this one while the whole building is in view, that one once a
 * room has been entered.
 */
export function ExteriorPanel({ building }: { building: BuildingScene }) {
  const vm = useExteriorModel({ building })
  const [expanded, setExpanded] = useState(false)
  const [seenOpen, setSeenOpen] = useState<string | null>(null)

  // Clicking a deck in the scene is a request to see its choices, and on a
  // phone they are behind a shut sheet. Adjusted during render rather than in an
  // effect, so the sheet is never painted closed and then flipped open.
  if (vm.openKey !== null && vm.openKey !== seenOpen) {
    setSeenOpen(vm.openKey)
    if (seenOpen !== null) setExpanded(true)
  }

  if (!vm.isPanelOpen) return null

  const openSpot = vm.spots.find((spot) => spot.open)

  return (
    <>
      <Show when={expanded}>
        <SceneOverlay corner="bottom-sheet" z="panel" className="top-0 desktop:hidden">
          <button
            type="button"
            aria-label="Close the exterior options"
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
            <DoorOpen size={18} className="shrink-0" />
            <span className="flex-1 truncate text-base font-medium">
              Entrances
              <span className="font-normal text-muted-foreground">
                {' · '}
                {openSpot?.chosen.title}
              </span>
            </span>
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
            <PanelBody vm={vm} />
          </div>
        </Card>
      </SceneOverlay>

      <aside
        style={{ zIndex: OVERLAY_Z.bar }}
        className="absolute top-0 right-0 hidden h-full w-[22rem] flex-col border-l border-border bg-background/95 backdrop-blur desktop:flex lg:w-[26rem]"
      >
        <header className="flex items-baseline justify-between gap-2 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg leading-normal font-medium">Entrances</h2>
            <Eyebrow className="truncate">Decks, stairs and ramps</Eyebrow>
          </div>
          <Eyebrow className="shrink-0">
            {vm.spots.length} {vm.spots.length === 1 ? 'spot' : 'spots'}
          </Eyebrow>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <PanelBody vm={vm} />
        </div>
      </aside>
    </>
  )
}

function PanelBody({ vm }: { vm: ExteriorVm }) {
  return (
    <For each={vm.spots} getKey={(spot) => spot.slot.key}>
      {(spot) => (
        <SpotAccordion spot={spot} onOpen={() => vm.onOpenSlot(spot.slot.key)}>
          <div className="grid grid-cols-2 gap-card">
            <For each={spot.slot.variants} getKey={(variant) => variant.key}>
              {(variant) => (
                <VariantTile
                  variant={variant}
                  chosen={variant.key === spot.chosen.key}
                  onPick={() => vm.onPickVariant(spot.slot.key, variant.key)}
                />
              )}
            </For>
          </div>
        </SpotAccordion>
      )}
    </For>
  )
}

/**
 * One spot's choices, behind its name.
 *
 * Only one spot is open at a time — with several entrances the whole panel would
 * otherwise be a wall of pictures — and the header of the open one is not a
 * close button: shutting the last one would leave a panel with nothing in it.
 */
function SpotAccordion({
  spot,
  onOpen,
  children,
}: {
  spot: ExteriorSpotVm
  onOpen: () => void
  children: React.ReactNode
}) {
  return (
    <section className="mb-block border-b border-border pb-block last:mb-0 last:border-0 last:pb-0">
      <button
        type="button"
        aria-expanded={spot.open}
        onClick={onOpen}
        className={cn(
          'mb-card flex w-full items-center gap-2 text-left transition-colors',
          // Lit while the pointer is on the deck out in the scene, so the two
          // halves of the same click target say they belong together.
          spot.hovered && !spot.open && 'text-ring',
        )}
      >
        <span className="flex-1 truncate text-sm font-medium">{spot.slot.name}</span>
        <Show when={!spot.open}>
          <span className="truncate text-xs text-muted-foreground">{spot.chosen.title}</span>
        </Show>
        <ChevronDown
          size={16}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform',
            !spot.open && '-rotate-90',
          )}
        />
      </button>
      <div className={cn(!spot.open && 'hidden')}>{children}</div>
    </section>
  )
}

function VariantTile({
  variant,
  chosen,
  onPick,
}: {
  variant: ExteriorVariant
  chosen: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={chosen}
      className={cn(
        'group flex flex-col overflow-hidden rounded-sm border text-left transition-colors',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        chosen ? 'border-primary bg-secondary' : 'border-border hover:border-primary/40',
      )}
    >
      <span className="relative block aspect-4/3 w-full overflow-hidden bg-secondary">
        <Show
          when={variant.thumbnailUrl}
          fallback={
            <span className="flex size-full items-center justify-center text-muted-foreground">
              <DoorOpen size={22} />
            </span>
          }
        >
          {(url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
        </Show>
        <Show when={chosen}>
          <Chip tone="ink" size="xs" className="absolute top-2 right-2">
            <Check size={12} />
          </Chip>
        </Show>
      </span>

      <span className="flex flex-col gap-0.5 px-3 py-2">
        <span className="truncate text-sm font-medium">{variant.title}</span>
        <Show when={variant.price !== null}>
          <span className="text-xs text-muted-foreground">
            ${variant.price?.toLocaleString('en-US')}
          </span>
        </Show>
      </span>
    </button>
  )
}
