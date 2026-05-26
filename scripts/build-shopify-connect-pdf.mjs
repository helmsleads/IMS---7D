/**
 * Build PDF: docs/shopify-connect-guide/connect-shopify.pdf
 * Run: node scripts/build-shopify-connect-pdf.mjs
 */

import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const guideDir = path.join(root, 'docs', 'shopify-connect-guide')
const mdPath = path.join(guideDir, 'connect-shopify.md')
const outPdf = path.join(guideDir, 'connect-shopify.pdf')

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function mdToHtml(md) {
  const lines = md.split('\n')
  const out = []
  let inList = false

  const closeList = () => {
    if (inList) {
      out.push('</ul>')
      inList = false
    }
  }

  for (const line of lines) {
    if (line.startsWith('# ')) {
      closeList()
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`)
      continue
    }
    if (line.startsWith('## ')) {
      closeList()
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`)
      continue
    }
    if (line.startsWith('![')) {
      closeList()
      const m = line.match(/!\[([^\]]*)\]\(([^)]+)\)/)
      if (m) {
        const alt = escapeHtml(m[1])
        const src = path.resolve(guideDir, m[2]).replace(/\\/g, '/')
        out.push(
          `<figure><img src="file:///${src}" alt="${alt}"/><figcaption>${alt}</figcaption></figure>`
        )
      }
      continue
    }
    if (line.startsWith('- ')) {
      if (!inList) {
        out.push('<ul>')
        inList = true
      }
      let text = line.slice(2)
      text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      out.push(`<li>${text}</li>`)
      continue
    }
    if (line.trim() === '---') {
      closeList()
      out.push('<hr/>')
      continue
    }
    if (line.trim() === '') {
      closeList()
      continue
    }
    closeList()
    let text = escapeHtml(line)
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    out.push(`<p>${text}</p>`)
  }
  closeList()
  return out.join('\n')
}

async function main() {
  if (!fs.existsSync(mdPath)) {
    console.error('Missing', mdPath)
    process.exit(1)
  }

  const md = fs.readFileSync(mdPath, 'utf8')
  const body = mdToHtml(md)
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    @page { margin: 18mm 16mm; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #0f172a;
      max-width: 100%;
    }
    h1 {
      color: #0e7490;
      font-size: 22pt;
      border-bottom: 2px solid #06b6d4;
      padding-bottom: 6px;
      margin-bottom: 16px;
    }
    h2 {
      color: #334155;
      font-size: 14pt;
      margin-top: 22px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }
    p, li { margin: 6px 0; }
    ul { padding-left: 22px; }
    figure {
      margin: 14px 0 18px;
      page-break-inside: avoid;
    }
    img {
      max-width: 100%;
      height: auto;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
    }
    figcaption {
      font-size: 9pt;
      color: #64748b;
      margin-top: 6px;
      text-align: center;
    }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
  </style>
</head>
<body>${body}</body>
</html>`

  const tmpHtml = path.join(guideDir, '_print.html')
  fs.writeFileSync(tmpHtml, html)

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(`file:///${tmpHtml.replace(/\\/g, '/')}`, {
    waitUntil: 'networkidle',
  })
  await page.pdf({
    path: outPdf,
    format: 'A4',
    printBackground: true,
    margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' },
  })
  await browser.close()
  fs.unlinkSync(tmpHtml)

  console.log('PDF created:', outPdf)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
