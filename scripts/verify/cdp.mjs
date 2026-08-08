// Minimal CDP driver for verifying WebGL in headless Chrome.
//
// The in-app Browser pane never fires requestAnimationFrame, so R3F does not
// render there and the Canvas never initialises. Headless Chrome with SwiftShader
// does both, which is the only way to look at what the camera actually does.
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9333

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function launch() {
  // A previous run's Chrome still holding the port would otherwise be attached
  // to silently, with its own stale page.
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
    if (res.ok) return { child: null, profile: null, reused: true }
  } catch {
    // Nothing listening, which is the normal case.
  }

  const profile = mkdtempSync(join(tmpdir(), 'cdp-'))
  const child = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      '--enable-unsafe-swiftshader',
      '--use-gl=swiftshader',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: 'ignore', detached: false },
  )

  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) return { child, profile }
    } catch {
      // Not listening yet.
    }
    await sleep(250)
  }
  child.kill()
  throw new Error('Chrome did not open its debugging port')
}

export async function attach() {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const page = targets.find((t) => t.type === 'page')
  if (!page) throw new Error('No page target')

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })

  let nextId = 1
  const pending = new Map()
  const logs = []

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(JSON.stringify(message.error)))
      else resolve(message.result)
      return
    }
    if (message.method === 'Runtime.consoleAPICalled') {
      logs.push(
        `${message.params.type}: ${message.params.args.map((a) => a.value ?? a.description).join(' ')}`,
      )
    }
    if (message.method === 'Runtime.exceptionThrown') {
      logs.push(`exception: ${message.params.exceptionDetails.text}`)
    }
  }

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })

  await send('Runtime.enable')
  await send('Page.enable')

  return {
    send,
    logs,
    close: () => ws.close(),

    async goto(url) {
      await send('Page.navigate', { url })
      await sleep(1200)
    },

    /** Evaluates an expression and returns its value, awaiting promises. */
    async evaluate(expression) {
      const { result, exceptionDetails } = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
      if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (result?.description ?? ''))
      return result.value
    },

    async screenshot(path) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' })
      const { writeFileSync } = await import('node:fs')
      writeFileSync(path, Buffer.from(data, 'base64'))
      return path
    },
  }
}
