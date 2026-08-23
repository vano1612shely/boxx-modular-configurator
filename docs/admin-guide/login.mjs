/**
 * Opens a Chrome window on the guide's own profile, for signing in by hand.
 *
 *   node docs/admin-guide/login.mjs
 *
 * Screenshots of screens behind a login need a browser that is already signed
 * in. Rather than automate the password — which nothing here should ever
 * handle — a person signs in once in this window, and every later run of
 * capture.mjs inherits the session from the profile it leaves behind.
 *
 * Sign in, then close the window. The session survives.
 */

import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'

import { findChrome, PROFILE } from './lib/chrome.mjs'

const APP = process.env.GUIDE_APP ?? 'http://localhost:3000'

await mkdir(PROFILE, { recursive: true })

const chrome = spawn(
  findChrome(),
  [
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,960',
    `--user-data-dir=${PROFILE}`,
    `${APP}/admin/login`,
  ],
  { detached: true, stdio: 'ignore' },
)
chrome.unref()

console.log(`A Chrome window is opening on ${APP}/admin/login`)
console.log('')
console.log('  1. Sign in.')
console.log('  2. Close the window.')
console.log('  3. Run: node docs/admin-guide/capture.mjs')
console.log('')
console.log(`Session is kept in ${PROFILE}`)
