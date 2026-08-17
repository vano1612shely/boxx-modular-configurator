'use client'

import { TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'

import type { BuildingScene } from '@/entities/building'
import { useConfiguration } from '@/entities/configuration'
import { useConfiguratorSession } from '@/entities/configurator-session'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
import type { IntakeAnswers } from '@/features/building-intake'
import { ExteriorPanel, ExteriorSlots } from '@/features/exterior-options'
import type { AreaUnit } from '@/shared/lib'
import { PackagePanel, PlacedPackages } from '@/features/package-placement'
import { QuoteDialog, type IntegrationOptions } from '@/features/quote-summary'
import { SceneViewer } from '@/features/scene-viewer'
import { withModule } from '@/shared/lib'
import { Callout, CenteredPanel } from '@/shared/ui/boxx'

import { dropSelectionOnMove } from '../lib/drop-selection-on-move'
import { ConfiguratorHeader } from './ConfiguratorHeader'

type Props = {
  building: BuildingScene
  packages: FurniturePackageEntity[]
  integration: IntegrationOptions
  region?: string
  /** What the visitor asked the quiz for, so they can come back and change it. */
  answers: IntakeAnswers
  /** The admin's unit for floor areas; the visitor may override it for the session. */
  defaultAreaUnit: AreaUnit
}

type SceneProps = Pick<Props, 'building' | 'packages'>

function Scene({ building, packages }: SceneProps) {
  return (
    <SceneViewer building={building}>
      <PlacedPackages building={building} packages={packages} />
      <ExteriorSlots building={building} />
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
        Please refresh the page — your configuration is kept.
      </Callout>
    </CenteredPanel>
  ),
})

/**
 * Empties both stores when the visitor arrives at a different building.
 *
 * The module-level stores outlive the page: "Change selection" goes back to the
 * quiz and returns here, so this component is unmounted and mounted again while
 * they keep everything in them. It used to remember the building in a ref, which
 * a fresh mount initialises to whatever building it is now looking at — so the
 * switch it existed to catch was the one case it could not see.
 *
 * The store is asked instead. It knows which building its contents were chosen
 * for, and an incidental re-resolution of the same one still costs nothing.
 */
function useResetOnBuildingChange(buildingId: number) {
  useEffect(() => {
    if (useConfiguration.getState().buildingId === buildingId) return
    useConfiguration.getState().adoptBuilding(buildingId)
    useConfiguratorSession.getState().reset()
  }, [buildingId])
}

export function ConfiguratorScreen({
  building,
  packages,
  integration,
  region,
  answers,
  defaultAreaUnit,
}: Props) {
  useResetOnBuildingChange(building.id)
  // A piece stays picked up only while the visitor is still looking at it.
  useEffect(dropSelectionOnMove, [])

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <SafeSceneViewer building={building} packages={packages} />

      <ConfiguratorHeader
        building={building}
        region={region}
        answers={answers}
        defaultAreaUnit={defaultAreaUnit}
      />

      <PackagePanel building={building} packages={packages} />
      <ExteriorPanel building={building} />
      <QuoteDialog building={building} packages={packages} integration={integration} />
    </main>
  )
}
