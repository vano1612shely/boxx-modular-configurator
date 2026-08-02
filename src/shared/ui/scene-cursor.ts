export type SceneCursor =
  | 'default'
  | 'orbiting'
  | 'movable'
  | 'moving'

function cursor(svg: string, hotX: number, hotY: number, fallback: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}") ${hotX} ${hotY}, ${fallback}`
}

const POINTER = `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <path d="M7 4.2 L20.4 13.6 A1.3 1.3 0 0 1 19.9 15.9 L14.6 16.9 L17.3 22.1 A1.3 1.3 0 0 1 15 23.3 L12.2 17.9 L8.6 21.5 A1.3 1.3 0 0 1 6.4 20.6 L6.4 5.3 A1.3 1.3 0 0 1 7 4.2 Z"
        fill="#ffffff" stroke="#20242b" stroke-width="1.6" stroke-linejoin="round"/>
  <circle cx="9.2" cy="8.4" r="1.15" fill="#20242b"/>
</svg>`

const MOVABLE = `
<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
  <g fill="#ffffff" stroke="#20242b" stroke-width="1.6" stroke-linejoin="round">
    <path d="M15 2.4 18.4 7 16.4 7 16.4 13.4 13.6 13.4 13.6 7 11.6 7 Z"/>
    <path d="M15 27.6 11.6 23 13.6 23 13.6 16.6 16.4 16.6 16.4 23 18.4 23 Z"/>
    <path d="M2.4 15 7 11.6 7 13.6 13.4 13.6 13.4 16.4 7 16.4 7 18.4 Z"/>
    <path d="M27.6 15 23 18.4 23 16.4 16.6 16.4 16.6 13.6 23 13.6 23 11.6 Z"/>
  </g>
</svg>`

const MOVING = `
<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
  <circle cx="15" cy="15" r="5.4" fill="#20242b" opacity="0.22"/>
  <g fill="#20242b" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round">
    <path d="M15 2.4 18.4 7 16.4 7 16.4 13.4 13.6 13.4 13.6 7 11.6 7 Z"/>
    <path d="M15 27.6 11.6 23 13.6 23 13.6 16.6 16.4 16.6 16.4 23 18.4 23 Z"/>
    <path d="M2.4 15 7 11.6 7 13.6 13.4 13.6 13.4 16.4 7 16.4 7 18.4 Z"/>
    <path d="M27.6 15 23 18.4 23 16.4 16.6 16.4 16.6 13.6 23 13.6 23 11.6 Z"/>
  </g>
</svg>`

const STYLES: Record<SceneCursor, string> = {
  default: cursor(POINTER, 7, 4, 'auto'),
  orbiting: 'grabbing',
  movable: cursor(MOVABLE, 15, 15, 'move'),
  moving: cursor(MOVING, 15, 15, 'grabbing'),
}

let surface: HTMLElement | null = null
let current: SceneCursor = 'default'

function apply() {
  if (surface) surface.style.cursor = STYLES[current]
}

export function bindSceneCursor(element: HTMLElement | null) {
  surface = element
  apply()
}

export function setSceneCursor(next: SceneCursor) {
  if (next === current) return
  current = next
  apply()
}
