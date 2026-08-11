/**
 * What a link to the configurator says about itself.
 *
 * Same two lines twice over: a page title and description are what a search
 * result shows, and og:title and og:description are what a chat window shows.
 * Asking an admin to write both pairs would only invite them to drift apart —
 * one written and one forgotten is worse than one written well.
 */
export const PAGE_META_DEFAULTS = {
  title: '3D Building Configurator',
  description: 'Configure a modular building and furnish it with furniture packages.',
} as const

export type PageMeta = {
  title: string
  description: string
  /** The picture a shared link unfurls with, or null to unfurl without one. */
  ogImageUrl: string | null
  /** Tab icon. Null falls back to whatever the app serves at /favicon.ico. */
  faviconUrl: string | null
  /** Content type of the favicon, so the browser is not left guessing. */
  faviconType: string | null
}
