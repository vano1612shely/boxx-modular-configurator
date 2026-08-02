import type { CSSProperties } from 'react'

import type { WallSide } from '@/entities/building'

export const tone = {
  shell: '#0f1012',
  panel: '#141518',
  card: '#1b1d21',
  well: '#111215',
  field: '#1f2227',
  raised: '#22252b',

  line: '#23262c',
  lineSoft: '#2a2e34',
  lineStrong: '#33383f',

  text: '#e7e9ec',
  textMuted: '#9aa1ab',
  textFaint: '#7d848e',

  accent: '#3b82f6',
  danger: '#f87171',
  roof: '#ef4444',
  node: '#a78bfa',
} as const

export const SIDE_COLORS: Record<WallSide, string> = {
  w1: '#f97316',
  w2: '#38bdf8',
  w3: '#a78bfa',
  w4: '#4ade80',
}

export const s: Record<string, CSSProperties> = {
  sidebar: {
    width: 340,
    flexShrink: 0,
    overflowY: 'auto',
    background: tone.panel,
    color: tone.text,
    display: 'flex',
    flexDirection: 'column',
    fontSize: 13,
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    background: tone.panel,
    borderBottom: `1px solid ${tone.line}`,
  },
  title: { fontSize: 14, fontWeight: 600, margin: 0, lineHeight: 1.2 },
  eyebrow: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: tone.textFaint,
    margin: 0,
  },
  heading: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: tone.textMuted,
    margin: 0,
  },
  hint: { fontSize: 12, color: '#818893', margin: 0, lineHeight: 1.45 },
  row: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  toolRow: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  card: {
    background: tone.card,
    border: `1px solid ${tone.lineSoft}`,
    borderRadius: 8,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardSelected: {
    background: '#1d2a22',
    border: '1px solid #35553f',
    borderRadius: 8,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  selectionCard: {
    margin: '10px 12px 0',
    padding: 10,
    background: '#1a2030',
    border: '1px solid #2e3a55',
    borderRadius: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  label: { fontSize: 10, color: tone.textFaint },
  input: {
    background: tone.field,
    border: `1px solid ${tone.lineStrong}`,
    color: tone.text,
    borderRadius: 6,
    padding: '6px 8px',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box',
  },
  inputTiny: {
    background: tone.field,
    border: `1px solid ${tone.lineStrong}`,
    color: tone.text,
    borderRadius: 6,
    padding: '4px 6px',
    fontSize: 12,
    width: 62,
    boxSizing: 'border-box',
  },
  select: {
    background: tone.field,
    border: `1px solid ${tone.lineStrong}`,
    color: tone.text,
    borderRadius: 6,
    padding: '6px 8px',
    fontSize: 13,
  },
  list: {
    maxHeight: 260,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    background: tone.well,
    border: '1px solid #26292f',
    borderRadius: 8,
    padding: 4,
  },
  listRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    background: tone.well,
    border: '1px solid #22333f',
    borderRadius: 6,
    padding: '5px 7px',
    flexShrink: 0,
  },
  mono: { fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#c7d3dd' },
  danger: {
    background: 'transparent',
    color: tone.danger,
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    padding: 0,
  },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  body: { padding: '2px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 },
  accordion: { borderBottom: `1px solid ${tone.line}` },
  accordionHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '11px 14px',
    color: '#c9ced6',
    fontSize: 11.5,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'left',
  },
  accordionBadge: {
    marginLeft: 'auto',
    background: tone.raised,
    border: `1px solid ${tone.lineStrong}`,
    borderRadius: 10,
    padding: '1px 8px',
    fontSize: 11,
    color: tone.textMuted,
    fontWeight: 500,
    letterSpacing: 0,
  },
  footer: {
    position: 'sticky',
    bottom: 0,
    marginTop: 'auto',
    padding: '10px 14px',
    background: tone.panel,
    borderTop: `1px solid ${tone.line}`,
    display: 'flex',
    gap: 6,
  },
  segmentGroup: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  segmentTrack: {
    display: 'inline-flex',
    gap: 2,
    padding: 2,
    background: tone.card,
    border: `1px solid ${tone.lineSoft}`,
    borderRadius: 8,
  },
}

export function toolButton(active: boolean): CSSProperties {
  return {
    background: active ? tone.accent : tone.raised,
    color: active ? '#fff' : '#cfd3d9',
    border: `1px solid ${active ? tone.accent : tone.lineStrong}`,
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 12.5,
    cursor: 'pointer',
  }
}

export function button(kind: 'primary' | 'ghost' | 'danger' = 'ghost'): CSSProperties {
  return {
    background: kind === 'primary' ? tone.accent : tone.raised,
    color: kind === 'primary' ? '#fff' : kind === 'danger' ? tone.danger : '#cfd3d9',
    border: `1px solid ${kind === 'primary' ? tone.accent : tone.lineStrong}`,
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    cursor: 'pointer',
  }
}

export function segmentItem(active: boolean): CSSProperties {
  return {
    background: active ? tone.accent : 'transparent',
    color: active ? '#fff' : tone.textMuted,
    border: 'none',
    borderRadius: 6,
    padding: '4px 9px',
    fontSize: 11.5,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}

export function blockRowStyle(selected: boolean): CSSProperties {
  return {
    background: selected ? '#1e2f4d' : 'transparent',
    color: selected ? '#dbeafe' : '#c3c8cf',
    border: 'none',
    borderRadius: 5,
    cursor: 'pointer',
    fontSize: 11.5,
    textAlign: 'left',
    padding: '3px 6px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontFamily: 'ui-monospace, monospace',
    flexShrink: 0,
    flex: 1,
    minWidth: 0,
  }
}

export const rowActionStyle: CSSProperties = {
  background: 'transparent',
  color: '#6b7280',
  border: 'none',
  cursor: 'pointer',
  fontSize: 11,
  padding: '2px 5px',
  flexShrink: 0,
}

export function nodeRow(depth: number, selected: boolean, hidden: boolean): CSSProperties {
  return {
    background: selected ? '#4c1d95' : 'transparent',
    color: selected ? '#ede9fe' : hidden ? '#5d636d' : '#c3c8cf',
    border: 'none',
    borderRadius: 5,
    cursor: 'pointer',
    fontSize: 11.5,
    textAlign: 'left',
    padding: '3px 6px',
    paddingLeft: 6 + Math.min(depth, 10) * 12,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontFamily: 'ui-monospace, monospace',
    textDecoration: hidden ? 'line-through' : 'none',
    // Form elements have no automatic min-content protection: in a height-capped
    // flex column the buttons would be crushed to their padding.
    flexShrink: 0,
  }
}
