'use client'

import { useMemo } from 'react'

import type { BuildingScene, RoomZone } from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'

export function useSceneViewerModel(building: BuildingScene) {
  const focusedRoomKey = useConfiguratorSession((s) => s.focusedRoomKey)
  const focusRoom = useConfiguratorSession((s) => s.focusRoom)
  const exitRoomFocus = useConfiguratorSession((s) => s.exitRoomFocus)
  const interactionLock = useConfiguratorSession((s) => s.interactionLock)

  const focusedRoom = useMemo<RoomZone | null>(
    () => building.rooms.find((room) => room.key === focusedRoomKey) ?? null,
    [building.rooms, focusedRoomKey],
  )

  return {
    building,
    rooms: building.rooms,
    focusedRoom,
    isRoomFocused: focusedRoom !== null,
    interactionLock,
    onFocusRoom: focusRoom,
    onExitRoomFocus: exitRoomFocus,
  }
}

export type SceneViewerVm = ReturnType<typeof useSceneViewerModel>
