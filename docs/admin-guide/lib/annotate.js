/**
 * Screenshot annotation for the admin guide.
 *
 * Paste into the page, then call mark() for each thing a figure points at. The
 * rings are drawn over the live page rather than painted onto the PNG
 * afterwards, so they land exactly on the element even after a reflow, and the
 * numbers line up with the ones in the figure caption.
 *
 *   __guide.mark('#field-name', 1)
 *   __guide.mark('button[type=submit]', 2)
 *   __guide.text(24, 300, 'Drag here')      // a free-standing label
 *   __guide.clear()
 *
 * Selectors accept a "text=" prefix to match by visible label instead:
 *
 *   __guide.mark('text=Create New', 2)
 */

;(() => {
  const CHERRY = '#a80030'
  const LAYER = '__guide_layer'

  const layer = () => {
    let node = document.getElementById(LAYER)
    if (node) return node
    node = document.createElement('div')
    node.id = LAYER
    node.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;pointer-events:none;'
    document.body.appendChild(node)
    return node
  }

  /** Smallest element whose own text is the wanted label. */
  const byText = (wanted) => {
    const want = wanted.trim().toLowerCase()
    const all = [...document.querySelectorAll('button, a, label, th, h1, h2, h3, p, span, div')]
    const hits = all.filter((node) => (node.textContent ?? '').trim().toLowerCase() === want)
    return hits.sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0]
  }

  const find = (selector) =>
    selector.startsWith('text=') ? byText(selector.slice(5)) : document.querySelector(selector)

  const api = {
    /**
     * Rings `selector` and, if `label` is given, badges it with that number.
     *
     * `up` climbs that many parents first: the thing worth circling is often a
     * control's whole row — its caption and both buttons — and that row rarely
     * has a name of its own to select by.
     */
    mark(selector, label, { pad = 4, up = 0 } = {}) {
      let node = find(selector)
      if (!node) return `not found: ${selector}`
      for (let step = 0; step < up && node.parentElement; step += 1) node = node.parentElement

      const box = node.getBoundingClientRect()
      if (box.width === 0 && box.height === 0) return `not visible: ${selector}`

      // Clamped to the frame. A sidebar starts at x=0 and a full-bleed field
      // group can be wider than the column it sits in, so an un-clamped ring
      // loses the very edges that make it read as a rectangle.
      const EDGE = 3
      const clamp = (value, limit) => Math.max(EDGE, Math.min(value, limit - EDGE))
      const left = clamp(box.left - pad, window.innerWidth)
      const top = clamp(box.top - pad, window.innerHeight)
      const right = clamp(box.right + pad, window.innerWidth)
      const bottom = clamp(box.bottom + pad, window.innerHeight)

      const ring = document.createElement('div')
      ring.style.cssText = `position:absolute;
        left:${left}px; top:${top}px;
        width:${Math.max(0, right - left)}px; height:${Math.max(0, bottom - top)}px;
        border:3px solid ${CHERRY}; border-radius:8px;
        box-shadow:0 0 0 2px rgba(255,255,255,.9), 0 2px 12px rgba(168,0,48,.35);`
      layer().appendChild(ring)

      if (label === undefined) return 'ok'

      // Sat on the corner, and nudged inward when that corner is the frame's.
      const badge = document.createElement('div')
      badge.textContent = String(label)
      badge.style.cssText = `position:absolute;
        left:${Math.max(EDGE, left - 13)}px; top:${Math.max(EDGE, top - 13)}px;
        width:26px; height:26px; border-radius:50%;
        background:${CHERRY}; color:#fff; border:2px solid #fff;
        font:700 14px/22px "Segoe UI",Arial,sans-serif; text-align:center;
        box-shadow:0 2px 8px rgba(0,0,0,.3);`
      layer().appendChild(badge)

      return 'ok'
    },

    /** A standalone caption, for pointing at something with no element of its own. */
    text(x, y, words) {
      const label = document.createElement('div')
      label.textContent = words
      label.style.cssText = `position:absolute; left:${x}px; top:${y}px;
        padding:4px 10px; border-radius:6px; background:${CHERRY}; color:#fff;
        font:600 13px "Segoe UI",Arial,sans-serif;
        box-shadow:0 2px 8px rgba(0,0,0,.3);`
      layer().appendChild(label)
      return 'ok'
    },

    clear() {
      document.getElementById(LAYER)?.remove()
      return 'cleared'
    },
  }

  window.__guide = api
  return 'ready'
})()
