/**
 * A coarse pointer is the honest proxy for "this is a phone or a tablet", and
 * so for a GPU that will not swallow a desktop render budget. Media queries beat
 * user-agent sniffing here: a touch laptop reports fine, a phone reports coarse.
 */
export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(pointer: coarse)').matches
}
