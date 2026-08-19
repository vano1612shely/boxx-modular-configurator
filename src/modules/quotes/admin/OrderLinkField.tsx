'use client'

import { useFormFields } from '@payloadcms/ui'

/**
 * The customer's own link to this order, ready to copy.
 *
 * Here rather than in the description of the reference field: an admin about to
 * paste a link into an email should not have to assemble it from a pattern and
 * a code, and the one thing they can get wrong that way is the thing that makes
 * the link fail.
 */
export function OrderLinkField() {
  const reference = useFormFields(([fields]) => fields.reference?.value)

  if (typeof reference !== 'string' || reference === '') {
    return (
      <p style={{ color: 'var(--theme-elevation-500)', fontSize: 13, marginBottom: 16 }}>
        The link appears once this quote has been saved.
      </p>
    )
  }

  const href = `/order/${reference}`

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="field-label" style={{ marginBottom: 4 }}>
        3D view
      </div>
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>
        {href}
      </a>
      <p style={{ color: 'var(--theme-elevation-500)', fontSize: 13, margin: '4px 0 0' }}>
        Opens the saved configuration in the 3D view. Anyone with this link can look at it, so it
        carries no contact details.
      </p>
    </div>
  )
}
