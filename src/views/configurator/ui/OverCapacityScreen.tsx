import { Blocks } from 'lucide-react'

import { fillTokens, type QuizCopy } from '@/modules/shared/quiz-copy'
import { Callout, CenteredPanel, Chip, PillLink } from '@/shared/ui/boxx'

type Props = {
  lineName: string
  requestedUnits: number
  /** Back to the quiz with this request still in it — "adjust", not "start over". */
  adjustHref: string
  copy: QuizCopy['overCapacity']
}

export function OverCapacityScreen({ lineName, requestedUnits, adjustHref, copy }: Props) {
  return (
    <CenteredPanel as="main">
      <Chip tone="gold">{copy.chip}</Chip>

      <Callout
        tone="notice"
        align="center"
        icon={<Blocks />}
        // Callout renders its title in a <p>, so the page keeps its h1 through ARIA.
        title={
          <span role="heading" aria-level={1}>
            {copy.title}
          </span>
        }
        action={
          <PillLink href={adjustHref} variant="primary">
            {copy.action}
          </PillLink>
        }
        className="max-w-lg"
      >
        {/* The figures only exist at the moment this is shown, so the sentence
            is a template rather than plain text. */}
        {fillTokens(copy.body, { units: String(requestedUnits), line: lineName })}
      </Callout>
    </CenteredPanel>
  )
}
