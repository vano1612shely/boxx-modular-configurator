'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { Card, Eyebrow, Field, OptionGroup, Pill, Progress } from '@/shared/ui/boxx'
import { Match, Show, Switch } from '@/shared/ui/control-flow'

export type IntakeLine = {
  slug: string
  name: string
  unitLabel: 'offices' | 'classrooms'
  maxUnits: number | null
}

type Props = {
  lines: IntakeLine[]
}

const UNIT_LABEL = { offices: 'Offices', classrooms: 'Classrooms' } as const

const heading =
  'text-[1.5625rem] leading-[1.3] font-medium text-foreground desktop:text-[2.1875rem]'

export function IntakeForm({ lines }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [lineSlug, setLineSlug] = useState(lines[0]?.slug ?? '')
  const [units, setUnits] = useState(2)
  const [restrooms, setRestrooms] = useState(0)

  const line = lines.find((l) => l.slug === lineSlug) ?? lines[0]

  // Told here rather than after navigating, which is where the over-capacity
  // screen used to be the first news of it.
  const overCapacity = line?.maxUnits != null && units > line.maxUnits

  const options = lines.map((item) => ({ value: item.slug, label: item.name }))

  const handlePick = (slug: string) => {
    setLineSlug(slug)
    setStep(2)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams({
      building: lineSlug,
      offices: String(units),
      restrooms: String(restrooms),
    })
    router.push(`/configurator?${params.toString()}`)
  }

  return (
    <Card
      as="form"
      onSubmit={handleSubmit}
      tone="cream"
      pad="md"
      hairline
      className="flex w-full max-w-xl flex-col gap-block desktop:p-block"
    >
      <Progress step={step} total={2} />

      <Switch>
        <Match when={step === 1}>
          <div className="flex flex-col gap-block">
            <div className="flex flex-col gap-2">
              <Eyebrow>Find your solution</Eyebrow>
              <h1 className={heading}>What kind of building do you need?</h1>
            </div>

            <OptionGroup
              label="Building line"
              value={lineSlug}
              options={options}
              onChange={handlePick}
            />
          </div>
        </Match>

        <Match when={step === 2}>
          <div className="flex flex-col gap-block">
            <div className="flex flex-col gap-2">
              <Show when={line?.name}>
                <Eyebrow>{line?.name}</Eyebrow>
              </Show>
              <h1 className={heading}>How much space do you need?</h1>
            </div>

            <div className="flex flex-col gap-card">
              <Field.Stepper
                label={UNIT_LABEL[line?.unitLabel ?? 'offices']}
                hint={overCapacity ? 'Beyond the largest standard size — we’ll quote it as a custom build.' : undefined}
                value={units}
                onChange={setUnits}
                min={1}
                max={99}
              />

              <Field.Stepper
                label="Restrooms"
                hint="We’ll pick the closest model that covers it."
                value={restrooms}
                onChange={setRestrooms}
                min={0}
                max={20}
              />
            </div>

            <div className="flex flex-col gap-card desktop:flex-row">
              <Pill variant="secondary" size="lg" onClick={() => setStep(1)}>
                Back
              </Pill>

              <Pill type="submit" variant="primary" size="lg" className="grow">
                Show my building
              </Pill>
            </div>
          </div>
        </Match>
      </Switch>
    </Card>
  )
}
