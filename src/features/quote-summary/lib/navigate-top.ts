/**
 * Leaves for another site, taking the whole tab where the tab is ours to take.
 *
 * The configurator usually runs inside the client's own page, and redirecting
 * only the iframe would leave the customer looking at somebody else's site in a
 * box in the middle of a BOXX page. So the top window is asked first.
 *
 * Reading `window.top.location` across origins throws, which is the browser
 * saying the parent is not ours to navigate — the right answer then is the
 * frame we do own, so the visitor at least arrives. The host page can do better
 * if it wants to: the `configurator:redirect` message goes out first, and a host
 * that listens for it can move its own page.
 */
export function navigateTop(href: string) {
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = href
      return
    }
  } catch {
    // Cross-origin parent. Fall through to the frame we are in.
  }

  window.location.assign(href)
}
