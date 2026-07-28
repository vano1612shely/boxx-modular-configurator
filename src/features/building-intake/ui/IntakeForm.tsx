'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { For } from '@/shared/ui/control-flow'

export type IntakeLine = {
  slug: string
  name: string
  unitLabel: 'offices' | 'classrooms'
  maxUnits: number | null
}

type Props = {
  lines: IntakeLine[]
}

export function IntakeForm({ lines }: Props) {
  const router = useRouter()
  const [lineSlug, setLineSlug] = useState(lines[0]?.slug ?? '')
  const [units, setUnits] = useState(2)
  const [restrooms, setRestrooms] = useState(0)

  const line = lines.find((l) => l.slug === lineSlug) ?? lines[0]

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams({
      building: lineSlug,
      units: String(units),
      restrooms: String(restrooms),
    })
    router.push(`/configurator?${params.toString()}`)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm space-y-5 rounded-xl border bg-background p-6 shadow-lg"
    >
      <div>
        <h1 className="text-lg font-semibold">Build your building</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Answer two questions and we’ll suggest the closest-fitting model.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Building type</span>
        <select
          value={lineSlug}
          onChange={(event) => setLineSlug(event.target.value)}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <For each={lines} getKey={(l) => l.slug}>
            {(item) => <option value={item.slug}>{item.name}</option>}
          </For>
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">
          How many {line?.unitLabel ?? 'offices'} do you need?
        </span>
        <input
          type="number"
          min={1}
          max={99}
          value={units}
          onChange={(event) => setUnits(Number.parseInt(event.target.value, 10) || 1)}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">How many restrooms do you need?</span>
        <input
          type="number"
          min={0}
          max={20}
          value={restrooms}
          onChange={(event) => setRestrooms(Math.max(Number.parseInt(event.target.value, 10) || 0, 0))}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="block text-xs text-muted-foreground">
          We’ll pick the closest model that covers it.
        </span>
      </label>

      <button
        type="submit"
        className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Show my building
      </button>
    </form>
  )
}
