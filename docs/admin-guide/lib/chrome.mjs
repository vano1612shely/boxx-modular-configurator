/**
 * A page in headless Chrome, driven over the DevTools protocol.
 *
 * Shared by build.mjs, which prints the guide, and shot.mjs, which photographs
 * it. Chrome's --print-to-pdf flag cannot set header and footer templates, and
 * page numbers are not optional in a document people are meant to navigate, so
 * both go through the protocol rather than the command line.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CANDIDATES = [
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

export function findChrome() {
  const found = CANDIDATES.find((candidate) => candidate && existsSync(candidate))
  if (!found) throw new Error('Chrome not found. Add its path to lib/chrome.mjs.')
  return found
}

/**
 * The Chrome profile that holds the admin session.
 *
 * Screens behind a login still have to end up as files on disk, and the only
 * way to get there is a browser that is already signed in. So a person signs in
 * once, by hand, in `login.mjs` — which opens a visible Chrome on this profile —
 * and every capture afterwards inherits the session from it. Nothing here ever
 * handles the password.
 */
export const PROFILE = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  '.build',
  'chrome-profile',
)

export const isSignedIn = () => existsSync(PROFILE)

/** Minimal DevTools client: one socket, numbered commands, awaited replies. */
function connect(url) {
  const socket = new WebSocket(url)
  const pending = new Map()
  const listeners = []
  let nextId = 0

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id !== undefined) {
      const entry = pending.get(message.id)
      if (!entry) return
      pending.delete(message.id)
      message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result)
      return
    }
    for (const listener of listeners) listener(message)
  })

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', () => reject(new Error('Cannot reach Chrome.')), { once: true })
  })

  return {
    ready,
    on: (listener) => listeners.push(listener),
    close: () => socket.close(),
    send(method, params = {}, sessionId) {
      const id = ++nextId
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        socket.send(JSON.stringify({ id, method, params, sessionId }))
      })
    },
  }
}

/** Chrome writes "DevTools listening on ws://…" to stderr once it is up. */
function debuggerUrl(chrome) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chrome did not report a debugger URL.')), 30000)
    chrome.stderr.on('data', (chunk) => {
      const match = /ws:\/\/[^\s]+/.exec(String(chunk))
      if (!match) return
      clearTimeout(timer)
      resolve(match[0])
    })
  })
}

/**
 * Opens `url` in a throwaway Chrome, waits for it to settle, and hands
 * `(send, sessionId)` to the caller. Everything is torn down afterwards.
 */
export async function withPage(url, run, { signedIn = false } = {}) {
  const profile = await mkdtemp(path.join(tmpdir(), 'boxx-guide-'))

  // Copied rather than used in place, so the window a person signed in with can
  // stay open. Chrome refuses to share a profile directory between instances.
  if (signedIn) {
    if (!isSignedIn()) throw new Error('No signed-in profile yet — run login.mjs first.')
    await rm(profile, { recursive: true, force: true })
    await cp(PROFILE, profile, { recursive: true })
  }

  const chrome = spawn(findChrome(), [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ])

  try {
    const client = connect(await debuggerUrl(chrome))
    await client.ready

    const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true })
    await client.send('Page.enable', {}, sessionId)

    const loaded = new Promise((resolve) => {
      client.on((message) => {
        if (message.method === 'Page.loadEventFired' && message.sessionId === sessionId) resolve()
      })
    })
    await client.send('Page.navigate', { url }, sessionId)
    await loaded

    // Layout settles after webfonts and images resolve; acting before that
    // captures a document with the right words in the wrong places.
    await client.send(
      'Runtime.evaluate',
      {
        expression: `Promise.all([
          document.fonts.ready,
          ...[...document.images].map((img) => img.complete
            ? null
            : new Promise((done) => { img.onload = img.onerror = done })),
        ])`,
        awaitPromise: true,
      },
      sessionId,
    )

    const result = await run((method, params) => client.send(method, params, sessionId))
    client.close()
    return result
  } finally {
    chrome.kill()
    await rm(profile, { recursive: true, force: true }).catch(() => {})
  }
}
