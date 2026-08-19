import { SearchX } from 'lucide-react'

import { Callout, CenteredPanel } from '@/shared/ui/boxx'

/**
 * One wording for every way this page can fail to show an order.
 *
 * No such reference, a reference that is real but whose building has since been
 * deleted, and a serial id typed by somebody who is not signed in all land here
 * saying the same thing. Distinguishing them would be more helpful to whoever
 * is counting through ids than to the customer.
 */
export function OrderUnavailableScreen() {
  return (
    <CenteredPanel as="main">
      <Callout
        tone="notice"
        align="center"
        icon={<SearchX />}
        // Callout renders its title in a <p>, so the page keeps its h1 through ARIA.
        title={
          <span role="heading" aria-level={1}>
            This order cannot be shown
          </span>
        }
        className="max-w-md"
      >
        The link may be incomplete, or the configuration behind it is no longer available. Please
        check the link you were sent, or get in touch and we will send a new one.
      </Callout>
    </CenteredPanel>
  )
}
