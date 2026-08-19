'use client'

import { TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'

import type { BuildingScene } from '@/entities/building'
import { useConfiguration, type PlacedPackage } from '@/entities/configuration'
import { useConfiguratorSession } from '@/entities/configurator-session'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
import { ExteriorSlots } from '@/features/exterior-options'
import { OrderSummary, StaticPlacements } from '@/features/order-view'
import { SceneViewer } from '@/features/scene-viewer'
import { withModule, type AreaUnit } from '@/shared/lib'
import { Callout, CenteredPanel } from '@/shared/ui/boxx'

import type { SavedOrder } from '../api/get-order'
import { OrderHeader } from './OrderHeader'

type Props = {
  building: BuildingScene
  packages: FurniturePackageEntity[]
  order: SavedOrder
  placed: PlacedPackage[]
  exterior: Record<string, string>
  /** Ordered packages the catalogue no longer has, so they cannot be drawn. */
  missingCount: number
  defaultAreaUnit: AreaUnit
}

type SceneProps = Pick<Props, 'building' | 'packages'>

function Scene({ building, packages }: SceneProps) {
  return (
    <SceneViewer building={building} readOnly>
      <StaticPlacements building={building} packages={packages} />
      <ExteriorSlots building={building} readOnly />
    </SceneViewer>
  )
}

// R3F re-throws in-canvas errors out to the DOM tree; without this boundary one
// unreachable asset blanks the whole page.
const SafeSceneViewer = withModule(Scene, {
  errorFallback: (
    <CenteredPanel>
      <Callout
        tone="danger"
        align="center"
        icon={<TriangleAlert />}
        title="The 3D view could not be loaded"
        className="max-w-md"
      >
        Please refresh the page — the order itself is safe.
      </Callout>
    </CenteredPanel>
  ),
})

/**
 * Puts the saved order into the stores the scene reads, and puts back whatever
 * was in them before.
 *
 * The scene does not take its furniture as a prop. `BuildingModel` decides which
 * parts of the building's own glb to reveal from `useConfiguration.exterior`,
 * and `SceneViewer` arms the shadow map off `useConfiguration.placed` — so a
 * page that passed the order around as props would draw somebody's ordered ramp
 * as the default one and cast no shadows under their furniture.
 *
 * Those stores are module-level and outlive the page, and `/order/…` is
 * reachable from `/configurator` without a page load: the thank-you page a
 * finished request lands on links straight into the 3D view of it. So a visitor
 * can be a Back press away from a session they were in the middle of. Emptying
 * the store on the way out is not enough to be polite about that — it is what
 * loses the session, and `clear()` leaves `buildingId` behind, so the
 * configurator's own guard sees no change and never re-seeds. The order is
 * therefore laid over what was there and lifted off again, which leaves a
 * configuration in progress exactly as it was found.
 */
function useSavedOrder(buildingId: number, placed: PlacedPackage[], exterior: Record<string, string>) {
  useEffect(() => {
    const before = useConfiguration.getState()
    const displaced = {
      buildingId: before.buildingId,
      placed: before.placed,
      exterior: before.exterior,
    }

    useConfiguration.getState().hydrate({ buildingId, placed, exterior })
    useConfiguratorSession.getState().reset()

    return () => {
      useConfiguration.getState().hydrate(displaced)
      // The room the order was last looked at from is not a room the
      // configurator was ever in, so the view goes back to its opening pose too.
      useConfiguratorSession.getState().reset()
    }
  }, [buildingId, placed, exterior])
}

export function OrderScreen({
  building,
  packages,
  order,
  placed,
  exterior,
  missingCount,
  defaultAreaUnit,
}: Props) {
  useSavedOrder(building.id, placed, exterior)

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <SafeSceneViewer building={building} packages={packages} />

      <OrderHeader building={building} defaultAreaUnit={defaultAreaUnit} />

      <OrderSummary
        building={building}
        reference={order.reference}
        submittedAt={order.submittedAt}
        packages={order.packages}
        exterior={order.exterior}
        totalPrice={order.totalPrice}
        missingCount={missingCount}
      />
    </main>
  )
}
