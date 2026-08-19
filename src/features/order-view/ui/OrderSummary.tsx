'use client'

import { ChevronDown, FileText, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { BuildingScene } from '@/entities/building'
import { groupByPlace, placeKeyOf, placesOf, type StoredQuoteExterior } from '@/entities/quote'
import { cn } from '@/shared/lib'
import { Callout, Card, Eyebrow, Pill, SceneOverlay } from '@/shared/ui/boxx'
import { For, Show } from '@/shared/ui/control-flow'

export type OrderSummaryLine = {
  packageId: number
  title: string
  roomKey: string
  zoneKey: string | null
  price: number | null
}

type Props = {
  building: BuildingScene
  reference: string
  submittedAt: string | null
  packages: OrderSummaryLine[]
  exterior: StoredQuoteExterior[]
  totalPrice: number
  /** How many ordered packages the catalogue no longer has, so they are missing from the scene. */
  missingCount: number
}

/**
 * One locale and one time zone, named rather than inherited.
 *
 * This panel is drawn on the server first and then again in the browser, and
 * the two share neither a locale nor a clock. Left to `toLocaleDateString()` the
 * same order reads "19/08/2026" on one side and "8/19/2026" on the other, which
 * is a hydration mismatch — and in the wrong time zone it is the day before.
 * Prices have the same problem more quietly, in the thousands separator. The
 * rest of the app already pins `en-US` for exactly this reason.
 */
const MONEY = new Intl.NumberFormat('en-US')
const DAY = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

/** The order's own date, or nothing when it was never stored or cannot be read. */
function submittedLabel(value: string | null): string | null {
  if (!value) return null
  const at = new Date(value)
  return Number.isNaN(at.getTime()) ? null : DAY.format(at)
}

/**
 * What was ordered, beside the building it was ordered for.
 *
 * The same list the customer approved in the quote dialog, grouped the same way
 * — by room, and by half of a room where one is divided — because an order that
 * reads differently from the quote that made it invites the question of which
 * one is the order.
 *
 * Collapsed to a pill on a phone, where the panel would otherwise cover the
 * building it is describing.
 */
export function OrderSummary({
  building,
  reference,
  submittedAt,
  packages,
  exterior,
  totalPrice,
  missingCount,
}: Props) {
  const [open, setOpen] = useState(false)

  const byRoom = useMemo(
    () =>
      groupByPlace(
        packages.map((line) => ({ ...line, placeKey: placeKeyOf(line.roomKey, line.zoneKey) })),
        placesOf(building.rooms),
      ),
    [packages, building.rooms],
  )

  // A catalogue with no prices in it should not be summarised with a total of
  // zero, which reads as free rather than as unpriced.
  const hasPrices =
    packages.some((line) => line.price !== null) || exterior.some((spot) => spot.price !== null)

  const date = submittedLabel(submittedAt)

  return (
    <SceneOverlay corner="top-right" z="quote" className="pt-2">
      <div className="pointer-events-none flex max-w-[min(21rem,calc(100vw-2rem))] flex-col items-end gap-2">
        <Pill
          variant={open ? 'primary' : 'secondary'}
          labelFrom="desktop"
          aria-expanded={open}
          leadingIcon={<FileText size={16} />}
          onClick={() => setOpen((up) => !up)}
          className="pointer-events-auto shadow-xl shadow-ink/15 desktop:hidden"
        >
          Order {reference}
        </Pill>

        <Card
          tone="cream"
          radius="panel"
          elevation="float"
          hairline
          pad="sm"
          className={cn(
            'pointer-events-auto w-[min(21rem,100%)]',
            'max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain',
            'hidden desktop:block',
            open && 'block',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Eyebrow as="h2">Order {reference}</Eyebrow>
              <p className="truncate text-base leading-normal font-medium">{building.title}</p>
              <Show when={date}>
                {(day) => <p className="text-xs text-muted-foreground">Submitted {day}</p>}
              </Show>
            </div>
            <Pill
              variant="ghost"
              size="sm"
              aria-label="Hide the order"
              className="desktop:hidden"
              leadingIcon={<ChevronDown size={16} />}
              onClick={() => setOpen(false)}
            />
          </div>

          <For each={byRoom} getKey={(room) => room.key}>
            {(room) => (
              <div className="mt-3">
                <Eyebrow as="h3">{room.name}</Eyebrow>
                <For each={room.packages} getKey={(line, index) => `${line.packageId}-${index}`}>
                  {(line) => (
                    <div className="mt-1 flex justify-between gap-4 text-sm">
                      <span>{line.title}</span>
                      <Show when={line.price}>
                        {(price) => (
                          <span className="shrink-0 text-muted-foreground">
                            ${MONEY.format(price)}
                          </span>
                        )}
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            )}
          </For>

          <Show when={exterior.length > 0}>
            <div className="mt-3">
              <Eyebrow as="h3">Entrances</Eyebrow>
              <For each={exterior} getKey={(spot) => spot.slotKey}>
                {(spot) => (
                  <div className="mt-1 flex justify-between gap-4 text-sm">
                    <span>
                      {spot.slotName}
                      <span className="text-muted-foreground">{' · '}</span>
                      {spot.title}
                    </span>
                    <Show when={spot.price}>
                      {(price) => (
                        <span className="shrink-0 text-muted-foreground">
                          ${MONEY.format(price)}
                        </span>
                      )}
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* A total of $0 reads as free rather than as unpriced. */}
          <Show when={hasPrices}>
            <div className="mt-3 flex justify-between gap-4 border-t pt-3 text-base font-medium">
              <span>Total</span>
              <span className="shrink-0">${MONEY.format(totalPrice)}</span>
            </div>
          </Show>

          {/* Said out loud rather than left as a gap in the picture: the list
              above is the order, and the scene is only as complete as the
              catalogue it is drawn from still is. */}
          <Show when={missingCount > 0}>
            <Callout tone="notice" icon={<TriangleAlert />} className="mt-3 gap-3 p-3 text-sm">
              {missingCount === 1
                ? 'One item has since left the catalogue and is not shown in the 3D view.'
                : `${missingCount} items have since left the catalogue and are not shown in the 3D view.`}
            </Callout>
          </Show>
        </Card>
      </div>
    </SceneOverlay>
  )
}
