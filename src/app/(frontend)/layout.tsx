import type { PropsWithChildren } from 'react'

import { AppProviders } from '@/providers'

export const metadata = {
  title: '3D Building Configurator',
  description: 'Configure a modular building and furnish it with furniture packages.',
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
