'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import type { BuildingScene } from '@/entities/building'
import { selectedVariant, zoneAt } from '@/entities/building'
import { useConfiguration } from '@/entities/configuration'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
import {
  groupByPlace,
  placeKeyOf,
  placesOf,
  quoteContactSchema,
  type QuoteConfiguration,
  type QuoteContact,
} from '@/entities/quote'

import type { SuccessCopy } from '@/modules/shared/order-success'

import { submitQuote } from '../api/submit-quote'
import { navigateTop } from '../lib/navigate-top'
import { successTarget, type SuccessTarget } from '../lib/success-target'


export type IntegrationOptions = {
  enablePostMessage: boolean
  targetOrigin: string
  /** Where a finished request goes, or null for our own thank-you page. */
  successRedirectUrl: string | null
  success: SuccessCopy
}

type Args = {
  building: BuildingScene
  packages: FurniturePackageEntity[]
  integration: IntegrationOptions
}

type SubmitState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | {
      phase: 'success'
      quoteId: number
      reference: string
      /** Where the visitor is on their way to, so the dialog can offer the link by hand. */
      target: SuccessTarget
    }
  | { phase: 'error'; message: string }

export function useQuoteSummaryModel({ building, packages, integration }: Args) {
  const router = useRouter()
  const placed = useConfiguration((s) => s.placed)
  const exterior = useConfiguration((s) => s.exterior)
  const [submitState, setSubmitState] = useState<SubmitState>({ phase: 'idle' })

  const packagesById = useMemo(() => new Map(packages.map((p) => [p.id, p])), [packages])

  const roomsByKey = useMemo(
    () => new Map(building.rooms.map((room) => [room.key, room])),
    [building.rooms],
  )

  // The zone is worked out from where the thing stands rather than stored with
  // it, so a piece dragged across an open boundary is quoted under the half it
  // ended up in — which is the half the customer will get it in.
  const quotePackages = useMemo(() => {
    // A group is one purchase however many pieces it left in the room, so only
    // the first piece of each writes a line. The line is filed where that piece
    // stands: the pieces move independently once they are down, and picking one
    // of them beats inventing a middle that nothing is actually at.
    const counted = new Set<string>()

    return placed.flatMap((placement) => {
      const pkg = packagesById.get(placement.packageId)
      if (!pkg) return []

      if (placement.groupId) {
        if (counted.has(placement.groupId)) return []
        counted.add(placement.groupId)
      }

      // Every piece of the group, so reopening the order puts the arrangement
      // back rather than one table where a dining set used to be.
      const pieces = placement.groupId
        ? placed.flatMap((piece) =>
            piece.groupId === placement.groupId && piece.memberKey
              ? [
                  {
                    memberKey: piece.memberKey,
                    x: piece.x,
                    z: piece.z,
                    rotationYDeg: piece.rotationYDeg,
                  },
                ]
              : [],
          )
        : undefined

      const room = roomsByKey.get(placement.roomKey) ?? null
      const zone = room ? zoneAt(room, placement.x, placement.z) : null

      return [
        {
          packageId: pkg.id,
          title: pkg.title,
          roomKey: placement.roomKey,
          zoneKey: zone?.key ?? null,
          zoneName: zone?.name ?? null,
          placeKey: placeKeyOf(placement.roomKey, zone?.key ?? null),
          price: pkg.price,
          x: placement.x,
          z: placement.z,
          rotationYDeg: placement.rotationYDeg,
          ...(pieces ? { pieces } : {}),
        },
      ]
    })
  }, [placed, packagesById, roomsByKey])

  // One line per spot that offers a choice — a spot with a single entry is part
  // of the building rather than something the customer picked.
  const quoteExterior = useMemo(
    () =>
      building.exteriorSlots.flatMap((slot) => {
        if (slot.variants.length < 2) return []
        const variant = selectedVariant(slot, exterior)
        if (!variant) return []

        return [
          {
            slotKey: slot.key,
            slotName: slot.name,
            variantKey: variant.key,
            title: variant.title,
            price: variant.price,
          },
        ]
      }),
    [building.exteriorSlots, exterior],
  )

  const totalPrice = useMemo(
    () =>
      quotePackages.reduce((sum, p) => sum + (p.price ?? 0), 0) +
      quoteExterior.reduce((sum, e) => sum + (e.price ?? 0), 0),
    [quotePackages, quoteExterior],
  )

  // A catalogue with no prices in it should not be summarised with a total of
  // zero, which reads as free rather than as unpriced.
  const hasPrices = useMemo(
    () =>
      quotePackages.some((p) => p.price !== null && p.price !== undefined) ||
      quoteExterior.some((e) => e.price !== null),
    [quotePackages, quoteExterior],
  )

  const packagesByRoom = useMemo(
    () => groupByPlace(quotePackages, placesOf(building.rooms)),
    [quotePackages, building.rooms],
  )

  const buildConfiguration = (): QuoteConfiguration => ({
    buildingModelId: building.id,
    buildingTitle: building.title,
    lineSlug: building.line.slug,
    unitCount: building.unitCount,
    restroomCount: building.restroomCount,
    packages: quotePackages,
    exterior: quoteExterior,
    totalPrice,
    submittedAt: new Date().toISOString(),
  })

  const submit = async (contact: QuoteContact) => {
    const contactCheck = quoteContactSchema.safeParse(contact)

    if (!contactCheck.success) {
      setSubmitState({
        phase: 'error',
        message: contactCheck.error.issues[0]?.message ?? 'Invalid contact details.',
      })
      return
    }

    setSubmitState({ phase: 'submitting' })

    const configuration = buildConfiguration()
    const result = await submitQuote({ contact: contactCheck.data, configuration })

    if (!result.ok) {
      setSubmitState({ phase: 'error', message: result.error })
      return
    }

    // First, and unchanged: this is the host page's documented contract, and it
    // has to go out whatever we do about navigating afterwards.
    if (integration.enablePostMessage && window.parent !== window) {
      window.parent.postMessage(
        { type: 'configurator:quote-submitted', quoteId: result.data.quoteId, configuration },
        integration.targetOrigin || '*',
      )
    }

    const { quoteId, reference } = result.data
    const target = successTarget(integration.successRedirectUrl, reference)

    // Set before navigating, not instead of it: the dialog shows the same
    // confirmation underneath, so a redirect the browser refuses — no user
    // activation left after the await, a sandboxed frame — leaves the visitor
    // with the answer and a link rather than with a dialog that did nothing.
    setSubmitState({ phase: 'success', quoteId, reference, target })

    if (target.kind === 'internal') {
      // Same origin, so this stays inside the host's iframe, which is right for
      // a page that is still part of the configurator.
      router.push(target.href)
      return
    }

    // A host page can move itself better than we can move it, so it is asked
    // first; `navigateTop` is what happens when nobody is listening.
    if (integration.enablePostMessage && window.parent !== window) {
      window.parent.postMessage(
        { type: 'configurator:redirect', url: target.href },
        integration.targetOrigin || '*',
      )
    }

    navigateTop(target.href)
  }

  return {
    buildingTitle: building.title,
    quotePackages,
    quoteExterior,
    packagesByRoom,
    hasPrices,
    totalPrice,
    submitState,
    onSubmit: submit,
    onResetSubmit: () => setSubmitState({ phase: 'idle' }),
  }
}

export type QuoteSummaryVm = ReturnType<typeof useQuoteSummaryModel>
