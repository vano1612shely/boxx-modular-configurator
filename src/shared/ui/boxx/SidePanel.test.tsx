import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SidePanel, type SidePanelRailItem } from './SidePanel'

afterEach(cleanup)

const SPOTS: SidePanelRailItem[] = [
  { key: 'a', icon: '1', label: 'Entrance 1', active: true, onSelect: () => {} },
  { key: 'b', icon: '2', label: 'Entrance 2', onSelect: () => {} },
]

function panel(props: Partial<Parameters<typeof SidePanel>[0]> = {}) {
  return render(
    <SidePanel
      icon={<span data-testid="mark" />}
      title="Entrances"
      subtitle="Decks, stairs and ramps"
      meta="2 spots"
      badge={2}
      collapsed={false}
      onToggle={() => {}}
      rail={SPOTS}
      {...props}
    >
      <p>the choices</p>
    </SidePanel>,
  )
}

describe('open', () => {
  it('shows what it is and what is in it', () => {
    panel()
    expect(screen.getByRole('heading', { name: 'Entrances' })).toBeDefined()
    expect(screen.getByText('Decks, stairs and ramps · 2 spots')).toBeDefined()
    expect(screen.getByText('the choices')).toBeDefined()
  })

  // The quote button floats over the scene's top right corner and lands on this
  // one. Anything to the right of the title is behind it and may as well not be
  // drawn — the count goes in the subtitle line, the close button at the front.
  it('keeps the close button clear of the corner the quote button claims', () => {
    panel()
    const header = screen.getByRole('heading', { name: 'Entrances' }).closest('header')
    const close = screen.getByRole('button', { name: 'Hide entrances' })
    expect(header?.firstElementChild).toBe(close)
  })

  // The rail is what the panel shrinks *to*; drawing it alongside the open
  // panel would offer the same two entrances twice, in two shapes.
  it('does not also draw the rail', () => {
    panel()
    expect(screen.queryByRole('button', { name: 'Entrance 2' })).toBeNull()
  })

  it('can be shut', () => {
    const onToggle = vi.fn()
    panel({ onToggle })
    screen.getByRole('button', { name: 'Hide entrances' }).click()
    expect(onToggle).toHaveBeenCalledOnce()
  })
})

describe('shrunk', () => {
  it('keeps the way back to each section, and the way back open', () => {
    panel({ collapsed: true })
    expect(screen.getByRole('button', { name: 'Show entrances' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Entrance 1' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Entrance 2' })).toBeDefined()
  })

  // The whole point of shrinking: the panel's contents stop taking the screen.
  it('drops the body', () => {
    panel({ collapsed: true })
    expect(screen.queryByText('the choices')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Entrances' })).toBeNull()
  })

  // The complaint that produced the rail's contents: shut, it was a white strip
  // that said nothing at all. It has to name itself and count what it holds.
  it('still says what it is and how much is in it', () => {
    panel({ collapsed: true })
    const strip = screen.getByRole('button', { name: 'Show entrances' })
    expect(strip.textContent).toContain('Entrances')
    expect(strip.textContent).toContain('2')
  })

  // Nothing to count is not a zero: an empty room would read as a failure.
  it('leaves the count off when there is none', () => {
    panel({ collapsed: true, badge: null })
    expect(screen.getByRole('button', { name: 'Show entrances' }).textContent).toBe('Entrances')
  })

  it('says which section is the open one', () => {
    panel({ collapsed: true })
    expect(screen.getByRole('button', { name: 'Entrance 1' }).getAttribute('aria-current')).toBe(
      'true',
    )
    expect(
      screen.getByRole('button', { name: 'Entrance 2' }).getAttribute('aria-current'),
    ).toBeNull()
  })

  it('takes a section by name', () => {
    const onSelect = vi.fn()
    panel({ collapsed: true, rail: [SPOTS[0], { ...SPOTS[1], onSelect }] })
    screen.getByRole('button', { name: 'Entrance 2' }).click()
    expect(onSelect).toHaveBeenCalledOnce()
  })

  // A single entrance, or an undivided room: a menu of one is not a menu, and
  // its one button would do exactly what the panel's own mark already does.
  it('offers no menu when there is nothing to choose between', () => {
    panel({ collapsed: true, rail: [SPOTS[0]] })
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show entrances' })).toBeDefined()
  })
})
