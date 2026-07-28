'use client'

import type { BuildingScene } from '@/entities/building'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
import { PackagePanel, PlacedPackages } from '@/features/package-placement'
import { QuoteDialog, type IntegrationOptions } from '@/features/quote-summary'
import { SceneViewer } from '@/features/scene-viewer'
import { withModule } from '@/shared/lib'

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

/**
 * R3F re-throws errors raised inside the canvas out to the DOM tree, so a
 * single unreachable texture or model would take the whole configurator down
 * with a blank page. The boundary keeps the failure to the viewport.
 */
const SafeSceneViewer = withModule(Scene, {
  errorFallback: (
    <div className="flex size-full items-center justify-center bg-muted/40 p-8 text-center">
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

      <header className="pointer-events-none absolute top-4 left-4 rounded-lg bg-background/90 px-4 py-2 shadow-md ring-1 ring-border backdrop-blur">
        <h1 className="text-sm font-semibold">{building.title}</h1>
        <p className="text-xs text-muted-foreground">
          {building.unitCount} {building.line.unitLabel}
          {building.dimensions ? ` · ${building.dimensions}` : ''}
          {building.sqft ? ` · ${building.sqft} sq ft` : ''}
        </p>
      </header>

      <PackagePanel building={building} packages={packages} />
      <QuoteDialog building={building} packages={packages} integration={integration} />
    </main>
  )
}
