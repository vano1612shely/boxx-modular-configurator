'use client'

import { useEffect, useState } from 'react'

import type { Room } from '@/entities/building'

export function useRoomTransition(room: Room | null): {
  /** The room to render — a frame behind the one that was clicked. */
  staged: Room | null
  /** True while the click has not been staged yet; the veil should be up. */
  settling: boolean
} {
  const [staged, setStaged] = useState<Room | null>(room)

  const key = room?.key ?? null
  const stagedKey = staged?.key ?? null

  useEffect(() => {
    if (key === stagedKey) return

    let inner = 0
    const outer = requestAnimationFrame(() => {
      // A second frame: the first only guarantees the veil is in the next
      // paint, not that it has been painted.
      inner = requestAnimationFrame(() => setStaged(room))
    })

    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [key, stagedKey, room])

  return { staged, settling: key !== stagedKey }
}
