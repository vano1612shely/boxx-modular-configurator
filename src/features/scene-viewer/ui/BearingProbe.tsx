'use client'

import { useThree } from '@react-three/fiber'
import type CameraControlsImpl from 'camera-controls'
import { useEffect } from 'react'

import { useConfiguratorSession } from '@/entities/configurator-session'

import { facingSide } from '../lib/facing'

/**
 * Publishes which side of the building the camera is square to.
 *
 * On the controls' own `update` event rather than a frame loop: it fires while
 * the camera is moving and not at all while it rests, and the store is written
 * only when the answer changes — a bar that re-rendered sixty times a second
 * would cost more than the label it is keeping honest.
 */
export function BearingProbe() {
  const controls = useThree((state) => state.controls) as CameraControlsImpl | null

  useEffect(() => {
    if (!controls) return

    const publish = () => {
      const next = facingSide(controls.azimuthAngle, controls.polarAngle)
      const session = useConfiguratorSession.getState()
      if (next !== session.facing) session.setFacing(next)
    }

    publish()
    controls.addEventListener('update', publish)
    return () => controls.removeEventListener('update', publish)
  }, [controls])

  return null
}
