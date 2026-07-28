import type { PropsWithChildren } from 'react'

import './styles/globals.css'

/** Root composition point for global providers (theme, i18n, …). */
export function AppProviders({ children }: PropsWithChildren) {
  return children
}
