/**
 * Builds the admin guide PDF.
 *
 *   node docs/admin-guide/build.mjs
 *
 * Sections are plain HTML fragments in ./sections, assembled in filename order.
 * Screenshots referenced as src="img/…" are inlined as data URIs, so the built
 * page is a single self-contained file and Chrome never has to be trusted with
 * file:// subresource access.
 */

import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { withPage } from './lib/chrome.mjs'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(ROOT, 'BOXX-Admin-Guide.pdf')
const BUILD = path.join(ROOT, '.build')

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

/**
 * Stands in for a screenshot that has not been captured yet.
 *
 * A draft is read and corrected long before every picture exists, and a broken
 * image icon says nothing about what belongs there — this says the filename.
 */
function placeholder(ref) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420">
    <rect width="1200" height="420" fill="#f4efe8"/>
    <rect x="8" y="8" width="1184" height="404" fill="none" stroke="#cec09c"
          stroke-width="3" stroke-dasharray="14 10"/>
    <text x="600" y="196" text-anchor="middle" font-family="Segoe UI, Arial"
          font-size="30" font-weight="600" fill="#a80030">Screenshot pending</text>
    <text x="600" y="244" text-anchor="middle" font-family="Consolas, monospace"
          font-size="22" fill="#6a6766">${ref}</text>
  </svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}

/** Swaps every img/… reference for the file's bytes, so the page stands alone. */
async function inlineImages(html) {
  const refs = [...new Set([...html.matchAll(/src="(img\/[^"]+)"/g)].map((m) => m[1]))]
  let pending = 0

  for (const ref of refs) {
    const file = path.join(ROOT, ref)
    if (!existsSync(file)) {
      console.warn(`  ! pending screenshot: ${ref}`)
      html = html.replaceAll(`src="${ref}"`, `src="${placeholder(ref)}"`)
      pending += 1
      continue
    }
    const mime = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
    const bytes = await readFile(file)
    html = html.replaceAll(`src="${ref}"`, `src="data:${mime};base64,${bytes.toString('base64')}"`)
  }

  return { html, pending, total: refs.length }
}

async function assemble() {
  const dir = path.join(ROOT, 'sections')
  const names = (await readdir(dir)).filter((name) => name.endsWith('.html')).sort()
  if (names.length === 0) throw new Error('No sections to build.')

  const parts = []
  for (const name of names) {
    console.log(`  + ${name}`)
    parts.push(await readFile(path.join(dir, name), 'utf8'))
  }

  const css = await readFile(path.join(ROOT, 'assets', 'guide.css'), 'utf8')
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>BOXX Modular — Administrator Guide</title>
<style>${css}</style>
</head>
<body>
${parts.join('\n')}
</body>
</html>`

  return inlineImages(page)
}

const footer = `
<div style="width:100%;font-family:'Segoe UI',Arial,sans-serif;font-size:8px;color:#8a9099;
            padding:0 18mm;display:flex;justify-content:space-between;align-items:center;">
  <span>BOXX Modular — Administrator Guide</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`

console.log('Assembling sections…')
const { html, pending, total } = await assemble()

await mkdir(BUILD, { recursive: true })
const htmlFile = path.join(BUILD, 'guide.html')
await writeFile(htmlFile, html, 'utf8')

console.log('Rendering PDF…')
const pdf = await withPage(pathToFileURL(htmlFile).href, async (send) => {
  const { data } = await send('Page.printToPDF', {
    paperWidth: 8.27,
    paperHeight: 11.69,
    marginTop: 0.63,
    marginBottom: 0.71,
    marginLeft: 0,
    marginRight: 0,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: footer,
  })
  return Buffer.from(data, 'base64')
})

await writeFile(OUT, pdf)

const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
console.log(`\n${path.relative(process.cwd(), OUT)}`)
console.log(`  ${pages} pages · ${(pdf.length / 1024 / 1024).toFixed(2)} MB`)
console.log(`  screenshots: ${total - pending} of ${total} captured`)
