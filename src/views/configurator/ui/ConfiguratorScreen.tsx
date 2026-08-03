'use client'

import { TriangleAlert } from 'lucide-react'

import type { BuildingScene } from '@/entities/building'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
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

export function ConfiguratorScreen({ building, packages, integration, region }: Props) {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <SafeSceneViewer building={building} packages={packages} />

      <ConfiguratorHeader building={building} region={region} />

      <PackagePanel building={building} packages={packages} />
      <QuoteDialog building={building} packages={packages} integration={integration} />
    </main>
  )
}
