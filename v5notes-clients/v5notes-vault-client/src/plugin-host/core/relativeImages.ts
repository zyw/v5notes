/**
 * Relative Markdown image links (`attachments/x.png`) cannot be fetched by
 * the WebView/browser. Rewrite such `src` attributes on capture, before the
 * browser attempts a load, and swap in an asset/data URL once resolved.
 */

import { attachmentRelFromImageUrl } from '../../vault/attachments'

export interface RelativeImageRewriterOptions {
  /** Resolve a vault-relative path (decoded, forward slashes) to a displayable URL. */
  resolve(relativePath: string): Promise<string>
}

export class RelativeImageRewriter {
  private readonly container: HTMLElement
  private readonly resolve: (relativePath: string) => Promise<string>
  private readonly pending = new Map<string, Promise<void>>()
  private readonly waiters = new Map<string, HTMLImageElement[]>()
  private readonly observer: MutationObserver

  constructor(container: HTMLElement, options: RelativeImageRewriterOptions) {
    this.container = container
    this.resolve = options.resolve
    this.observer = new MutationObserver((records) => this.scan(records))
    this.observer.observe(this.container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    })
    // Catch anything already rendered plus every later mutation; failed loads
    // still get one retry via the error listener.
    this.scanAll()
    container.addEventListener('error', this.onError, true)
  }

  private onError = (event: Event): void => {
    const img = event.target
    if (img instanceof HTMLImageElement) this.handle(img)
  }

  private scan(records: MutationRecord[]): void {
    for (const record of records) {
      if (record.type === 'attributes') {
        const target = record.target
        if (target instanceof HTMLImageElement) this.handle(target)
        continue
      }
      for (const node of Array.from(record.addedNodes)) {
        if (node instanceof HTMLImageElement) this.handle(node)
        else if (node instanceof Element) {
          for (const img of Array.from(node.querySelectorAll('img'))) this.handle(img)
        }
      }
    }
  }

  scanAll(): void {
    for (const img of Array.from(this.container.querySelectorAll('img'))) this.handle(img)
  }

  handle(img: HTMLImageElement): void {
    const rel = attachmentRelFromImageUrl(img.getAttribute('src'))
    if (!rel) return

    const list = this.waiters.get(rel)
    if (list) {
      if (!list.includes(img)) list.push(img)
    } else {
      this.waiters.set(rel, [img])
    }
    if (this.pending.has(rel)) return

    const promise = Promise.resolve()
      .then(() => this.resolve(rel))
      .catch(() => '')
      .then((url) => {
        this.pending.delete(rel)
        const nodes = this.waiters.get(rel) ?? []
        this.waiters.delete(rel)
        if (!url) {
          console.warn('[v5md] 无法解析库内图片:', rel)
          return
        }
        for (const node of nodes) {
          if (node.isConnected && attachmentRelFromImageUrl(node.getAttribute('src'))) node.src = url
        }
      })
    this.pending.set(rel, promise)
  }

  destroy(): void {
    this.observer.disconnect()
    this.container.removeEventListener('error', this.onError, true)
    this.pending.clear()
    this.waiters.clear()
  }
}
