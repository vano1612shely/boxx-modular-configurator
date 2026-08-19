export type SuccessTarget =
  /** Somewhere in this app — Next can navigate to it without a page load. */
  | { kind: 'internal'; href: string }
  /** Somebody else's site, which has to be reached through the browser. */
  | { kind: 'external'; href: string }

/** Our own thank-you page: the order's own page, told that it has just been placed. */
function ownPage(reference: string): SuccessTarget {
  return { kind: 'internal', href: `/order/${encodeURIComponent(reference)}?submitted=1` }
}

/**
 * Where a finished request should land.
 *
 * The address is typed into an admin box and is about to be handed to
 * `window.location`, so it is treated as untrusted however it got there:
 * `javascript:` there is script running on our own origin, and `//evil.example`
 * is a protocol-relative jump off it. Only http(s) and a plain same-origin path
 * survive; anything else falls back to our own page, which is the same answer
 * as leaving the box empty.
 *
 * Checked here rather than only in the admin because the column can hold a
 * value typed before the field had a validator, or written straight to the
 * database — and this is the moment that actually matters.
 */
export function successTarget(
  redirectUrl: string | null | undefined,
  reference: string,
): SuccessTarget {
  const raw = redirectUrl?.trim() ?? ''

  // Without a reference our own page has no order to open, so an admin URL is
  // the only place left to go — and if there is no admin URL either, the caller
  // shows the confirmation in place rather than navigating to a broken link.
  if (raw === '') return ownPage(reference)

  // A single leading slash, not two: "//host" is a URL, not a path.
  if (raw.startsWith('/') && !raw.startsWith('//')) return { kind: 'internal', href: raw }

  try {
    const parsed = new URL(raw)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return { kind: 'external', href: parsed.toString() }
    }
  } catch {
    // Not a URL at all. Falls through to our own page below.
  }

  return ownPage(reference)
}
