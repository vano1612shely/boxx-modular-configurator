'use client'

import { useMemo } from 'react'

import type { BuildingScene, ExteriorSlot, ExteriorVariant } from '@/entities/building'
import { selectedVariant } from '@/entities/building'
import { useConfiguration } from '@/entities/configuration'
import { useConfiguratorSession } from '@/entities/configurator-session'

export type ExteriorSpotVm = {
  slot: ExteriorSlot
  chosen: ExteriorVariant
  open: boolean
  hovered: boolean
}

/**
 * The exterior spots worth putting a picker on screen for, and what is picked.
 *
 * A spot with one choice is left out: it is part of the building rather than a
 * decision, and listing it would offer a card that does nothing. A building
 * where every spot is like that — or which has none at all — is shown exactly as
 * it was before any of this existed, with no panel.
 */
export function useExteriorModel({ building }: { building: BuildingScene }) {
  const selection = useConfiguration((s) => s.exterior)
  const setVariant = useConfiguration((s) => s.setExteriorVariant)
  const focusedRoomKey = useConfiguratorSession((s) => s.focusedRoomKey)
  const openSlotKey = useConfiguratorSession((s) => s.openSlotKey)
  const hoveredSlotKey = useConfiguratorSession((s) => s.hoveredSlotKey)
  const openSlot = useConfiguratorSession((s) => s.openExteriorSlot)

  const pickable = useMemo(
    () => building.exteriorSlots.filter((slot) => slot.variants.length > 1),
    [building.exteriorSlots],
  )

  // One is always open, and until the visitor says otherwise it is the first.
  // Derived rather than seeded through an effect, so the panel is never painted
  // with everything shut and then corrected a frame later.
  const openKey = pickable.some((slot) => slot.key === openSlotKey)
    ? openSlotKey
    : (pickable[0]?.key ?? null)

  const spots: ExteriorSpotVm[] = useMemo(
    () =>
      pickable.flatMap((slot) => {
        const chosen = selectedVariant(slot, selection)
        if (!chosen) return []

        return [
          {
            slot,
            chosen,
            open: slot.key === openKey,
            hovered: slot.key === hoveredSlotKey,
          },
        ]
      }),
    [pickable, selection, openKey, hoveredSlotKey],
  )

  return {
    spots,
    // The panel belongs to the building, the furniture panel to a room, and both
    // want the same edge of the screen.
    isPanelOpen: spots.length > 0 && focusedRoomKey === null,
    openKey,
    onOpenSlot: openSlot,
    onPickVariant: setVariant,
  }
}

export type ExteriorVm = ReturnType<typeof useExteriorModel>
