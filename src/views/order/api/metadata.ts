import type { Metadata } from 'next'

import { getPageMeta } from '@/modules/settings/lib/read-settings'

/**
 * What a saved order's page says about itself.
 *
 * Not the reference, and no Open Graph pair: the link is meant to be forwarded
 * privately, and a page that unfurls the order number into a chat preview — or
 * lets a search engine keep a copy — undoes the one thing that makes handing
 * the link out safe. The icon and the title are the site's; nothing here is
 * about this particular order.
 */
export async function orderMetadata(): Promise<Metadata> {
  const meta = await getPageMeta()

  return {
    title: `Your order · ${meta.title}`,
    description: meta.description,
    robots: { index: false, follow: false },
    ...(meta.faviconUrl
      ? {
          icons: {
            icon: [{ url: meta.faviconUrl, ...(meta.faviconType ? { type: meta.faviconType } : {}) }],
          },
        }
      : {}),
  }
}
