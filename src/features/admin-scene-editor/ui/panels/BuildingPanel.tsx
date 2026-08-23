'use client'

import { Match, Switch } from '@/shared/ui/control-flow'

import type { BuildingTab } from '../../model/use-scene-editor-model'

import { Accordion } from '../controls/Accordion'
import { Tabs } from '../controls/Tabs'
import { s } from '../editor-styles'
import { CameraSection } from './CameraSection'
import { ExteriorSection } from './ExteriorSection'
import { FloorLevelCard } from './FloorLevelCard'
import { ModelNodesSection } from './ModelNodesSection'
import { RoofModelSection } from './RoofModelSection'
import { RoofVolumesSection } from './RoofVolumesSection'
import { RoomListSection } from './RoomListSection'
import { SelectionPanel } from './SelectionPanel'
import { StoreysSection } from './StoreysSection'
import type { PanelProps } from './shared'

export function BuildingPanel({ vm, onOpenMenu }: PanelProps) {
  const rooms = vm.draft?.rooms ?? []
  const volumes = vm.draft?.sceneConfig?.roofBlocks ?? []

  const tabs: Array<{ value: BuildingTab; label: string; count?: number; title?: string }> = [
    { value: 'rooms', label: 'Rooms', count: rooms.length },
    { value: 'storeys', label: 'Storeys', count: vm.floors.length },
    {
      value: 'model',
      label: 'Model',
      title: 'The glb itself: what is hidden, what the roof is, how the camera is bounded',
    },
    { value: 'exterior', label: 'Exterior', count: vm.exteriorSlots.length },
  ]

  return (
    <>
      {/* Above the tabs, not inside one: what is selected is what you are
          working on, and it used to sit under seven lists it had nothing to do
          with — picked in the viewport, found by scrolling. */}
      <SelectionPanel vm={vm} />

      <Tabs tabs={tabs} value={vm.buildingTab} onChange={vm.onBuildingTab} />

      {/* The only part that scrolls. Everything above it — where you are, what
          is selected, which job — is what you steer with, and steering that
          scrolls away is the complaint this whole panel was rebuilt over. */}
      <div style={s.scroll}>
        <Switch>
        <Match when={vm.buildingTab === 'rooms'}>
          <RoomListSection vm={vm} onOpenMenu={onOpenMenu} />
        </Match>

        <Match when={vm.buildingTab === 'storeys'}>
          {/* Here rather than behind the Floor level tool: it is the height the
              next room drawn on this storey starts at, which is a fact about
              the storey and readable whether or not the tool is in hand. */}
          <div style={{ padding: '10px 12px 0' }}>
            <FloorLevelCard
              vm={vm}
              hint={
                vm.previewFloorName
                  ? `The height rooms you draw next on ${vm.previewFloorName} will start at — every storey keeps its own. Rooms already drawn keep theirs.`
                  : vm.floors.length > 0
                    ? 'The height rooms you draw next will start at. Pick a storey in the viewport bar and this follows it.'
                    : 'The height rooms you draw next will start at. Rooms already drawn keep their own.'
              }
            />
          </div>
          <StoreysSection vm={vm} onOpenMenu={onOpenMenu} />
        </Match>

        <Match when={vm.buildingTab === 'model'}>
          <Accordion title="Model objects" badge={vm.modelNodes.length} defaultOpen>
            <ModelNodesSection vm={vm} onOpenMenu={onOpenMenu} />
          </Accordion>

          <Accordion title="Roof — from the model" badge={volumes.length}>
            <RoofVolumesSection vm={vm} onOpenMenu={onOpenMenu} />
          </Accordion>

          <Accordion title="Roof — separate model" badge={vm.roofModelUrl ? 1 : 0}>
            <RoofModelSection vm={vm} />
          </Accordion>

          <Accordion title="Camera limits">
            <CameraSection vm={vm} />
          </Accordion>
        </Match>

          <Match when={vm.buildingTab === 'exterior'}>
            <ExteriorSection vm={vm} />
          </Match>
        </Switch>
      </div>
    </>
  )
}
