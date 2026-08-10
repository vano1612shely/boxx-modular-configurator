'use client'

import { useMemo } from 'react'

import type { BuildingScene, Room } from '@/entities/building'
import { findFloor, roomsOnFloor } from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'

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

  return {
    building,
    rooms: building.rooms,
    visibleRooms,
    focusedRoom,
    isRoomFocused: focusedRoom !== null,
    previewedRoom,
    selectedFloor,
    interactionLock,
    activeZoneKey,
    onFocusRoom: focusRoom,
    onPreviewRoom: previewRoom,
    onExitRoomFocus: exitRoomFocus,
    // Picking the half you are already in steps back out to the whole room, so
    // the floor is never a one-way door.
    onPickZone: (key: string) => setActiveZone(activeZoneKey === key ? null : key),
  }
}

export type SceneViewerVm = ReturnType<typeof useSceneViewerModel>
