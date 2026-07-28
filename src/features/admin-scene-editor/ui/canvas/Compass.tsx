'use client'

import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import { Vector3 } from 'three'

import { bearingOf } from '@/entities/building'

/**
 * Which way is north, in a scene with nothing else to tell you.
 *
 * The building sits at whatever angle it was exported at and the camera orbits
 * freely, so "the sun is in the south-west" means nothing on its own. This is
 * the reference that makes it mean something.
 *
 * Split in two because it straddles the canvas boundary: the dial is ordinary
 * DOM sitting over the viewport, and only the probe can see the camera. They
 * meet at a ref, so the needle is a style write per frame rather than a React
 * render per frame.
 */

export type CompassHandle = RefObject<HTMLDivElement | null>

/**
 * Inside the Canvas: reports where the camera is looking, every frame.
 *
 * It reports rather than writes, because the dial belongs to the component
 * that owns the ref — reaching through a ref handed down as a prop is a
 * mutation of somebody else's state, and the compiler is right to say so.
 */
export function CompassProbe({ onHeading }: { onHeading: (bearingDeg: number) => void }) {
  const direction = useRef(new Vector3())

  useFrame(({ camera }) => {
    camera.getWorldDirection(direction.current)
    onHeading(bearingOf({ x: direction.current.x, z: direction.current.z }))
  })

  return null
}

const CARDINALS: Array<{ label: string; angle: number; strong: boolean }> = [
  { label: 'N', angle: 0, strong: true },
  { label: 'E', angle: 90, strong: false },
  { label: 'S', angle: 180, strong: false },
  { label: 'W', angle: 270, strong: false },
]

/** Outside the Canvas: the dial itself, in the viewport's top-right corner. */
export function CompassRose({ dial }: { dial: CompassHandle }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'rgba(17,18,21,0.72)',
        border: '1px solid #2a2e34',
        backdropFilter: 'blur(4px)',
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      <div ref={dial} style={{ position: 'absolute', inset: 0 }}>
        {CARDINALS.map(({ label, angle, strong }) => (
          <span
            key={label}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              justifyContent: 'center',
              // Each letter is pushed to the rim along its own bearing, then
              // spun back upright so the dial can rotate as one piece.
              transform: `rotate(${angle}deg)`,
              fontSize: 9.5,
              fontWeight: strong ? 700 : 500,
              letterSpacing: 0.5,
              color: strong ? '#f87171' : '#8b929c',
              paddingTop: 4,
            }}
          >
            <span style={{ transform: `rotate(${-angle}deg)` }}>{label}</span>
          </span>
        ))}
        {/* Needle: red half points north, like every compass ever made. */}
        <span
          style={{
            position: 'absolute',
            left: '50%',
            top: 15,
            width: 2,
            height: 26,
            marginLeft: -1,
            borderRadius: 1,
            background: 'linear-gradient(#f87171 0 50%, #6b7280 50% 100%)',
          }}
        />
      </div>
    </div>
  )
}
