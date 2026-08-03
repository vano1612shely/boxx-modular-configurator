'use client'

import { useMemo, useState } from 'react'

import type { BuildingScene } from '@/entities/building'
import { useConfiguration } from '@/entities/configuration'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
import { quoteContactSchema, type QuoteConfiguration, type QuoteContact } from '@/entities/quote'

import { submitQuote } from '../api/submit-quote'
import { groupByRoom } from '../lib/group-by-room'

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
  const [submitState, setSubmitState] = useState<SubmitState>({ phase: 'idle' })

  const packagesById = useMemo(() => new Map(packages.map((p) => [p.id, p])), [packages])

  const quotePackages = useMemo(
    () =>
      placed.flatMap((placement) => {
        const pkg = packagesById.get(placement.packageId)
        return pkg
          ? [
              {
                packageId: pkg.id,
                title: pkg.title,
                roomKey: placement.roomKey,
                price: pkg.price,
                x: placement.x,
                z: placement.z,
                rotationYDeg: placement.rotationYDeg,
              },
            ]
          : []
      }),
    [placed, packagesById],
  )

  const totalPrice = useMemo(
    () => quotePackages.reduce((sum, p) => sum + (p.price ?? 0), 0),
    [quotePackages],
  )

  // A catalogue with no prices in it should not be summarised with a total of
  // zero, which reads as free rather than as unpriced.
  const hasPrices = useMemo(
    () => quotePackages.some((p) => p.price !== null && p.price !== undefined),
    [quotePackages],
  )

  const packagesByRoom = useMemo(
    () => groupByRoom(quotePackages, building.rooms),
    [quotePackages, building.rooms],
  )

  const buildConfiguration = (): QuoteConfiguration => ({
    buildingModelId: building.id,
    buildingTitle: building.title,
    lineSlug: building.line.slug,
    unitCount: building.unitCount,
    restroomCount: building.restroomCount,
    packages: quotePackages,
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
    packagesByRoom,
    hasPrices,
    totalPrice,
    submitState,
    onSubmit: submit,
    onResetSubmit: () => setSubmitState({ phase: 'idle' }),
  }
}

export type QuoteSummaryVm = ReturnType<typeof useQuoteSummaryModel>
