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

function inlineFormat(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function mdToHtml(md) {
  const lines = md.split('\n')
  const out = []
  let inList = false
  let listType = null
  let inCode = false
  const codeLines = []

  const closeList = () => {
    if (inList) {
      out.push(listType === 'ol' ? '</ol>' : '</ul>')
      inList = false
      listType = null
    }
  }

  const flushCode = () => {
    if (!inCode) return
    out.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
    codeLines.length = 0
    inCode = false
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      closeList()
      if (inCode) flushCode()
      else inCode = true
      continue
    }
    if (inCode) {
      codeLines.push(line)
      continue
    }
    if (line.startsWith('# ')) {
      closeList()
      out.push(`<h1>${inlineFormat(line.slice(2))}</h1>`)
      continue
    }
    if (line.startsWith('## ')) {
      closeList()
      out.push(`<h2>${inlineFormat(line.slice(3))}</h2>`)
      continue
    }
    if (line.startsWith('### ')) {
      closeList()
      out.push(`<h3>${inlineFormat(line.slice(4))}</h3>`)
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
    const numbered = line.match(/^(\d+)\.\s+(.*)$/)
    if (numbered) {
      if (!inList || listType !== 'ol') {
        closeList()
        out.push('<ol>')
        inList = true
        listType = 'ol'
      }
      out.push(`<li>${inlineFormat(numbered[2])}</li>`)
      continue
    }
    if (line.startsWith('- ')) {
      if (!inList || listType !== 'ul') {
        closeList()
        out.push('<ul>')
        inList = true
        listType = 'ul'
      }
      out.push(`<li>${inlineFormat(line.slice(2))}</li>`)
      continue
    }
    if (line.startsWith('> ')) {
      closeList()
      out.push(`<blockquote>${inlineFormat(line.slice(2))}</blockquote>`)
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
    out.push(`<p>${inlineFormat(line)}</p>`)
  }
  closeList()
  flushCode()
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
    h3 {
      color: #475569;
      font-size: 12pt;
      margin-top: 16px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }
    p, li { margin: 6px 0; }
    ul, ol { padding-left: 22px; }
    code {
      background: #f1f5f9;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 9.5pt;
    }
    pre {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      overflow-x: auto;
      font-size: 8pt;
      white-space: pre-wrap;
      word-break: break-all;
      page-break-inside: avoid;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      margin: 10px 0;
      padding: 10px 14px;
      background: #ecfdf5;
      border-left: 4px solid #10b981;
      color: #065f46;
    }
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
