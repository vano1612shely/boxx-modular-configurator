'use client'

import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'

import type { BuildingScene, Room, RoomType, Zone } from '@/entities/building'
import {
  acceptingFloor,
  footprintFitsRegion,
  polygonCentroid,
  reachableFloor,
  zoneAccepts,
  zoneAt,
} from '@/entities/building'
import { useConfiguration, type PlacedPackage } from '@/entities/configuration'
import { useConfiguratorSession } from '@/entities/configurator-session'
import type { FurniturePackageEntity } from '@/entities/furniture-package'

import { findFreeSpotInRegion } from '../lib/placement-geometry'

type Args = {
  building: BuildingScene
  packages: FurniturePackageEntity[]
}

export type PackageOffer = {
  pkg: FurniturePackageEntity
  fits: boolean
}

export type OfferGroups = {
  /** Named for this kind of room in the admin. */
  recommended: PackageOffer[]
  other: PackageOffer[]
}

export type PlacedItem = PlacedPackage & { pkg: FurniturePackageEntity | null }

/**
 * One list of furniture, for one piece of floor.
 *
 * An undivided room has exactly one, and everything downstream renders the way
 * it always has. A divided room has one per zone, because "what may stand here"
 * is a question about the zone and not about the room.
 */
export type FloorSection = {
  key: string
  name: string
  /** The zone's floor tint, or null when the section is the whole room. */
  color: string | null
  zone: Zone | null
  offers: PackageOffer[]
  groups: OfferGroups
  placed: PlacedItem[]
}

function splitByRecommendation(offers: PackageOffer[], roomType: RoomType): OfferGroups {
  const recommended: PackageOffer[] = []
  const other: PackageOffer[] = []

  for (const offer of offers) {
    ;(offer.pkg.recommendedFor.includes(roomType) ? recommended : other).push(offer)
  }

  return { recommended, other }
}

export function usePackagePlacementModel({ building, packages }: Args) {
  const focusedRoomKey = useConfiguratorSession((s) => s.focusedRoomKey)
  const activeZoneKey = useConfiguratorSession((s) => s.activeZoneKey)
  const placed = useConfiguration((s) => s.placed)
  const addPackage = useConfiguration((s) => s.addPackage)
  const removePackage = useConfiguration((s) => s.removePackage)

  const focusedRoom = useMemo<Room | null>(
    () => building.rooms.find((room) => room.key === focusedRoomKey) ?? null,
    [building.rooms, focusedRoomKey],
  )

  const activeZone = useMemo<Zone | null>(
    () => focusedRoom?.zones.find((zone) => zone.key === activeZoneKey) ?? null,
    [focusedRoom, activeZoneKey],
  )

  const packagesById = useMemo(() => new Map(packages.map((pkg) => [pkg.id, pkg])), [packages])

  const placedInFocusedRoom = useMemo<PlacedItem[]>(
    () =>
      placed
        .filter((p) => p.roomKey === focusedRoom?.key)
        .map((p) => ({ ...p, pkg: packagesById.get(p.packageId) ?? null })),
    [placed, focusedRoom, packagesById],
  )

  /**
   * A section per zone, or just the one the visitor picked.
   *
   * Whether a package fits is asked of the whole floor it is allowed on rather
   * than of one zone: a table welcome in both halves of an open-plan room may
   * lie across the line between them, and calling it too large would be a lie.
   */
  const sections = useMemo<FloorSection[]>(() => {
    const room = focusedRoom
    if (!room) return []

    const offersFor = (accepts: (types: RoomType[]) => boolean): PackageOffer[] =>
      packages
        .filter((pkg) => accepts(pkg.compatibleRoomTypes))
        .map((pkg) => ({
          pkg,
          fits: footprintFitsRegion(pkg.footprint, acceptingFloor(room, pkg.compatibleRoomTypes)),
        }))

    if (room.zones.length === 0) {
      const offers = offersFor((types) => types.length === 0 || types.includes(room.roomType))
      return [
        {
          key: room.key,
          name: room.name,
          color: null,
          zone: null,
          offers,
          groups: splitByRecommendation(offers, room.roomType),
          placed: placedInFocusedRoom,
        },
      ]
    }

    return (activeZone ? [activeZone] : room.zones).map((zone) => {
      const offers = offersFor((types) => zoneAccepts(zone, types))
      return {
        key: zone.key,
        name: zone.name,
        color: zone.color,
        zone,
        offers,
        groups: splitByRecommendation(offers, zone.roomType),
        placed: placedInFocusedRoom.filter(
          (item) => zoneAt(room, item.x, item.z)?.key === zone.key,
        ),
      }
    })
  }, [focusedRoom, packages, activeZone, placedInFocusedRoom])

  const offers = useMemo(() => sections.flatMap((section) => section.offers), [sections])

  useEffect(() => {
    for (const offer of offers) {
      useGLTF.preload(offer.pkg.modelUrl, false, true)
    }
  }, [offers])

  /**
   * Drops a package into the piece of floor it was asked for.
   *
   * Aimed at the middle of that zone but free to settle anywhere the package is
   * allowed: a chair added to the kitchen end of an open-plan room may come to
   * rest just over the line when the kitchen end is full, which is what would
   * happen if somebody carried it in themselves.
   */
  const addToSection = (pkg: FurniturePackageEntity, zoneKey: string | null): boolean => {
    const room = focusedRoom
    if (!room) return false

    const zone = zoneKey === null ? null : room.zones.find((z) => z.key === zoneKey)
    if (zoneKey !== null && !zone) return false

    const centroid = polygonCentroid(zone ? zone.polygon : room.floorPolygon)
    const rotationYDeg = 0
    const region = reachableFloor(room, pkg.compatibleRoomTypes, centroid.x, centroid.z)

    const others = placedInFocusedRoom.flatMap((p) =>
      p.pkg ? [{ x: p.x, z: p.z, rotationYDeg: p.rotationYDeg, footprint: p.pkg.footprint }] : [],
    )

    const spot = findFreeSpotInRegion(centroid, pkg.footprint, rotationYDeg, region, others)
    if (!spot) return false

    addPackage({ packageId: pkg.id, roomKey: room.key, ...spot, rotationYDeg })
    return true
  }

  return {
    focusedRoom,
    activeZone,
    isPanelOpen: focusedRoom !== null,
    /** True while a divided room is shown whole, which is what grows accordions. */
    isSplit: sections.length > 1,
    sections,
    offers,
    isEmpty: offers.length === 0,
    placedInFocusedRoom,
    onAddPackage: addToSection,
    onRemovePackage: removePackage,
  }
}

export type PackagePlacementVm = ReturnType<typeof usePackagePlacementModel>
