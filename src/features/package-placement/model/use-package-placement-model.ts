'use client'

import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'

import type { BuildingScene, FittedSet, Room, RoomType, Zone } from '@/entities/building'
import {
  acceptingFloor,
  fittedSetOf,
  fittedSetsIn,
  footprintFitsRegion,
  partsCentre,
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
 * An arrangement this piece of floor offers, and whether it is the one standing.
 *
 * The set is the building's half of it — what stands where — and the package is
 * the catalogue's half: the name, the price, the picture. Neither is any use
 * without the other, so an offer is only made when both are there.
 */
export type FittedOffer = {
  set: FittedSet
  pkg: FurniturePackageEntity
  standing: boolean
}

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
  /** Arrangements this floor offers. Empty in every room nobody has fitted out. */
  fitted: FittedOffer[]
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
  const selectPackage = useConfiguration((s) => s.selectPackage)
  const selectedInstanceId = useConfiguration((s) => s.selectedInstanceId)

  const focusedRoom = useMemo<Room | null>(() => {
    const room = building.rooms.find((r) => r.key === focusedRoomKey) ?? null
    // A restroom cannot reach this key through the app at all — its marker
    // brings the camera close rather than going in. The second lock is here
    // because this is the door itself: the catalogue, what is on offer, the
    // model preloads, the "+" and the panel are every one of them derived from
    // this single value being something rather than nothing.
    return room?.isRestroom ? null : room
  }, [building.rooms, focusedRoomKey])

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
   * What is on offer for each piece of floor, and whether it would fit.
   *
   * Deliberately blind to what has been placed: answering "does this fit" walks
   * the floor a dozen times per package, and `placed` changes on every pointer
   * move of a drag. Tying the two together made every drag re-measure the whole
   * catalogue, which is exactly as slow as it sounds.
   *
   * Fit is asked of the whole floor a package is allowed on rather than of one
   * zone: a table welcome in both halves of an open-plan room may lie across
   * the line between them, and calling it too large would be a lie.
   */
  const catalogue = useMemo(() => {
    const room = focusedRoom
    if (!room) return []

    const offersFor = (accepts: (types: RoomType[]) => boolean): PackageOffer[] =>
      packages
        // A fitted package is offered by the building, below, and never by room
        // type: it exists only where somebody has arranged it. One with no model
        // at all has nothing to carry in and is nobody's mistake to discover in
        // the scene — it is simply not on offer.
        .filter((pkg) => !pkg.fitted && pkg.modelUrl !== null)
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
          color: null as string | null,
          zone: null as Zone | null,
          offers,
          groups: splitByRecommendation(offers, room.roomType),
        },
      ]
    }

    return room.zones.map((zone) => {
      const offers = offersFor((types) => zoneAccepts(zone, types))
      return {
        key: zone.key,
        name: zone.name,
        color: zone.color as string | null,
        zone: zone as Zone | null,
        offers,
        groups: splitByRecommendation(offers, zone.roomType),
      }
    })
  }, [focusedRoom, packages])

  /**
   * The arrangement standing in the focused room, or null.
   *
   * Recognised rather than flagged: a placement is fitted exactly when the room
   * it stands in offers an arrangement for its package, which is the same test
   * the renderer and a reopened order use. One at a time, because adding a
   * second replaces the first — a room has one kitchen.
   */
  const standingFitted = useMemo<PlacedItem | null>(() => {
    const room = focusedRoom
    if (!room) return null
    return placedInFocusedRoom.find((item) => fittedSetOf(room, item.packageId) !== null) ?? null
  }, [focusedRoom, placedInFocusedRoom])

  /** Which of them to show, and what is standing in each. Cheap, so it may follow a drag. */
  const sections = useMemo<FloorSection[]>(() => {
    const room = focusedRoom
    if (!room) return []

    const shown = activeZone
      ? catalogue.filter((section) => section.zone?.key === activeZone.key)
      : catalogue

    return shown.map((section) => ({
      ...section,
      // Both halves have to be there: the building says what stands where, the
      // catalogue says what it is called and what it costs. A set naming a
      // package that was deleted, or one whose package has since stopped being
      // fitted, is quietly not offered rather than offered as a blank.
      fitted: fittedSetsIn(room, section.zone).flatMap((set) => {
        const pkg = packagesById.get(set.packageId)
        if (!pkg || !pkg.fitted) return []
        return [{ set, pkg, standing: standingFitted?.packageId === set.packageId }]
      }),
      placed: section.zone
        ? placedInFocusedRoom.filter(
            (item) => zoneAt(room, item.x, item.z)?.key === section.zone?.key,
          )
        : placedInFocusedRoom,
    }))
  }, [catalogue, focusedRoom, activeZone, placedInFocusedRoom, packagesById, standingFitted])

  // From the catalogue, not from `sections`: this feeds the preloader, and each
  // preload walks suspend-react's whole global cache. It must not churn.
  const offers = useMemo(() => catalogue.flatMap((section) => section.offers), [catalogue])

  /**
   * Every model the room's arrangements are made of.
   *
   * Warmed with the catalogue rather than on the press, because an arrangement
   * is a dozen files at once: pressed cold, the visitor watches a kitchen
   * arrive one appliance at a time.
   */
  const fittedModels = useMemo(() => {
    const room = focusedRoom
    if (!room) return [] as string[]
    return [
      ...new Set(
        room.fittedSets.flatMap((set) =>
          set.parts.flatMap((part) => (part.source === 'model' && part.modelUrl ? [part.modelUrl] : [])),
        ),
      ),
    ]
  }, [focusedRoom])

  useEffect(() => {
    for (const offer of offers) {
      if (offer.pkg.modelUrl) useGLTF.preload(offer.pkg.modelUrl, false, true)
    }
    for (const url of fittedModels) {
      useGLTF.preload(url, false, true)
    }
  }, [offers, fittedModels])

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
    const region = reachableFloor(room, pkg.compatibleRoomTypes, centroid.x, centroid.z)

    const others = placedInFocusedRoom.flatMap((p) =>
      p.pkg ? [{ x: p.x, z: p.z, rotationYDeg: p.rotationYDeg, footprint: p.pkg.footprint }] : [],
    )

    // No measured shapes here, on purpose: the "+" button places by footprint
    // even though dragging by hand now goes by what the model really fills.
    //
    // The search below is complete because a rectangle can always be pushed
    // back until it touches two things, so every pose that works is in the list
    // it tries. Shapes break that argument — a chair tucked under a desk touches
    // nothing on the way in, so no candidate the search generates would ever
    // find it — and `middleOfTheGap` would then slide it straight back out from
    // under the desk, because the corridor it measures is made of rectangles.
    // Making the search shape-aware means rebuilding both, to put a chair under
    // a desk in a room where the visitor has not asked for one there.
    //
    // Tried the way it faces first, then turned. A long package in a narrow
    // kitchen goes in sideways or not at all, and asking only for the way it
    // happens to face made a piece that plainly fits impossible to add — the
    // room was told it had no space for something it could hold perfectly well.
    //
    // Two angles, not four: the floor a rectangle covers is the same turned
    // half round, so 180 and 270 could only ever fail wherever 0 and 90 did.
    for (const rotationYDeg of [0, 90]) {
      const spot = findFreeSpotInRegion(centroid, pkg.footprint, rotationYDeg, region, others)
      if (!spot) continue

      addPackage({ packageId: pkg.id, roomKey: room.key, ...spot, rotationYDeg })
      return true
    }

    return false
  }

  /**
   * Puts an arrangement in the room, taking out whichever one was there.
   *
   * A room has one kitchen, so this is a swap rather than an add: pressing a
   * second arrangement means "that one instead", and asking the visitor to
   * delete the first one first would be asking them to do the obvious thing by
   * hand. Pressing the one already standing does nothing — the tile says so.
   *
   * What it leaves behind is an ordinary placement, at the middle of the parts.
   * Everything downstream of that — the collision tests, the quote, the saved
   * order, the read-only replay — treats it as furniture, which is what it is.
   */
  const putFitted = (set: FittedSet): boolean => {
    const room = focusedRoom
    if (!room) return false
    if (standingFitted?.packageId === set.packageId) return false

    if (standingFitted) removePackage(standingFitted.instanceId)

    const centre = partsCentre(set.parts)
    addPackage({
      packageId: set.packageId,
      roomKey: room.key,
      x: centre.x,
      z: centre.z,
      rotationYDeg: 0,
      pinned: true,
    })
    return true
  }

  return {
    focusedRoom,
    activeZone,
    isPanelOpen: focusedRoom !== null,
    standingFitted,
    onPutFitted: putFitted,
    /** True while a divided room is shown whole, which is what grows accordions. */
    isSplit: sections.length > 1,
    sections,
    offers,
    isEmpty: sections.every(
      (section) => section.offers.length === 0 && section.fitted.length === 0,
    ),
    placedInFocusedRoom,
    onAddPackage: addToSection,
    onRemovePackage: removePackage,
    /**
     * Picking a piece from the list rather than out of the scene.
     *
     * Which the list is now the only reliable way to do for some of them: a
     * chair pushed under a desk is behind the desk from every angle the camera
     * offers, and the pointer answers with whatever is in front. Without this
     * the only thing the visitor could still do to a tucked chair is delete it.
     */
    selectedInstanceId,
    onSelectPackage: selectPackage,
  }
}

export type PackagePlacementVm = ReturnType<typeof usePackagePlacementModel>
