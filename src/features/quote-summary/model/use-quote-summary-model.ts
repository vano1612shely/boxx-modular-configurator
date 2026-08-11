'use client'

import { useMemo, useState } from 'react'

import type { BuildingScene } from '@/entities/building'
import { selectedVariant, zoneAt } from '@/entities/building'
import { useConfiguration } from '@/entities/configuration'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
import { quoteContactSchema, type QuoteConfiguration, type QuoteContact } from '@/entities/quote'

import { submitQuote } from '../api/submit-quote'
import { groupByPlace, placeKeyOf, placesOf } from '../lib/group-by-place'

export type IntegrationOptions = {
  enablePostMessage: boolean
  targetOrigin: string
}

type Args = {
  building: BuildingScene
  packages: FurniturePackageEntity[]
  integration: IntegrationOptions
}

type SubmitState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'success'; quoteId: number }
  | { phase: 'error'; message: string }

export function useQuoteSummaryModel({ building, packages, integration }: Args) {
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
  const quotePackages = useMemo(
    () =>
      placed.flatMap((placement) => {
        const pkg = packagesById.get(placement.packageId)
        if (!pkg) return []

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
          },
        ]
      }),
    [placed, packagesById, roomsByKey],
  )

  // One line per spot that offers a choice — a spot with a single entry is part
  // of the building rather than something the customer picked.
  const quoteExterior = useMemo(
    () =>
      building.exteriorSlots.flatMap((slot) => {
        if (slot.variants.length < 2) return []
        const variant = selectedVariant(slot, exterior)

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

    if (integration.enablePostMessage && window.parent !== window) {
      window.parent.postMessage(
        { type: 'configurator:quote-submitted', quoteId: result.data.quoteId, configuration },
        integration.targetOrigin || '*',
      )
    }

    setSubmitState({ phase: 'success', quoteId: result.data.quoteId })
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
