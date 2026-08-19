import { textOr } from './text-or'

/**
 * What the visitor is told once a quote request has gone through.
 *
 * One definition, used twice: as the default value of each field in the admin,
 * and as the fallback when a field has been emptied — the same bargain
 * `QUIZ_COPY_DEFAULTS` makes, and for the same reason. A thank-you page that
 * renders blank because somebody cleared a box is worse than one nobody has
 * edited yet.
 */
export const ORDER_SUCCESS_DEFAULTS = {
  title: 'Your quote request has been sent.',
  body: 'The team will get back to you shortly. Your order number is {reference}.',
  viewOrderLabel: 'View your configuration',
} as const

export type SuccessCopy = {
  title: string
  /** Carries `{reference}`. */
  body: string
  /** Whether the thank-you page offers a way into the saved 3D view. */
  showOrderLink: boolean
  viewOrderLabel: string
}

/** The `success` group as it comes off the global, whichever era wrote the row. */
type SuccessGroup = {
  redirectUrl?: string | null
  title?: string | null
  body?: string | null
  showOrderLink?: boolean | null
  viewOrderLabel?: string | null
}

type SettingsDoc = { success?: SuccessGroup | null }

/**
 * Read defensively rather than trusted: the group was added after the settings
 * row existed, so a row written before it holds nothing at all there.
 */
export function resolveSuccessCopy(settings: SettingsDoc): SuccessCopy {
  const success = settings.success ?? {}

  return {
    title: textOr(success.title, ORDER_SUCCESS_DEFAULTS.title),
    body: textOr(success.body, ORDER_SUCCESS_DEFAULTS.body),
    // `!== false` rather than a plain truth test: null means "nobody has said
    // otherwise", and the link is the useful default.
    showOrderLink: success.showOrderLink !== false,
    viewOrderLabel: textOr(success.viewOrderLabel, ORDER_SUCCESS_DEFAULTS.viewOrderLabel),
  }
}

/** Where to send the visitor instead of our own page, or null to use ours. */
export function resolveRedirectUrl(settings: SettingsDoc): string | null {
  const url = settings.success?.redirectUrl
  return typeof url === 'string' && url.trim() !== '' ? url.trim() : null
}
