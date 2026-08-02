'use client'

import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'

import type { BuildingScene, RoomZone } from '@/entities/building'
import { footprintFitsPolygon, polygonCentroid } from '@/entities/building'
import { useConfiguration } from '@/entities/configuration'
import { useConfiguratorSession } from '@/entities/configurator-session'
import type { FurniturePackageEntity } from '@/entities/furniture-package'

import { findFreeSpot } from '../lib/placement-geometry'

type Args = {
  building: BuildingScene
  packages: FurniturePackageEntity[]
}

export type PackageOffer = {
  pkg: FurniturePackageEntity
  fits: boolean
}

export function usePackagePlacementModel({ building, packages }: Args) {
  const focusedRoomKey = useConfiguratorSession((s) => s.focusedRoomKey)
  const placed = useConfiguration((s) => s.placed)
  const addPackage = useConfiguration((s) => s.addPackage)
  const removePackage = useConfiguration((s) => s.removePackage)

  const focusedRoom = useMemo<RoomZone | null>(
    () => building.rooms.find((room) => room.key === focusedRoomKey) ?? null,
    [building.rooms, focusedRoomKey],
  )

  const packagesById = useMemo(
    () => new Map(packages.map((pkg) => [pkg.id, pkg])),
    [packages],
  )

  const offers = useMemo<PackageOffer[]>(() => {
    if (!focusedRoom) return []

    return packages
      .filter(
        (pkg) =>
          pkg.compatibleRoomTypes.length === 0 ||
          pkg.compatibleRoomTypes.includes(focusedRoom.roomType),
      )
      .map((pkg) => ({
        pkg,
        fits: footprintFitsPolygon(pkg.footprint, focusedRoom.floorPolygon),
      }))
  }, [packages, focusedRoom])

  useEffect(() => {
    for (const offer of offers) {
      useGLTF.preload(offer.pkg.modelUrl, false, true)
    }
  }, [offers])

  const placedInFocusedRoom = useMemo(
    () =>
      placed
        .filter((p) => p.roomKey === focusedRoom?.key)
        .map((p) => ({ ...p, pkg: packagesById.get(p.packageId) ?? null })),
    [placed, focusedRoom, packagesById],
  )

  const addToFocusedRoom = (pkg: FurniturePackageEntity): boolean => {
    if (!focusedRoom) return false

    const centroid = polygonCentroid(focusedRoom.floorPolygon)
    const preferred = { x: centroid.x, z: centroid.z }
    const rotationYDeg = 0

    const others = placed
      .filter((p) => p.roomKey === focusedRoom.key)
      .flatMap((p) => {
        const placedPkg = packagesById.get(p.packageId)
        return placedPkg
          ? [{ x: p.x, z: p.z, rotationYDeg: p.rotationYDeg, footprint: placedPkg.footprint }]
          : []
      })

    const spot = findFreeSpot(preferred, pkg.footprint, rotationYDeg, focusedRoom.floorPolygon, others)

    if (!spot) return false

    addPackage({ packageId: pkg.id, roomKey: focusedRoom.key, ...spot, rotationYDeg })
    return true
  }

  return {
    focusedRoom,
    isPanelOpen: focusedRoom !== null,
    offers,
    isEmpty: offers.length === 0,
    placedInFocusedRoom,
    onAddPackage: addToFocusedRoom,
    onRemovePackage: removePackage,
  }
}

export type PackagePlacementVm = ReturnType<typeof usePackagePlacementModel>
