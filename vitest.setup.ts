import 'dotenv/config'

/**
 * jsdom does no layout, and so ships no ResizeObserver.
 *
 * A component that watches its own box needs the constructor to exist to mount
 * at all. Nothing in jsdom ever changes size, so a stub that never calls back is
 * not a lie about the environment — it is the environment.
 */
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
