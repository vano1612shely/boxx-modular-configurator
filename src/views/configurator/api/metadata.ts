import type { Metadata } from 'next'

import { getPageMeta } from '@/modules/settings/lib/read-settings'

/**
 * The page's own tags, its Open Graph pair and its icon, from the admin.
 *
 * `openGraph` repeats the title and description rather than leaving them to be
 * inherited: Next only falls back to the page title for og:title when no
 * `openGraph` object is given at all, and this one has to carry an image.
 *
 * An absent picture is left absent. A link that unfurls bare says nothing; one
 * that unfurls with a placeholder says the wrong thing.
 */
export async function configuratorMetadata(): Promise<Metadata> {
  const meta = await getPageMeta()

  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      type: 'website',
      title: meta.title,
      description: meta.description,
      ...(meta.ogImageUrl ? { images: [{ url: meta.ogImageUrl }] } : {}),
    },
    twitter: {
      card: meta.ogImageUrl ? 'summary_large_image' : 'summary',
      title: meta.title,
      description: meta.description,
      ...(meta.ogImageUrl ? { images: [meta.ogImageUrl] } : {}),
    },
    ...(meta.faviconUrl
      ? {
          icons: {
            icon: [{ url: meta.faviconUrl, ...(meta.faviconType ? { type: meta.faviconType } : {}) }],
          },
        }
      : {}),
  }
}
