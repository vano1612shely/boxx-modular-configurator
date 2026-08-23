/**
 * Serves the assembled guide so it can be read in a browser before printing.
 *
 *   node docs/admin-guide/preview.mjs
 *
 * The built page is a single self-contained file, so this is a plain static
 * handler over ./.build with no directory listing and no dependencies.
 */

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BUILD = path.join(path.dirname(fileURLToPath(import.meta.url)), '.build')
const PORT = Number(process.env.PORT ?? 4599)

createServer(async (request, response) => {
  const name = request.url === '/' ? 'guide.html' : path.basename(request.url.split('?')[0])
  try {
    const body = await readFile(path.join(BUILD, name))
    response.writeHead(200, {
      'content-type': name.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream',
      'cache-control': 'no-store',
    })
    response.end(body)
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain' })
    response.end('Run build.mjs first.')
  }
}).listen(PORT, () => console.log(`Guide preview on http://localhost:${PORT}`))
