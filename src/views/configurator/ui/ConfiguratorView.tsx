import { SearchX } from 'lucide-react'

import { getBuildingScene } from '@/entities/building/api'
import { getPackagesForLine } from '@/entities/furniture-package/api'
import { changeSelectionHref, IntakeForm } from '@/features/building-intake'
import { resolveRegionScope } from '@/modules/regions/lib/scope'
import { getDefaultAreaUnit } from '@/modules/settings/lib/read-settings'
import { Callout, CenteredPanel } from '@/shared/ui/boxx'

import { getIntakeLines, getIntegrationOptions, getQuizCopy } from '../api/get-catalog'
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
  // A line's units are named for what they are: `offices` for an office line,
  // `classrooms` for a school — and a school's `offices` are the extra ones.
  // `units` is the older spelling, still honoured. Which reading `offices`
  // gets is decided once the line is known, in getBuildingScene.
  const classroomsRaw = firstParam(searchParams.classrooms)
  const officesRaw = firstParam(searchParams.offices)
  const unitsRaw = classroomsRaw ?? firstParam(searchParams.units) ?? officesRaw
  const units = unitsRaw ? Number.parseInt(unitsRaw, 10) || undefined : undefined
  const offices =
    classroomsRaw !== undefined && officesRaw !== undefined
      ? Number.parseInt(officesRaw, 10) || 0
      : undefined
  const restrooms = parseRestrooms(firstParam(searchParams.restrooms))
  // Set by the host page, e.g. ?region=us. Absent means the whole catalogue.
  const regionCode = firstParam(searchParams.region)
  const region = await resolveRegionScope(regionCode)
  // Set by the "change selection" link, which carries the answers it wants the
  // form to open on — and those look exactly like an ordinary configurator link.
  const changing = firstParam(searchParams.change) === '1'
  const answers = { line: building, units, offices, restrooms }

  if (!building || changing) {
    const [lines, copy] = await Promise.all([getIntakeLines(region), getQuizCopy()])

    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-4">
        <IntakeForm lines={lines} region={regionCode} answers={answers} copy={copy} />
      </main>
    )
  }

  const resolution = await getBuildingScene({ building, units, offices, restrooms, region })

  if (resolution.status === 'not-found') {
    const copy = await getQuizCopy()

    return (
      <CenteredPanel as="main">
        <Callout
          tone="notice"
          align="center"
          icon={<SearchX />}
          // Callout renders its title in a <p>, so the page keeps its h1 through ARIA.
          title={
            <span role="heading" aria-level={1}>
              {copy.notFound.title}
            </span>
          }
          className="max-w-md"
        >
          {copy.notFound.body}
        </Callout>
      </CenteredPanel>
    )
  }

  if (resolution.status === 'over-capacity') {
    const copy = await getQuizCopy()

    return (
      <OverCapacityScreen
        lineName={resolution.lineName}
        requestedUnits={resolution.requestedUnits}
        adjustHref={changeSelectionHref(answers, regionCode)}
        copy={copy.overCapacity}
      />
    )
  }

  const [packages, integration, defaultAreaUnit] = await Promise.all([
    getPackagesForLine(resolution.scene.line.id, region),
    getIntegrationOptions(),
    getDefaultAreaUnit(),
  ])

  return (
    <ConfiguratorScreen
      building={resolution.scene}
      packages={packages}
      integration={integration}
      region={regionCode}
      answers={answers}
      defaultAreaUnit={defaultAreaUnit}
    />
  )
}
