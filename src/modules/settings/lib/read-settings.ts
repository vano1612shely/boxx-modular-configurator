import { getPayload } from 'payload'

import config from '@payload-config'

import { assetUrl, type AreaUnit } from '@/shared/lib'

import { PAGE_META_DEFAULTS, type PageMeta } from '../../shared/page-meta'
import { textOr } from '../../shared/text-or'

/**
 * What a link to this app says about itself.
 *
 * The title and description are written once and used for both the page's own
 * tags and the Open Graph pair, because they answer the same question and a
 * second copy would only be the one somebody forgot to update. Pictures have no
 * fallback: a link is better unfurled bare than with the wrong image.
 */
export async function getPageMeta(): Promise<PageMeta> {
  const payload = await getPayload({ config })
  const settings = await payload.findGlobal({ slug: 'configurator-settings', depth: 1 })
  const meta = settings.meta ?? {}

  const favicon = typeof meta.favicon === 'object' ? meta.favicon : null

  return {
    title: textOr(meta.title, PAGE_META_DEFAULTS.title),
    description: textOr(meta.description, PAGE_META_DEFAULTS.description),
    ogImageUrl: typeof meta.ogImage === 'object' ? assetUrl(meta.ogImage) : null,
    faviconUrl: assetUrl(favicon),
    faviconType: typeof favicon?.mimeType === 'string' ? favicon.mimeType : null,
  }
}

/**
 * The unit floor areas open in.
 *
 * A site-wide default rather than a per-building one: it is a fact about who is
 * reading, not about the building, and an admin should not have to set it on
 * every size. The visitor may override it for their own session.
 */
export async function getDefaultAreaUnit(): Promise<AreaUnit> {
  const payload = await getPayload({ config })
  const settings = await payload.findGlobal({ slug: 'configurator-settings' })

  return settings.areaUnit === 'sqm' ? 'sqm' : 'sqft'
}
