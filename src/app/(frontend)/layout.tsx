import type { Metadata, Viewport } from 'next'
import type { PropsWithChildren } from 'react'

import { AppProviders } from '@/providers'

export const metadata: Metadata = {
  title: '3D Building Configurator',
  description: 'Configure a modular building and furnish it with furniture packages.',
}

// Without viewportFit 'cover' iOS leaves dead bands beside the camera housing in
// landscape; overlay controls stay clear via env(safe-area-inset-*).
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: '#f2f3f5',
}

export default function FrontendLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
