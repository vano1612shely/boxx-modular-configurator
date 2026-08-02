'use client'

import type { BuildingScene } from '@/entities/building'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
import { PackagePanel, PlacedPackages } from '@/features/package-placement'
import { QuoteDialog, type IntegrationOptions } from '@/features/quote-summary'
import { SceneViewer } from '@/features/scene-viewer'
import { withModule } from '@/shared/lib'

import { ConfiguratorHeader } from './ConfiguratorHeader'

type Props = {
  building: BuildingScene
  packages: FurniturePackageEntity[]
  integration: IntegrationOptions
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
    <div className="flex size-full items-center justify-center bg-background p-8 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">
        The 3D view could not be loaded. Please refresh the page — your configuration is kept.
      </p>
    </div>
  ),
})

export function ConfiguratorScreen({ building, packages, integration }: Props) {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <SafeSceneViewer building={building} packages={packages} />

      <ConfiguratorHeader building={building} />

      <PackagePanel building={building} packages={packages} />
      <QuoteDialog building={building} packages={packages} integration={integration} />
    </main>
  )
}
