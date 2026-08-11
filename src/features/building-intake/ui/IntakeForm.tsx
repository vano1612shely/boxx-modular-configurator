'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import type { QuizCopy } from '@/modules/shared/quiz-copy'
import { Card, Eyebrow, Field, OptionGroup, Pill, Progress } from '@/shared/ui/boxx'
import { Match, Show, Switch } from '@/shared/ui/control-flow'

import type { IntakeAnswers } from '../lib/intake-href'

export type IntakeLine = {
  slug: string
  name: string
  unitLabel: 'offices' | 'classrooms'
  maxUnits: number | null
}

type Props = {
  lines: IntakeLine[]
  /** Carried straight through, or the next screen forgets which catalogue it is showing. */
  region?: string
  /** Answers to open on, when the visitor came back to change them. */
  answers?: IntakeAnswers
  /** Headings, from the admin. Already resolved, so every string here is real. */
  copy: QuizCopy
}

const heading =
  'text-[1.5625rem] leading-[1.3] font-medium text-foreground desktop:text-[2.1875rem]'

/** Wraps at the reader's own line length, and keeps the blank lines it was typed with. */
const description = 'max-w-prose text-sm whitespace-pre-line text-muted-foreground'

export function IntakeForm({ lines, region, answers, copy }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  // Opens on step 1 rather than jumping to the sizing: the complaint was that
  // the earlier choice was gone, and seeing it still picked is the answer to it.
  //
  // A slug the catalogue no longer offers — a retired line, a different region —
  // would be submitted straight back and resolve to nothing, so it falls to the
  // first the same way an absent one does.
  const [lineSlug, setLineSlug] = useState(() =>
    answers?.line && lines.some((line) => line.slug === answers.line)
      ? answers.line
      : (lines[0]?.slug ?? ''),
  )
  const [units, setUnits] = useState(answers?.units ?? 2)
  const [restrooms, setRestrooms] = useState(answers?.restrooms ?? 0)

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
    if (region) params.set('region', region)
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
      <Show when={copy.logoUrl}>
        {(url) => (
          // Decorative: the question below it is the page's heading, and a brand
          // mark read out before it would only get in the way. Plain <img> for
          // the same reason MediaTile uses one — the file is served by this app
          // and sized in CSS, so a loader in front of it buys nothing.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-8 w-auto self-start object-contain" />
        )}
      </Show>

      <Progress step={step} total={2} />

      <Switch>
        <Match when={step === 1}>
          <div className="flex flex-col gap-block">
            <div className="flex flex-col gap-2">
              <Eyebrow>{copy.step1.eyebrow}</Eyebrow>
              <h1 className={heading}>{copy.step1.title}</h1>
              <Show when={copy.step1.description}>
                {(text) => <p className={description}>{text}</p>}
              </Show>
            </div>

            <OptionGroup
              label={copy.step1.listLabel}
              value={lineSlug}
              options={options}
              onChange={handlePick}
            />
          </div>
        </Match>

        <Match when={step === 2}>
          <div className="flex flex-col gap-block">
            <div className="flex flex-col gap-2">
              {/* Not editable: this is the line just picked, and saying anything
                  else here would lose the one thing it confirms. */}
              <Show when={line?.name}>
                <Eyebrow>{line?.name}</Eyebrow>
              </Show>
              <h1 className={heading}>{copy.step2.title}</h1>
              <Show when={copy.step2.description}>
                {(text) => <p className={description}>{text}</p>}
              </Show>
            </div>

            <div className="flex flex-col gap-card">
              <Field.Stepper
                label={
                  line?.unitLabel === 'classrooms'
                    ? copy.step2.classroomsLabel
                    : copy.step2.officesLabel
                }
                hint={overCapacity ? copy.step2.overCapacityHint : undefined}
                value={units}
                onChange={setUnits}
                min={1}
                max={99}
              />

              <Field.Stepper
                label={copy.step2.restroomsLabel}
                hint={copy.step2.restroomsHint}
                value={restrooms}
                onChange={setRestrooms}
                min={0}
                max={20}
              />
            </div>

            <div className="flex flex-col gap-card desktop:flex-row">
              <Pill variant="secondary" size="lg" onClick={() => setStep(1)}>
                {copy.step2.back}
              </Pill>

              <Pill type="submit" variant="primary" size="lg" className="grow">
                {copy.step2.submit}
              </Pill>
            </div>
          </div>
        </Match>
      </Switch>
    </Card>
  )
}
