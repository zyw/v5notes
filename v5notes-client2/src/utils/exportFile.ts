import themeCss from '@v5md/view/theme.css?raw'
import katexCss from 'katex/dist/katex.min.css?raw'

// KaTeX ships its fonts next to the stylesheet; an exported file has no such
// folder, so the font URLs are pointed at the CDN (falling back to system fonts
// when the file is opened offline).
const KATEX_FONT_BASE = 'https://cdn.jsdelivr.net/npm/katex@0.19.1/dist/fonts/'

function inlineStyles(): string {
  const katex = katexCss.replace(/url\((['"]?)fonts\//g, `url($1${KATEX_FONT_BASE}`)
  return `${themeCss}\n${katex}`
}

export interface ExportNoteContent {
  name: string
  markdown: string
  /** Rendered, self-contained HTML for the note body (see Editor#getWechatHtml). */
  html: string
  /** Base URL of the notes server, e.g. http://192.168.1.5:8080 */
  serverBase?: string
}

/**
 * The editor resolves relative image paths against the webview origin
 * (taint://localhost in the desktop app), which cannot be fetched. Point them
 * back at the notes server instead.
 */
export function resolveImageSource(source: string, serverBase = '', appOrigin = ''): string {
  const trimmed = source.trim()
  if (!trimmed || /^(data|blob):/i.test(trimmed)) return trimmed
  if (/^(tauri|asset|file):/i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      return serverBase ? new URL(url.pathname + url.search, serverBase).href : trimmed
    } catch {
      return trimmed
    }
  }
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`
  try {
    if (/^https?:/i.test(trimmed)) {
      const url = new URL(trimmed)
      const webviewHost = /^(http:\/\/tauri\.localhost|https:\/\/tauri\.localhost|http:\/\/localhost:\d+)$/i.test(url.origin)
      if (serverBase && (url.origin === appOrigin || webviewHost)) {
        return new URL(url.pathname + url.search, serverBase).href
      }
      return url.href
    }
    return serverBase ? new URL(trimmed, serverBase).href : trimmed
  } catch {
    return trimmed
  }
}

export function rewriteImageSources(html: string, serverBase: string, appOrigin = ''): string {
  if (!serverBase) return html
  return html.replace(/(<img\b[^>]*?\bsrc=")([^"]*)(")/gi, (match, before: string, source: string, after: string) => {
    const resolved = resolveImageSource(source.replace(/&amp;/g, '&'), serverBase, appOrigin)
    return `${before}${resolved.replace(/&/g, '&amp;')}${after}`
  })
}

const MAX_FILE_STEM = 80

/** Turns a note title into a file name that survives every desktop OS. */
export function safeFileStem(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
  const stem = cleaned.slice(0, MAX_FILE_STEM).trim()
  return stem || '未命名笔记'
}

export function exportFileName(name: string, extension: string): string {
  return `${safeFileStem(name)}.${extension}`
}

export function buildMarkdownDocument(note: ExportNoteContent): string {
  return note.markdown.endsWith('\n') ? note.markdown : `${note.markdown}\n`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Wraps the editor's rendered body in a standalone document. The body already
 * carries inline styles, so the file opens without any of the app's CSS.
 */
export function buildExportDocument(note: ExportNoteContent): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(note.name)}</title>
<style>
  :root { color-scheme: light; }
  html, body { margin: 0; padding: 0; background: #f4f2ec; }
  body { display: flex; justify-content: center; }
  .page { box-sizing: border-box; width: 100%; max-width: 820px; min-height: 100vh; padding: 56px 64px 96px; background: #fffefa; }
  .page img { max-width: 100%; height: auto; }
  @media (max-width: 720px) { .page { padding: 32px 22px 64px; } }
  @media print {
    html, body { background: #fff; }
    body { display: block; }
    .page { max-width: none; min-height: 0; padding: 0; background: #fff; }
    @page { margin: 18mm 16mm; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<main class="page">
${note.html}
</main>
</body>
</html>`
}

/**
 * Wraps the rendered editor DOM (the live document, where KaTeX and Mermaid are
 * already rendered) in a standalone page. The v5md theme and KaTeX styles ride
 * along, so formulas and diagrams survive outside the app.
 */
export function buildRenderedDocument(name: string, body: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(name)}</title>
<style>
${inlineStyles()}
</style>
<style>
  :root { color-scheme: light; --doc-size: 17px; }
  html, body { margin: 0; padding: 0; background: #f4f2ec; }
  body { display: flex; justify-content: center; }
  .page { box-sizing: border-box; width: 100%; max-width: 820px; min-height: 100vh; padding: 56px 64px 96px; background: #fffefa; }
  .page .v5md { font-size: var(--doc-size); }
  .page img, .page svg { max-width: 100%; height: auto; }
  @media (max-width: 720px) { .page { padding: 32px 22px 64px; } }
  @media print {
    html, body { background: #fff; }
    body { display: block; }
    .page { max-width: none; min-height: 0; padding: 0; background: #fff; }
    @page { margin: 18mm 16mm; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<main class="page">
<div class="v5md-host v5md">
${body}
</div>
</main>
</body>
</html>`
}

export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function downloadText(fileName: string, text: string, mime: string): void {
  downloadBlob(fileName, new Blob([text], { type: `${mime};charset=utf-8` }))
}

/** A4 body box, shared with the Rust side that draws the pages. */
export const PDF_CONTENT_WIDTH = 595.28 - 51 * 2
export const PDF_CONTENT_HEIGHT = 841.89 - 48 * 2

export interface PdfBlock {
  top: number
  bottom: number
  /** Images, code blocks, tables, diagrams: never split across pages. */
  atomic?: boolean
  /** Headings should not be left dangling at the bottom of a page. */
  heading?: boolean
}

export interface PdfSlice {
  top: number
  height: number
}

/**
 * Splits a tall capture into A4 pages without cutting through a block. When a
 * block would straddle a page break the break moves above it and the page ends
 * early, which is what a print engine would do for `break-inside: avoid`.
 */
export function computePdfSlices(heightPx: number, pageHeightPx: number, blocks: PdfBlock[] = []): PdfSlice[] {
  if (!(heightPx > 0) || !(pageHeightPx > 40)) return []
  const atomic = blocks.filter(block => block.atomic && block.bottom > block.top).sort((a, b) => a.top - b.top)
  const headings = blocks.filter(block => block.heading && block.bottom > block.top).sort((a, b) => a.top - b.top)
  const slices: PdfSlice[] = []
  let top = 0
  for (let guard = 0; guard < 2000; guard += 1) {
    const remaining = heightPx - top
    const ideal = top + pageHeightPx
    if (remaining <= pageHeightPx) {
      slices.push({ top, height: remaining })
      return slices
    }
    let end = ideal
    const straddling = atomic.find(block => block.top < ideal - 1 && block.bottom > ideal + 1)
    if (straddling && straddling.top - top > pageHeightPx * 0.3) {
      end = straddling.top
    } else {
      const dangling = headings.find(block => block.top >= top && block.bottom <= ideal + 1 && block.bottom > ideal - 72)
      if (dangling && dangling.top - top > pageHeightPx * 0.3) end = dangling.top
    }
    if (end - top < pageHeightPx * 0.15) end = ideal
    end = Math.min(end, heightPx)
    slices.push({ top, height: end - top })
    top = end
  }
  return slices
}


/**
 * Clones the live editor content into standalone markup: KaTeX and Mermaid are
 * already rendered there, and the editor-only chrome is stripped.
 */
export function snapshotRenderedHtml(element: HTMLElement | null | undefined): string {
  if (!element) return ''
  const clone = element.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.v5-toolbar, .v5-slash-menu, .v5-block-menu, .v5-block-handle, .v5-tablebar, .v5-outline, .v5-findbar, .v5-image-resize, .v5-drop-line, .v5-marker')
    .forEach(node => node.remove())
  clone.querySelectorAll('[contenteditable]').forEach(node => node.removeAttribute('contenteditable'))
  clone.removeAttribute('contenteditable')
  clone.removeAttribute('data-empty')
  return clone.outerHTML
}
export interface PdfPage {
  jpeg: Uint8Array
  /** Pixel size of the rendered page; used for the PDF aspect ratio. */
  width: number
  height: number
}

const A4_WIDTH_PT = 595.28
const A4_RATIO = 297 / 210

function points(value: number): string {
  return (Math.round(value * 100) / 100).toString()
}

/**
 * Writes a PDF where every page is one JPEG slice. Text stays raster (there is
 * no CJK font to embed), but nothing leaves the app and no dialog is needed.
 */
export function buildImagePdf(pages: PdfPage[]): Blob {
  if (!pages.length) throw new Error('没有可导出的页面')
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (data: string | Uint8Array): void => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data
    parts.push(bytes)
    length += bytes.length
  }
  const openObject = (id: number): void => { offsets[id] = length; push(`${id} 0 obj\n`) }
  const closeObject = (): void => { push('endobj\n') }

  push('%PDF-1.4\n')
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))

  const objectCount = 2 + pages.length * 3
  openObject(1)
  push('<< /Type /Catalog /Pages 2 0 R >>\n')
  closeObject()
  openObject(2)
  push(`<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 3} 0 R`).join(' ')}] /Count ${pages.length} >>\n`)
  closeObject()

  pages.forEach((page, index) => {
    const pageId = 3 + index * 3
    const contentId = pageId + 1
    const imageId = pageId + 2
    const heightPt = (A4_WIDTH_PT * page.height) / page.width
    openObject(pageId)
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${points(A4_WIDTH_PT)} ${points(heightPt)}] `
      + `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\n`)
    closeObject()
    const content = encoder.encode(`q\n${points(A4_WIDTH_PT)} 0 0 ${points(heightPt)} 0 0 cm\n/Im0 Do\nQ\n`)
    openObject(contentId)
    push(`<< /Length ${content.length} >>\nstream\n`)
    push(content)
    push('\nendstream\n')
    closeObject()
    openObject(imageId)
    push(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB `
      + `/BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`)
    push(page.jpeg)
    push('\nendstream\n')
    closeObject()
  })

  const xrefOffset = length
  push(`xref\n0 ${objectCount + 1}\n0000000000 65535 f\r\n`)
  for (let id = 1; id <= objectCount; id += 1) push(`${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n\r\n`)
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)
  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}

export interface PngResult {
  blob: Blob
  missingImages: number
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('无法读取图片'))
    reader.readAsDataURL(blob)
  })
}

/** Loads an image URL into a data URL; the browser path needs CORS. */
export async function fetchImageDataUrl(source: string): Promise<string> {
  const response = await fetch(source, { mode: 'cors', credentials: 'omit' })
  if (!response.ok) throw new Error(`图片请求失败 (${response.status})`)
  return readAsDataUrl(await response.blob())
}

export type ImageDataLoader = (source: string) => Promise<string>

async function inlineImages(root: HTMLElement, serverBase: string, loadImage: ImageDataLoader): Promise<number> {
  let missing = 0
  const images = Array.from(root.querySelectorAll('img'))
  for (const image of images) {
    const source = resolveImageSource(image.getAttribute('src') ?? '', serverBase)
    image.setAttribute('src', source)
    if (/^(data|blob):/i.test(source)) {
      await image.decode?.().catch(() => undefined)
      continue
    }
    try {
      image.setAttribute('src', await loadImage(source))
      await image.decode?.().catch(() => undefined)
    } catch (cause) {
      missing += 1
      console.warn('[export] 图片无法嵌入：', source, cause)
      image.remove()
    }
  }
  return missing
}

async function mountExportPage(html: string, width: number, serverBase: string, loadImage: ImageDataLoader) {
  const page = document.createElement('div')
  page.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  page.setAttribute('style', `box-sizing:border-box;width:${width}px;padding:48px 56px;background:#ffffff;color:#2c2c2c;`)
  page.innerHTML = html
  const missingImages = await inlineImages(page, serverBase, loadImage)
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-12000px;top:0;pointer-events:none;'
  host.appendChild(page)
  document.body.appendChild(host)
  return {
    page,
    missingImages,
    height: () => Math.ceil(page.getBoundingClientRect().height),
    cleanup: () => host.remove(),
  }
}

interface PaintedImage {
  element: HTMLImageElement
  /** Position relative to the export page's border box. */
  x: number
  y: number
  width: number
  height: number
  radius: number
}

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/**
 * WebKit (the desktop app's engine) refuses to paint <img> elements inside an
 * SVG <foreignObject>, so the text layer is rasterised on its own and every
 * loaded image is composited back onto the canvas at its laid-out position.
 */
function paintableImages(page: HTMLElement): PaintedImage[] {
  const pageRect = page.getBoundingClientRect()
  return Array.from(page.querySelectorAll('img')).flatMap(element => {
    if (!element.isConnected || !element.complete || element.naturalWidth <= 0) return []
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return []
    return [{
      element,
      x: rect.left - pageRect.left,
      y: rect.top - pageRect.top,
      width: rect.width,
      height: rect.height,
      radius: Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0,
    }]
  })
}

/**
 * Serialises a clone whose images are replaced by a transparent pixel. The clone
 * keeps each image's occupied size inline so the surrounding text stays put, and
 * the (much smaller) SVG string never carries the full data URLs.
 */
function serializePage(page: HTMLElement): string {
  const clone = page.cloneNode(true) as HTMLElement
  const originals = Array.from(page.querySelectorAll('img'))
  const copies = Array.from(clone.querySelectorAll('img'))
  originals.forEach((original, index) => {
    const copy = copies[index]
    if (!copy) return
    const rect = original.getBoundingClientRect()
    copy.style.width = `${rect.width}px`
    copy.style.height = `${rect.height}px`
    copy.style.visibility = 'hidden'
    copy.setAttribute('src', TRANSPARENT_PIXEL)
  })
  return new XMLSerializer().serializeToString(clone)
}

function clipRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const corner = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + corner, y)
  context.arcTo(x + width, y, x + width, y + height, corner)
  context.arcTo(x + width, y + height, x, y + height, corner)
  context.arcTo(x, y + height, x, y, corner)
  context.arcTo(x, y, x + width, y, corner)
  context.closePath()
  context.clip()
}

function paintImages(context: CanvasRenderingContext2D, images: PaintedImage[], scale: number): void {
  for (const item of images) {
    if (!item.element.isConnected || !item.element.complete || item.element.naturalWidth <= 0) continue
    const x = item.x * scale
    const y = item.y * scale
    const width = item.width * scale
    const height = item.height * scale
    if (item.radius > 0) {
      context.save()
      clipRoundedRect(context, x, y, width, height, item.radius * scale)
      context.drawImage(item.element, x, y, width, height)
      context.restore()
    } else {
      context.drawImage(item.element, x, y, width, height)
    }
  }
}

async function rasterizePage(page: HTMLElement, width: number, height: number, scale: number): Promise<HTMLCanvasElement> {
  const images = paintableImages(page)
  const serialized = serializePage(page)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="${width}" height="${height}">${serialized}</foreignObject></svg>`
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('内容渲染失败'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前环境不支持画布渲染')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  paintImages(context, images, scale)
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('画布导出失败'))), type, quality)
  })
}

/**
 * Renders the note body to a single long PNG. Images are inlined as data URLs so
 * the canvas is never tainted; images that cannot be fetched are dropped and
 * reported back to the caller.
 */
export interface RenderNoteOptions {
  width?: number
  scale?: number
  serverBase?: string
  /** Overrides the browser fetch; the desktop shell uses Rust to bypass CORS. */
  loadImage?: ImageDataLoader
}

export async function renderNotePng(html: string, options: RenderNoteOptions = {}): Promise<PngResult> {
  const width = options.width ?? 820
  let scale = options.scale ?? 2
  const mounted = await mountExportPage(html, width, options.serverBase ?? '', options.loadImage ?? fetchImageDataUrl)
  try {
    const height = mounted.height()
    if (height <= 0) throw new Error('正文为空，无法导出图片')
    const limit = 16000
    if (height * scale > limit) scale = Math.max(1, limit / height)
    const canvas = await rasterizePage(mounted.page, width, height, scale)
    return { blob: await canvasToBlob(canvas, 'image/png'), missingImages: mounted.missingImages }
  } finally {
    mounted.cleanup()
  }
}

export interface PdfResult {
  blob: Blob
  pages: number
  missingImages: number
}

/**
 * Renders the note to an A4 PDF without opening a print dialog: the page is
 * rasterised once, sliced into A4-proportioned pages and embedded as JPEGs.
 */
export async function renderNotePdf(html: string, options: RenderNoteOptions = {}): Promise<PdfResult> {
  const width = options.width ?? 794
  let scale = options.scale ?? 2
  const pageHeight = Math.round(width * A4_RATIO)
  const mounted = await mountExportPage(html, width, options.serverBase ?? '', options.loadImage ?? fetchImageDataUrl)
  try {
    const height = mounted.height()
    if (height <= 0) throw new Error('正文为空，无法导出 PDF')
    const maxArea = 60_000_000
    const maxSide = 28_000
    while (width * scale * height * scale > maxArea || height * scale > maxSide) scale *= 0.85
    const total = Math.max(1, Math.ceil(height / pageHeight))
    const tall = await rasterizePage(mounted.page, width, height, scale)

    const pages: PdfPage[] = []
    for (let index = 0; index < total; index += 1) {
      const slice = document.createElement('canvas')
      slice.width = Math.round(width * scale)
      slice.height = Math.round(pageHeight * scale)
      const context = slice.getContext('2d')
      if (!context) throw new Error('当前环境不支持 PDF 导出')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, slice.width, slice.height)
      context.drawImage(
        tall,
        0, Math.round(index * pageHeight * scale), slice.width, slice.height,
        0, 0, slice.width, slice.height,
      )
      const jpeg = await canvasToBlob(slice, 'image/jpeg', 0.92)
      pages.push({ jpeg: new Uint8Array(await jpeg.arrayBuffer()), width: slice.width, height: slice.height })
    }
    return { blob: buildImagePdf(pages), pages: total, missingImages: mounted.missingImages }
  } finally {
    mounted.cleanup()
  }
}
