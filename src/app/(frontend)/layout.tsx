import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import type { PropsWithChildren } from 'react'

import { AppProviders } from '@/providers'

// General Sans is the BOXX brand face. Self-hosted rather than pulled from
// Fontshare's CDN: the configurator runs inside the client's iframe, which
// inherits nothing from the host cascade, and a third-party font request is
// exactly what a host CSP font-src blocks. One variable file covers Regular 400
// and Medium 500, the only two weights the design system uses.
const generalSans = localFont({
  src: '../fonts/GeneralSans-Variable.woff2',
  variable: '--font-boxx',
  weight: '200 700',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '3D Building Configurator',
  description: 'Configure a modular building and furnish it with furniture packages.',
  // One SVG for every size, and it carries its own dark-scheme rule — a tab
  // strip is the one place the page cannot tell the browser what colour to use.
  icons: [{ rel: 'icon', type: 'image/svg+xml', url: '/favicon.svg' }],
}

// Without viewportFit 'cover' iOS leaves dead bands beside the camera housing in
// landscape; overlay controls stay clear via env(safe-area-inset-*).
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: '#f9f7f4',
}

export default function FrontendLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" className={generalSans.variable}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
