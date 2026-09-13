'use client'

import { Suspense, useMemo } from 'react'
import { MathUtils } from 'three'

import type { BuildingScene } from '@/entities/building'
import { fittedSetOf, RoomParts, roomFloorTopY, roomsOnFloor } from '@/entities/building'
import { useConfiguration } from '@/entities/configuration'
import { useConfiguratorSession } from '@/entities/configurator-session'
import { PackageModel, placedPackage, type FurniturePackageEntity } from '@/entities/furniture-package'
import { For } from '@/shared/ui/control-flow'

type Props = {
  building: BuildingScene
  packages: FurniturePackageEntity[]
}

/**
 * The furniture of a saved order, standing exactly where it was left.
 *
 * A slice of its own rather than a flag through `PlacedPackages`. That one is
 * built around a piece being moved: a frame loop owns its position so a drag is
 * eased rather than snapped, a layout effect exists only to keep React from
 * fighting that loop for the transform, and the outline, the toolbar and the
 * turn-fit maths hang off a selection. A pose that never changes wants none of
 * it and is better said declaratively — nine guards through the hardest file in
 * that feature would have left every one of those mechanisms running to hold
 * something still.
 *
 * What it does share is `PackageModel`, and that is the part that matters: the
 * recentring it does is the contract the saved coordinates were written under.
 */
export function StaticPlacements({ building, packages }: Props) {
  const placed = useConfiguration((s) => s.placed)
  const focusedRoomKey = useConfiguratorSession((s) => s.focusedRoomKey)
  const selectedFloorKey = useConfiguratorSession((s) => s.selectedFloorKey)

  const packagesById = useMemo(() => new Map(packages.map((pkg) => [pkg.id, pkg])), [packages])
  const roomsByKey = useMemo(
    () => new Map(building.rooms.map((room) => [room.key, room])),
    [building.rooms],
  )
  // Furniture on a storey that has been cut away would otherwise hang in the air.
  const roomsOnView = useMemo(
    () =>
      new Set(roomsOnFloor(building.rooms, building.floors, selectedFloorKey).map((r) => r.key)),
    [building.rooms, building.floors, selectedFloorKey],
  )

  return (
    <For each={placed} getKey={(placement) => placement.instanceId}>
      {(placement) => {
        const pkg = placedPackage(packagesById.get(placement.packageId), placement.memberKey)
        const room = roomsByKey.get(placement.roomKey)
        // A package or a room the catalogue no longer has. Left out rather than
        // guessed at: the summary panel still lists the line, so the order is
        // not quietly shortened, only the picture is honest about what it knows.
        if (!pkg || !room) return null

        if (focusedRoomKey && placement.roomKey !== focusedRoomKey) return null
        if (!focusedRoomKey && !roomsOnView.has(placement.roomKey)) return null

        // An arrangement the building holds, resolved the same way the
        // configurator resolves it: an order line names a package and a room,
        // and that pair is what the building answers with a kitchen. Nothing
        // about the order had to change for this to come back.
        const set = fittedSetOf(room, placement.packageId, placement)
        if (set) {
          return (
            <RoomParts
              parts={set.parts}
              buildingModelUrl={building.modelUrl}
              floorY={roomFloorTopY(room)}
            />
          )
        }

        // A fitted package the building has since stopped arranging. The line
        // stays on the summary; there is simply nothing left to draw for it.
        const modelUrl = pkg.modelUrl
        if (!modelUrl) return null

        return (
          <Suspense fallback={null}>
            <group
              position={[placement.x, roomFloorTopY(room), placement.z]}
              rotation={[0, MathUtils.degToRad(placement.rotationYDeg), 0]}
            >
              <PackageModel pkg={{ ...pkg, modelUrl }} />
            </group>
          </Suspense>
        )
      }}
    </For>
  )
}
