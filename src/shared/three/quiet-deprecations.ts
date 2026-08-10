import { getConsoleFunction, setConsoleFunction } from 'three'

/**
 * Deprecation warnings three.js raises about code that is not ours.
 *
 * `THREE.Clock` was deprecated in favour of `THREE.Timer` in r183, and
 * `@react-three/fiber` still constructs one per Canvas to fill `state.clock` —
 * checked against 9.7.0, the newest release, which has not moved either. There
 * is nothing to change on our side: the clock is r3f's own, handed to every
 * `useFrame` consumer, and swapping it for a Timer would change an API that
 * belongs to the library rather than to us.
 *
 * So the line is filtered rather than fixed, by name, with everything else
 * passed straight through — a warning that cannot be acted on is noise, and
 * noise is what hides the warnings that can. Delete this the day r3f moves to
 * Timer; the console will say so by going quiet on its own.
 */
const IGNORED = [/^THREE\.Clock: This module has been deprecated/]

let installed = false

if (!installed) {
  installed = true

  // Chained rather than assigned: three offers exactly one slot for this, and
  // taking it outright would silence anything else that had claimed it.
  const previous = getConsoleFunction()

  setConsoleFunction((type: 'log' | 'warn' | 'error', message: string, ...params: unknown[]) => {
    if (type === 'warn' && IGNORED.some((pattern) => pattern.test(message))) return

    if (previous) {
      previous(type, message, ...params)
      return
    }

    console[type](message, ...params)
  })
}
