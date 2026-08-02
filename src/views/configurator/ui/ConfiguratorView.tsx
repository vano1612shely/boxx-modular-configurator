import { IntakeForm } from '@/features/building-intake'

import { getBuildingScene } from '../api/get-building-scene'
import { getIntakeLines, getIntegrationOptions } from '../api/get-catalog'
import { getPackagesForLine } from '../api/get-packages'
import { ConfiguratorScreen } from './ConfiguratorScreen'
import { OverCapacityScreen } from './OverCapacityScreen'

type Props = {
  searchParams: Record<string, string | string[] | undefined>
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

// Legacy links still carry the old boolean "true"/"yes", meaning one set.
function parseRestrooms(value: string | undefined): number {
  if (value === undefined) return 0
  if (value === 'true' || value === 'yes') return 1
  const count = Number.parseInt(value, 10)
  return Number.isFinite(count) && count > 0 ? count : 0
}

export async function ConfiguratorView({ searchParams }: Props) {
  const building = firstParam(searchParams.building)
  const unitsRaw = firstParam(searchParams.offices) ?? firstParam(searchParams.units)
  const units = unitsRaw ? Number.parseInt(unitsRaw, 10) || undefined : undefined
  const restrooms = parseRestrooms(firstParam(searchParams.restrooms))

  if (!building) {
    const lines = await getIntakeLines()

    return (
      <main className="flex min-h-dvh items-center justify-center bg-secondary/40 p-4">
        <IntakeForm lines={lines} />
      </main>
    )
  }

  const resolution = await getBuildingScene({ building, units, restrooms })

  if (resolution.status === 'not-found') {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-muted-foreground">
          No buildings available yet. Add one in the admin panel.
        </p>
      </main>
    )
  }

  if (resolution.status === 'over-capacity') {
    return (
      <OverCapacityScreen
        lineName={resolution.lineName}
        requestedUnits={resolution.requestedUnits}
      />
    )
  }

  const [packages, integration] = await Promise.all([
    getPackagesForLine(resolution.scene.line.id),
    getIntegrationOptions(),
  ])

  return (
    <ConfiguratorScreen
      building={resolution.scene}
      packages={packages}
      integration={integration}
    />
  )
}
