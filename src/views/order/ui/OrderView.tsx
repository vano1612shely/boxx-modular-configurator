import { getPayload } from 'payload'

import config from '@payload-config'

import { getBuildingScene, getBuildingSceneById } from '@/entities/building/api'
import { getPackagesByIds } from '@/entities/furniture-package/api'
import { getDefaultAreaUnit } from '@/modules/settings/lib/read-settings'
import { resolveSuccessCopy } from '@/modules/shared/order-success'

import { getOrder, type SavedOrder } from '../api/get-order'
import { replayExterior, replayPlacements } from '../lib/replay-configuration'
import { OrderScreen } from './OrderScreen'
import { OrderSuccessScreen } from './OrderSuccessScreen'
import { OrderUnavailableScreen } from './OrderUnavailableScreen'

type Props = {
  /** The order's reference, or — for a signed-in admin — its numeric id. */
  id: string
  /** Set by the redirect that follows a submitted request: show the thank-you page. */
  submitted: boolean
}

/**
 * The building a saved order was configured against.
 *
 * By id first, because that names the exact model the customer looked at. The
 * search underneath is for orders taken before the id was stored, and for one
 * whose model has since been deleted — it re-sizes from the line and the counts,
 * which is the same answer the customer originally got. `over-capacity` is a
 * not-found here: it is the quiz's answer to a request, and there is nothing on
 * this page to adjust.
 */
async function sceneFor(order: SavedOrder) {
  if (order.buildingModelId !== null) {
    const byId = await getBuildingSceneById(order.buildingModelId)
    if (byId.status === 'ok') return byId
  }

  if (!order.lineSlug) return { status: 'not-found' } as const

  return getBuildingScene({
    building: order.lineSlug,
    units: order.unitCount,
    restrooms: order.restroomCount,
    // No region, deliberately: an order is a record of what was ordered, and a
    // building that has since stopped being sold somewhere still has to open.
  })
}

export async function OrderView({ id, submitted }: Props) {
  const found = await getOrder(id)

  if (found.status !== 'ok') return <OrderUnavailableScreen />

  const { order } = found

  if (submitted) {
    const payload = await getPayload({ config })
    const settings = await payload.findGlobal({ slug: 'integration-settings' })

    return <OrderSuccessScreen reference={order.reference} copy={resolveSuccessCopy(settings)} />
  }

  const resolution = await sceneFor(order)

  if (resolution.status !== 'ok') return <OrderUnavailableScreen />

  const [{ packages, missing }, defaultAreaUnit] = await Promise.all([
    getPackagesByIds(order.packages.map((line) => line.packageId)),
    getDefaultAreaUnit(),
  ])

  return (
    <OrderScreen
      building={resolution.scene}
      packages={packages}
      order={order}
      placed={replayPlacements(order.packages)}
      exterior={replayExterior(order.exterior)}
      missingCount={missing.length}
      defaultAreaUnit={defaultAreaUnit}
    />
  )
}
