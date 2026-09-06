'use client'

import { Check, ChevronDown, Info, Plus, Replace, Sofa, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import type { BuildingScene } from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
import { cn } from '@/shared/lib'
import { Callout, Card, Chip, Eyebrow, MediaTile, SceneOverlay, SidePanel } from '@/shared/ui/boxx'
import { For, Show } from '@/shared/ui/control-flow'

import { ModelThumbnailFactory, useModelThumbnail } from '../lib/model-thumbnails'
import {
  usePackagePlacementModel,
  type FittedOffer,
  type FloorSection,
  type PackageOffer,
  type PackagePlacementVm,
  type PlacedItem,
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
  const collapsed = useConfiguratorSession((s) => s.panelCollapsed)
  const setCollapsed = useConfiguratorSession((s) => s.setPanelCollapsed)
  const setActiveZone = useConfiguratorSession((s) => s.setActiveZone)
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

  const handleAdd = (offer: PackageOffer, zoneKey: string | null) => {
    setAddError(null)
    const added = vm.onAddPackage(offer.pkg, zoneKey)

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
      <ModelThumbnailFactory
        urls={vm.offers.flatMap((offer) => {
          if (offer.pkg.modelUrl) return [offer.pkg.modelUrl]
          // A group's tile is drawn from its first piece, so that is the one
          // this has to have; the rest are warmed for the room, not for here.
          const first = offer.pkg.members[0]?.modelUrl
          return first ? [first] : []
        })}
      />

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
                <span className="font-normal text-muted-foreground">
                  {' · '}
                  {vm.activeZone?.name ?? vm.focusedRoom?.name}
                </span>
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

        <SidePanel
          icon={<Sofa size={18} />}
          title="Furniture"
          subtitle={vm.activeZone?.name ?? vm.focusedRoom?.name}
          meta={`${vm.offers.length} ${vm.offers.length === 1 ? 'item' : 'items'}`}
          // What is standing in the room, not what is on offer for it: shut, the
          // useful thing to know is how far the room has been furnished.
          badge={vm.placedInFocusedRoom.length || null}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          // The halves of a divided room, in their own floor tints — the same
          // choice the bar in the scene offers, kept reachable while the panel is
          // shut. An undivided room has no halves and so no rail beyond its mark.
          rail={(vm.focusedRoom?.zones ?? []).map((zone) => ({
            key: zone.key,
            icon: (
              <span
                aria-hidden
                className="size-3 rounded-full ring-2 ring-background"
                style={{ background: zone.color }}
              />
            ),
            label: zone.name,
            active: vm.activeZone?.key === zone.key,
            onSelect: () => {
              setActiveZone(zone.key)
              setCollapsed(false)
            },
          }))}
        >
          <PanelBody vm={vm} addError={addError} onAdd={handleAdd} />
        </SidePanel>
      </Show>
    </>
  )
}

type BodyProps = {
  vm: PackagePlacementVm
  addError: string | null
  onAdd: (offer: PackageOffer, zoneKey: string | null) => void
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

      <For each={vm.sections} getKey={(section) => section.key}>
        {(section) => (
          <Show
            when={vm.isSplit}
            fallback={<SectionBody vm={vm} section={section} onAdd={onAdd} />}
          >
            <ZoneAccordion section={section}>
              <SectionBody vm={vm} section={section} onAdd={onAdd} />
            </ZoneAccordion>
          </Show>
        )}
      </For>
    </>
  )
}

/**
 * One zone's furniture, behind its own name.
 *
 * Open by default: a visitor looking at the whole of a divided room is being
 * shown two catalogues, and two shut drawers say less than no drawers at all.
 */
function ZoneAccordion({ section, children }: { section: FloorSection; children: ReactNode }) {
  const [open, setOpen] = useState(true)

  return (
    <section className="mb-block border-b border-border pb-block last:mb-0 last:border-0 last:pb-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="mb-card flex w-full items-center gap-2 text-left"
      >
        {/* Same tint as the floor of the half it stands for — the only thing
            tying this list to a place in the room. */}
        <Show when={section.color}>
          {(color) => (
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: color }}
            />
          )}
        </Show>
        <span className="flex-1 truncate text-sm font-medium">{section.name}</span>
        <Show when={section.placed.length > 0}>
          <Chip tone="ink" size="sm">
            {section.placed.length}
          </Chip>
        </Show>
        <ChevronDown
          size={16}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform',
            !open && '-rotate-90',
          )}
        />
      </button>
      <div className={cn(!open && 'hidden')}>{children}</div>
    </section>
  )
}

/** What a row is called: the set it came with, then the piece inside it. */
function label(item: PlacedItem): string {
  const piece = item.pkg?.title ?? 'Package'
  if (!item.group || item.group.title === piece) return piece
  return `${item.group.title} · ${piece}`
}

/** Whether this row carries the bin: always, unless earlier kin already does. */
function ownsTheBin(rows: PlacedItem[], item: PlacedItem, index: number): boolean {
  if (!item.groupId) return true
  return rows.findIndex((row) => row.groupId === item.groupId) === index
}

function removeLabel(item: PlacedItem, rows: PlacedItem[]): string {
  if (!item.groupId) return `Remove ${item.pkg?.title ?? 'package'}`

  const pieces = rows.filter((row) => row.groupId === item.groupId).length
  return `Remove ${item.group?.title ?? 'the set'} and its ${pieces} pieces`
}

function SectionBody({
  vm,
  section,
  onAdd,
}: {
  vm: PackagePlacementVm
  section: FloorSection
  onAdd: (offer: PackageOffer, zoneKey: string | null) => void
}) {
  const zoneKey = section.zone?.key ?? null
  const where = section.zone ? section.name : 'this room'
  /** Whether the first block has anything to head, of either kind. */
  const leads = section.groups.recommended.length > 0 || section.fitted.length > 0

  return (
    <>
      {/* Two blocks only when there is something in the first: a catalogue with
          nothing named for this room would otherwise grow a heading that says
          the same as no heading at all. An arrangement counts as something —
          it is offered for this room as much as a recommended chair is. */}
      <Show when={leads}>
        <Eyebrow as="h3" className="mb-card">
          Recommended for {where}
        </Eyebrow>
        <OfferGrid
          offers={section.groups.recommended}
          fitted={section.fitted}
          onAdd={(offer) => onAdd(offer, zoneKey)}
          onPutFitted={(entry) => vm.onPutFitted(entry.set)}
        />
        <Show when={section.groups.other.length > 0}>
          <Eyebrow as="h3" className="mt-block mb-card">
            More furniture
          </Eyebrow>
        </Show>
      </Show>

      <OfferGrid
        offers={section.groups.other}
        onAdd={(offer) => onAdd(offer, zoneKey)}
        empty={!leads}
      />

      <Show when={section.placed.length > 0}>
        <Eyebrow as="h3" className="mt-block mb-card">
          In {where}
        </Eyebrow>
        <ul className="flex flex-col gap-card">
          <For each={section.placed} getKey={(p) => p.instanceId}>
            {(placedItem, index) => (
              <Card
                as="li"
                tone="cream"
                radius="card"
                elevation="none"
                className={cn(
                  'flex items-center justify-between gap-2 py-1 pr-1 pl-1',
                  vm.selectedInstanceId === placedItem.instanceId && 'ring-1 ring-primary',
                )}
              >
                {/* The way into a piece the pointer can no longer reach — one
                    pushed under a desk is behind it from every angle. Selecting
                    raises the floating toolbar, which is drawn over the scene,
                    so it can still be turned and removed from there.

                    And the panel gets out of the way, because on a phone it is
                    a sheet over the scene: the toolbar it just raised would be
                    behind the very list that raised it. */}
                {/* A fitted arrangement is a label, not a button: selecting it
                    raises a toolbar offering to turn and move it, and it is the
                    one thing that does neither. No badge saying so — it is
                    furniture standing in the room like the rest of the list,
                    and naming the mechanism would be talking about ourselves.
                    Removing it is the same button as for a chair. */}
                <Show
                  when={!placedItem.pinned}
                  fallback={
                    <span className="min-w-0 flex-1 truncate px-2 py-2 text-sm">
                      {label(placedItem)}
                    </span>
                  }
                >
                  <button
                    type="button"
                    onClick={() => {
                      vm.onSelectPackage(placedItem.instanceId)
                      useConfiguratorSession.getState().setPanelCollapsed(true)
                    }}
                    aria-pressed={vm.selectedInstanceId === placedItem.instanceId}
                    className="min-w-0 flex-1 truncate rounded-full px-2 py-2 text-left text-sm transition-colors hover:bg-ink/5 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {label(placedItem)}
                  </button>
                </Show>
                {/* One bin per group, on the piece that opens it. Every piece
                    still has its own row, because a chair pushed under a desk is
                    behind it from every angle and this list is the way back to
                    it — but the group came in as one thing and goes out as one,
                    and four bins that each empty the whole set is four ways to
                    be surprised. */}
                <Show when={ownsTheBin(section.placed, placedItem, index)}>
                  <button
                    type="button"
                    onClick={() => vm.onRemovePackage(placedItem.instanceId)}
                    aria-label={removeLabel(placedItem, section.placed)}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Trash2 size={16} />
                  </button>
                </Show>
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
  fitted = [],
  onAdd,
  onPutFitted,
  empty = false,
}: {
  offers: PackageOffer[]
  /** Arrangements, shown among the rest — they are furniture, not a category. */
  fitted?: FittedOffer[]
  onAdd: (offer: PackageOffer) => void
  onPutFitted?: (fitted: FittedOffer) => void
  empty?: boolean
}) {
  if (offers.length === 0 && fitted.length === 0 && !empty) return null

  return (
    <div className="grid grid-cols-2 gap-card">
      {/* First in the grid, not in a grid of their own: a kitchen is the
          largest thing in the room and the one the rest is furnished around,
          but it is still something the visitor picks off the same shelf. */}
      <For each={fitted} getKey={(entry) => entry.set.key}>
        {(entry) => <FittedTile fitted={entry} onPut={() => onPutFitted?.(entry)} />}
      </For>
      <For
        each={offers}
        getKey={(offer) => offer.pkg.id}
        fallback={
          fitted.length > 0 ? null : (
            <Callout tone="notice" align="center" className="col-span-full p-4">
              Nothing available for this kind of room yet.
            </Callout>
          )
        }
      >
        {(offer) => <OfferTile offer={offer} onAdd={() => onAdd(offer)} />}
      </For>
    </div>
  )
}

/**
 * One arrangement on offer, and what pressing it does.
 *
 * The ordinary tile with three differences and nothing else, because for the
 * visitor this is furniture. It never fails to fit — there is no fit test to
 * fail, the building already decided where it goes. Its action is a swap once
 * something else is standing, because a room has one kitchen and asking someone
 * to delete the old one first would be asking them to do the obvious by hand.
 * And the one already standing says so and does nothing.
 */
function FittedTile({ fitted, onPut }: { fitted: FittedOffer; onPut: () => void }) {
  const { pkg, standing } = fitted
  // Its own model is the picture of the whole arrangement, when there is one.
  // A kitchen usually has an admin photograph instead, which is better.
  const rendered = useModelThumbnail(pkg.modelUrl ?? null)

  return (
    <MediaTile
      src={pkg.thumbnailUrl ?? rendered}
      fit={pkg.thumbnailUrl ? 'cover' : 'contain'}
      plate="cream"
      title={pkg.title}
      meta={pkg.price === null ? null : `$${pkg.price.toLocaleString('en-US')}`}
      badge={
        standing ? (
          <Chip tone="success" size="xs">
            In the room
          </Chip>
        ) : pkg.tier === null ? null : (
          <Chip tone="glass" size="xs">
            {pkg.tier}
          </Chip>
        )
      }
      // Pressing the one already standing is a no-op rather than a refusal: the
      // tile is not disabled, because dimming the arrangement the visitor has
      // chosen would read as "unavailable" — the opposite of what is true.
      onSelect={onPut}
      action={{
        icon: standing ? <Check size={20} /> : <Replace size={20} />,
        label: standing
          ? `${pkg.title} is already fitted here`
          : `Fit ${pkg.title} in the room`,
        onClick: onPut,
      }}
    />
  )
}

type OfferTileProps = {
  offer: PackageOffer
  onAdd: () => void
}

// A component per offer: the thumbnail subscription is a hook and the list length varies.
function OfferTile({ offer, onAdd }: OfferTileProps) {
  const { pkg, fits } = offer
  // A group has no model of its own, so the first piece stands for it — better
  // than an empty tile, and an admin who wants the whole arrangement in the
  // picture uploads a thumbnail, which wins over either.
  const rendered = useModelThumbnail(pkg.modelUrl ?? pkg.members[0]?.modelUrl ?? null)

  return (
    <MediaTile
      src={pkg.thumbnailUrl ?? rendered}
      fit={pkg.thumbnailUrl ? 'cover' : 'contain'}
      plate="cream"
      title={pkg.title}
      meta={pkg.price === null ? null : `$${pkg.price.toLocaleString('en-US')}`}
      // Only when there is a grade to name. It used to read "office · core",
      // where the first half repeated what the room it was being offered in
      // already said.
      badge={
        pkg.tier === null ? null : (
          <Chip tone="glass" size="xs">
            {pkg.tier}
          </Chip>
        )
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
