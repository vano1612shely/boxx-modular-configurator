import type { Zone } from '@/entities/building'
import { roomZones } from '@/entities/building'

type RawZone = { key?: unknown; name?: unknown }

/**
 * A room's zones as the editor holds them, names and all.
 *
 * The scene's own reader puts the zone's key in place of a missing name, and it
 * is right to: a nameless zone would reach a visitor as a blank chip and a
 * blank heading on their quote. In the editor that same kindness is a bug —
 * clear the name field and it fills itself back in with "zone-4" before the
 * next keystroke, so the field cannot be emptied and cannot be retyped.
 *
 * So the scene's reader still does all the work — the polygon checks, the type,
 * the tint, the areas — and only the one field it was being kind about is taken
 * raw. Two readers side by side would drift; this one cannot.
 */
export function draftZones(value: unknown): Zone[] {
  const zones = roomZones(value)
  if (!Array.isArray(value)) return zones

  const raw = value as RawZone[]
  return zones.map((zone) => {
    const source = raw.find((entry) => entry?.key === zone.key)
    return { ...zone, name: typeof source?.name === 'string' ? source.name : '' }
  })
}
