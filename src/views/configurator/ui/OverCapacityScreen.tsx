import { Blocks } from 'lucide-react'

import { Callout, CenteredPanel, Chip, PillLink } from '@/shared/ui/boxx'

type Props = {
  lineName: string
  requestedUnits: number
  /** Back to the quiz with this request still in it — "adjust", not "start over". */
  adjustHref: string
}

export function OverCapacityScreen({ lineName, requestedUnits, adjustHref }: Props) {
  return (
    <CenteredPanel as="main">
      <Chip tone="gold">Custom build</Chip>

      <Callout
        tone="notice"
        align="center"
        icon={<Blocks />}
        // Callout renders its title in a <p>, so the page keeps its h1 through ARIA.
        title={
          <span role="heading" aria-level={1}>
            That’s a big project — we like it.
          </span>
        }
        action={
          <PillLink href={adjustHref} variant="primary">
            Adjust request
          </PillLink>
        }
        className="max-w-lg"
      >
        {requestedUnits} units is beyond the largest standard {lineName} configuration. Our team
        will put together an individual proposal for you.
      </Callout>
    </CenteredPanel>
  )
}
