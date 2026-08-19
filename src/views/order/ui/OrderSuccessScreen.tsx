import { CircleCheck } from 'lucide-react'

import { fillTokens } from '@/modules/shared/quiz-copy'
import type { SuccessCopy } from '@/modules/shared/order-success'
import { Callout, CenteredPanel, Chip, PillLink } from '@/shared/ui/boxx'

type Props = {
  reference: string
  copy: SuccessCopy
}

/**
 * Our own thank-you page, for when the admin has not named one of their own.
 *
 * A light page rather than the 3D view with a message over it: somebody who has
 * just pressed send is waiting to be told it worked, and making them wait on a
 * building model first would answer the wrong question slowly. The 3D view is
 * one press away.
 */
export function OrderSuccessScreen({ reference, copy }: Props) {
  return (
    <CenteredPanel as="main">
      <Chip tone="gold">Order {reference}</Chip>

      <Callout
        tone="success"
        align="center"
        icon={<CircleCheck />}
        // Callout renders its title in a <p>, so the page keeps its h1 through ARIA.
        title={
          <span role="heading" aria-level={1}>
            {copy.title}
          </span>
        }
        action={
          copy.showOrderLink ? (
            <PillLink href={`/order/${encodeURIComponent(reference)}`} variant="primary">
              {copy.viewOrderLabel}
            </PillLink>
          ) : undefined
        }
        className="max-w-lg"
      >
        {/* The order number only exists at the moment this is shown, so the
            sentence is a template rather than plain text. */}
        {fillTokens(copy.body, { reference })}
      </Callout>
    </CenteredPanel>
  )
}
