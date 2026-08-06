'use client'

import { TriangleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { BuildingScene } from '@/entities/building'
import { useConfiguration } from '@/entities/configuration'
import { useConfiguratorSession } from '@/entities/configurator-session'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
import type { IntakeAnswers } from '@/features/building-intake'
import { PackagePanel, PlacedPackages } from '@/features/package-placement'
import { QuoteDialog, type IntegrationOptions } from '@/features/quote-summary'
import { SceneViewer } from '@/features/scene-viewer'
import { withModule } from '@/shared/lib'
import { Callout, CenteredPanel } from '@/shared/ui/boxx'

import { ConfiguratorHeader } from './ConfiguratorHeader'

type Props = {
  building: BuildingScene
  packages: FurniturePackageEntity[]
  integration: IntegrationOptions
  region?: string
  /** What the visitor asked the quiz for, so they can come back and change it. */
  answers: IntakeAnswers
}

type SceneProps = Pick<Props, 'building' | 'packages'>

function Scene({ building, packages }: SceneProps) {
  return (
    <SceneViewer building={building}>
      <PlacedPackages building={building} packages={packages} />
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
 * "Change selection" is a client-side navigation, so this component keeps its
 * place in the tree and the module-level stores survive it. Furniture placed in
 * the previous building then stays in `placed` with room keys the new one does
 * not have: invisible in every room, and still counted in the quote total.
 *
 * Keyed on the id and guarded by a ref rather than a mount effect: an incidental
 * re-resolution of the same building must not throw the visitor's work away.
 */
function useResetOnBuildingChange(buildingId: number) {
  const seen = useRef(buildingId)

  useEffect(() => {
    if (seen.current === buildingId) return
    seen.current = buildingId
    useConfiguration.getState().clear()
    useConfiguratorSession.getState().reset()
  }, [buildingId])
}

export function ConfiguratorScreen({
  building,
  packages,
  integration,
  region,
  answers,
}: Props) {
  useResetOnBuildingChange(building.id)

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <SafeSceneViewer building={building} packages={packages} />

      <ConfiguratorHeader building={building} region={region} answers={answers} />

      <PackagePanel building={building} packages={packages} />
      <QuoteDialog building={building} packages={packages} integration={integration} />
    </main>
  )
}
