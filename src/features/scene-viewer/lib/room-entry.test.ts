import { describe, expect, it } from 'vitest'

import type { Room } from '@/entities/building'

import { roomEntry } from './room-entry'

const room = (isRestroom: boolean) => ({ key: 'r', name: 'R', isRestroom }) as Room

describe('roomEntry', () => {
  it('goes into an ordinary room', () => {
    expect(roomEntry(room(false))).toBe('focus')
  })

  /**
   * The whole feature, in one line.
   *
   * Going in hides the building's own model and stands a generated shell up in
   * its place — and a restroom's fittings are in that model, so going in would
   * hide the only thing worth going in for. It is brought close instead, which
   * is also what keeps its key out of `focusedRoomKey` and every furniture path
   * downstream of it.
   */
  it('only brings a restroom close', () => {
    expect(roomEntry(room(true))).toBe('preview')
  })
})
