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

type MediaSrcElement = HTMLImageElement | HTMLSourceElement | HTMLVideoElement | HTMLAudioElement

const MEDIA_SELECTOR = 'img, source, video, audio'

function isMediaSrcElement(node: unknown): node is MediaSrcElement {
  return (
    node instanceof HTMLImageElement ||
    node instanceof HTMLSourceElement ||
    node instanceof HTMLVideoElement ||
    node instanceof HTMLAudioElement
  )
}

export class RelativeImageRewriter {
  private readonly container: HTMLElement
  private readonly resolve: (relativePath: string) => Promise<string>
  private readonly pending = new Map<string, Promise<void>>()
  private readonly waiters = new Map<string, MediaSrcElement[]>()
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
    if (isMediaSrcElement(event.target)) this.handle(event.target)
  }

  private scan(records: MutationRecord[]): void {
    for (const record of records) {
      if (record.type === 'attributes') {
        if (isMediaSrcElement(record.target)) this.handle(record.target)
        continue
      }
      for (const node of Array.from(record.addedNodes)) {
        if (isMediaSrcElement(node)) this.handle(node)
        else if (node instanceof Element) {
          for (const el of Array.from(node.querySelectorAll(MEDIA_SELECTOR))) {
            if (isMediaSrcElement(el)) this.handle(el)
          }
        }
      }
    }
  }

  scanAll(): void {
    for (const el of Array.from(this.container.querySelectorAll(MEDIA_SELECTOR))) {
      if (isMediaSrcElement(el)) this.handle(el)
    }
  }

  handle(el: MediaSrcElement): void {
    const rel = attachmentRelFromImageUrl(el.getAttribute('src'))
    if (!rel) return

    const list = this.waiters.get(rel)
    if (list) {
      if (!list.includes(el)) list.push(el)
    } else {
      this.waiters.set(rel, [el])
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
          console.warn('[v5md] 无法解析库内附件:', rel)
          return
        }
        for (const node of nodes) {
          if (!node.isConnected || !attachmentRelFromImageUrl(node.getAttribute('src'))) continue
          node.src = url
          if (node instanceof HTMLSourceElement && node.parentElement instanceof HTMLMediaElement) {
            node.parentElement.load()
          }
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
