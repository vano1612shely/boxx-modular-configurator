'use client'

import { useMemo } from 'react'

import type { BuildingScene, Room } from '@/entities/building'
import { findFloor, roomsOnFloor } from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'

import { roomMarkers, type RoomMarker } from '../lib/room-markers'

export function useSceneViewerModel(building: BuildingScene) {
  const focusedRoomKey = useConfiguratorSession((s) => s.focusedRoomKey)
  const focusRoom = useConfiguratorSession((s) => s.focusRoom)
  const exitRoomFocus = useConfiguratorSession((s) => s.exitRoomFocus)
  const interactionLock = useConfiguratorSession((s) => s.interactionLock)
  const selectedFloorKey = useConfiguratorSession((s) => s.selectedFloorKey)
  const previewRoomKey = useConfiguratorSession((s) => s.previewRoomKey)
  const previewRoom = useConfiguratorSession((s) => s.previewRoom)
  const activeZoneKey = useConfiguratorSession((s) => s.activeZoneKey)
  const setActiveZone = useConfiguratorSession((s) => s.setActiveZone)

  const focusedRoom = useMemo<Room | null>(
    () => building.rooms.find((room) => room.key === focusedRoomKey) ?? null,
    [building.rooms, focusedRoomKey],
  )

  const previewedRoom = useMemo<Room | null>(
    () => building.rooms.find((room) => room.key === previewRoomKey) ?? null,
    [building.rooms, previewRoomKey],
  )

  const selectedFloor = useMemo(
    () => findFloor(building.floors, selectedFloorKey),
    [building.floors, selectedFloorKey],
  )

  // Rooms on a storey nobody is looking at have no hotspot and no furniture:
  // the geometry they sit in has been cut away.
  const visibleRooms = useMemo(
    () => roomsOnFloor(building.rooms, building.floors, selectedFloorKey),
    [building.rooms, building.floors, selectedFloorKey],
  )

  // One per place worth going to, which is one per zone in a divided room.
  const markers = useMemo(() => roomMarkers(visibleRooms), [visibleRooms])

  return {
    building,
    rooms: building.rooms,
    visibleRooms,
    markers,
    focusedRoom,
    isRoomFocused: focusedRoom !== null,
    previewedRoom,
    selectedFloor,
    interactionLock,
    activeZoneKey,
    // Takes the marker rather than a key, because what pressing one does is
    // decided when the marker is built — and this is the only call `focusRoom`
    // has in the app, which is what keeps a restroom out of `focusedRoomKey`
    // without any of the things that key drives having to know about restrooms.
    onOpenMarker: (marker: RoomMarker) =>
      marker.entry === 'focus'
        ? focusRoom(marker.room.key, marker.zone?.key ?? null)
        : previewRoom(marker.room.key),
    onPreviewRoom: previewRoom,
    onExitRoomFocus: exitRoomFocus,
    // Picking the half you are already in steps back out to the whole room, so
    // the floor is never a one-way door.
    onPickZone: (key: string) => setActiveZone(activeZoneKey === key ? null : key),
  }
}

export type SceneViewerVm = ReturnType<typeof useSceneViewerModel>
