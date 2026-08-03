'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

import { useConfiguration } from '@/entities/configuration'

/** Frames redrawn after a change, so geometry mounting a frame late is caught. */
const ARMED_FRAMES = 2

/**
 * Takes the shadow map off the per-frame budget.
 *
 * three redraws every shadow map on every frame by default (autoUpdate, turned
 * off on the Canvas). This building does not move: the map only has to be
 * redrawn when something that casts into it changes, which is what `trigger`
 * carries. Furniture under the pointer is the one thing that moves
 * continuously, so a drag re-arms it every frame.
 */
export function ShadowUpdates({ trigger }: { trigger: unknown }) {
  const armed = useRef(ARMED_FRAMES)

  useEffect(() => {
    armed.current = ARMED_FRAMES
  }, [trigger])

  useFrame((state) => {
    if (useConfiguration.getState().draggingInstanceId !== null) {
      state.gl.shadowMap.needsUpdate = true
      return
    }
    if (armed.current <= 0) return
    armed.current -= 1
    state.gl.shadowMap.needsUpdate = true
  })

  return null
}
