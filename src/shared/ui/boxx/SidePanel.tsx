'use client'

import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/shared/lib'
import { For, Show } from '@/shared/ui/control-flow'

import { Chip, Eyebrow } from './Chip'
import { OVERLAY_Z } from './FloatingBar'

/**
 * How far this panel reaches in from the right, in px, for anything drawn over
 * the scene that has to centre itself on what is left of it.
 *
 * Published rather than declared because the answer is not a constant: it is one
 * of two widths depending on the breakpoint, a rail when the panel is shut,
 * nothing at all on a phone or when no panel is mounted, and every value in
 * between for the 300ms the width is animating. The one reader is the view bar.
 */
const PANEL_WIDTH = '--scene-panel'

/** One entry of the rail — a way back into a section of the panel it stands for. */
export type SidePanelRailItem = {
  key: string
  /** Drawn inside a 40px square, so a glyph or a short numeral. */
  icon: ReactNode
  /** The name the collapsed rail cannot show. Tooltip and accessible name. */
  label: string
  active?: boolean
  onSelect: () => void
}

export type SidePanelProps = {
  icon: ReactNode
  title: string
  subtitle?: ReactNode
  /** A count or similar, said after the subtitle. */
  meta?: ReactNode
  /** The one figure worth carrying down into the rail. Omitted when it is nothing. */
  badge?: ReactNode
  collapsed: boolean
  onToggle: () => void
  /** Shown down the rail when there is more than one, since one is no choice. */
  rail?: SidePanelRailItem[]
  children: ReactNode
}

/** Never narrower than a comfortable touch target, and the whole width when shut. */
const RAIL = 'w-14'
const OPEN = 'w-[22rem] lg:w-[26rem]'

/**
 * Down to below the quote button, which floats over the scene's top right corner
 * and lands on this panel — on the header when it is open, on the rail's own
 * chevron when it is shut. 1rem of inset, half a bar's padding to put it on the
 * header's line, a 2.75rem pill, and a gap.
 */
const CLEAR_OF_QUOTE = 'pt-[4.75rem]'

const railButton = (active: boolean) =>
  cn(
    'flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
    active
      ? 'bg-secondary text-foreground'
      : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
  )

/**
 * The panel down the right of the scene, in either of its two widths.
 *
 * Shut it is a rail that still says what it is and how much is in it — its mark,
 * its count, its name down the edge — rather than a blank strip the visitor has
 * to click to identify. The width is animated and the contents are clipped
 * rather than reflowed, so the open panel slides out from under the rail instead
 * of squeezing its own text through every width on the way.
 *
 * Everything that has to be read or pressed is kept to the left of the panel:
 * the quote button floats over the scene's top right corner and lands on top of
 * this one, which is exactly where a close button would otherwise go.
 *
 * Desktop only — a phone gets the bottom sheet each feature draws for itself,
 * which already has this in the form of a drawer.
 */
export function SidePanel({
  icon,
  title,
  subtitle,
  meta,
  badge,
  collapsed,
  onToggle,
  rail = [],
  children,
}: SidePanelProps) {
  const name = title.toLowerCase()
  const panel = useRef<HTMLElement>(null)

  // Watched rather than derived from `collapsed`: a resize observer answers for
  // the breakpoint and for every frame of the width animation as well, and it
  // reports 0 by itself on a phone, where the panel is not displayed.
  useEffect(() => {
    const element = panel.current
    if (!element) return

    const root = element.ownerDocument.documentElement
    const publish = () => root.style.setProperty(PANEL_WIDTH, `${element.offsetWidth}px`)
    const observer = new ResizeObserver(publish)

    publish()
    observer.observe(element)

    return () => {
      observer.disconnect()
      root.style.setProperty(PANEL_WIDTH, '0px')
    }
  }, [])

  return (
    <aside
      ref={panel}
      data-scene-chrome=""
      style={{ zIndex: OVERLAY_Z.bar }}
      className={cn(
        'absolute top-0 right-0 hidden h-full flex-col overflow-hidden border-l border-border',
        'bg-background/95 backdrop-blur desktop:flex',
        'transition-[width] duration-300 ease-out',
        collapsed ? RAIL : OPEN,
      )}
    >
      <Show
        when={collapsed}
        fallback={
          <div className={cn('flex h-full shrink-0 flex-col', OPEN)}>
            <header
              className={cn(
                'flex items-center gap-2 border-b border-border pr-5 pb-4 pl-3',
                CLEAR_OF_QUOTE,
              )}
            >
              <button
                type="button"
                onClick={onToggle}
                aria-expanded
                title={`Hide ${name}`}
                aria-label={`Hide ${name}`}
                className={railButton(false)}
              >
                <PanelRightClose size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg leading-normal font-medium">{title}</h2>
                <Show when={subtitle || meta}>
                  <Eyebrow className="truncate">
                    {subtitle}
                    <Show when={subtitle && meta}>{' · '}</Show>
                    {meta}
                  </Eyebrow>
                </Show>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          </div>
        }
      >
        <div
          className={cn(
            'flex h-full shrink-0 flex-col items-center gap-2 pb-4',
            RAIL,
            CLEAR_OF_QUOTE,
          )}
        >
          {/* The whole strip opens the panel, so the name written down it is a
              target as well as a label — a rail of one small chevron would be a
              40px button in a 56px column of nothing. */}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={false}
            title={`Show ${name}`}
            aria-label={`Show ${name}`}
            className="group flex min-h-0 w-full flex-1 flex-col items-center gap-2 focus-visible:outline-none"
          >
            <span
              className={cn(
                railButton(false),
                'group-hover:bg-secondary/70 group-hover:text-foreground',
                'group-focus-visible:ring-2 group-focus-visible:ring-ring',
              )}
            >
              <PanelRightOpen size={18} />
            </span>
            <span className="flex shrink-0 items-center text-foreground">{icon}</span>
            <Show when={badge}>
              <Chip tone="ink" size="xs">
                {badge}
              </Chip>
            </Show>
            {/* Reads top to bottom with the head tipped right, the way a tab on
                this edge of anything is read. */}
            <span className="min-h-0 flex-1 truncate text-xs tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
              {title}
            </span>
          </button>

          <Show when={rail.length > 1}>
            <span aria-hidden className="h-px w-6 shrink-0 rounded-full bg-border" />
            <nav aria-label={title} className="flex shrink-0 flex-col items-center gap-1">
              <For each={rail} getKey={(item) => item.key}>
                {(item) => (
                  <button
                    type="button"
                    onClick={item.onSelect}
                    aria-current={item.active ? 'true' : undefined}
                    title={item.label}
                    aria-label={item.label}
                    className={railButton(item.active ?? false)}
                  >
                    {item.icon}
                  </button>
                )}
              </For>
            </nav>
          </Show>
        </div>
      </Show>
    </aside>
  )
}
