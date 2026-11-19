import { createApp, h, ref } from 'vue'
import { V5Editor } from '@v5md/vue'
import type { Editor } from '@v5md/view'
import type {
  EditorFindOptions,
  EditorFindResult,
  EditorMountOptions,
  EditorSession,
} from '@v5notes/vault-plugin-api'

/** Loaded only when the note canvas mounts, so host tests do not pull the editor. */
export function mountV5Editor(container: HTMLElement, options: EditorMountOptions): EditorSession {
  const markdown = ref(options.markdown)
  const editable = ref(options.editable)
  let editor: Editor | null = null
  let applyingHost = false

  /* Relative vault image links (`附件/x.png`) resolve through the vault FS;
   * the browser cannot fetch them, so swap in an asset/data URL on error. */
  const pendingResolutions = new Map<string, Promise<void>>()
  const unresolvedRelativesByPath = new Map<string, HTMLImageElement[]>()

  function resolveRelativeImage(img: HTMLImageElement): void {
    const target = img.getAttribute('src')?.trim() ?? ''
    if (!target || hasScheme(target) || target.startsWith('/')) return
    let decoded = target
    try {
      decoded = decodeURIComponent(target)
    } catch {
      /* keep raw form */
    }
    // Keep a strong reference to every DOM node that asked (weak refs could be
    // collected before the resolution lands and leave later renders broken).
    const waiters = unresolvedRelativesByPath.get(decoded)
    if (waiters) {
      if (!waiters.includes(img)) waiters.push(img)
    } else {
      unresolvedRelativesByPath.set(decoded, [img])
    }
    if (pendingResolutions.has(decoded)) return
    const promise = Promise.resolve(options.resolveVaultAsset?.(decoded) ?? '')
      .catch(() => '')
      .then((url) => {
        pendingResolutions.delete(decoded)
        const waiters = unresolvedRelativesByPath.get(decoded) ?? []
        unresolvedRelativesByPath.delete(decoded)
        if (!url) return
        for (const node of waiters) {
          if (node.isConnected && !hasScheme(node.getAttribute('src') ?? '')) node.src = url
        }
      })
    pendingResolutions.set(decoded, promise)
  }

  function hasScheme(target: string): boolean {
    return /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')
  }

  const onImgError = (event: Event) => {
    const img = event.target as HTMLElement
    if (img instanceof HTMLImageElement) resolveRelativeImage(img)
  }

  const app = createApp({
    name: 'V5EditorMount',
    setup() {
      return () =>
        h(V5Editor, {
          modelValue: markdown.value,
          'onUpdate:modelValue': (value: string) => {
            if (applyingHost || value === markdown.value) return
            markdown.value = value
            options.onChange(value)
          },
          editable: editable.value,
          locale: options.locale ?? 'zh-CN',
          theme: options.theme ?? 'paper',
          placeholder: options.placeholder ?? '开始写作…',
          onUploadImage: options.onUploadImage,
          onPickImage: options.onPickImage,
          onReady: (instance: Editor) => {
            editor = instance
            container.addEventListener('error', onImgError, true)
            // Images that errored before the listener attached need a nudge.
            Array.from(container.querySelectorAll('img')).forEach((img) => {
              if (img.complete && img.naturalWidth === 0) resolveRelativeImage(img)
            })
            options.onReady?.()
          },
          onFindRequest: () => options.onFindRequest?.(),
        })
    },
  })
  app.mount(container)

  return {
    getMarkdown: () => editor?.getMarkdown() ?? markdown.value,
    setMarkdown(value: string) {
      if (value === (editor?.getMarkdown() ?? markdown.value)) return
      applyingHost = true
      markdown.value = value
      editor?.setMarkdown(value)
      applyingHost = false
    },
    setEditable(value: boolean) {
      editable.value = value
    },
    focus() {
      editor?.focus()
    },
    focusAt(offset: number) {
      editor?.focusAt(offset)
    },
    getOutline() {
      return editor?.getOutline() ?? []
    },
    selectFindMatch(from: number, to: number) {
      editor?.selectFindMatch(from, to)
    },
    replaceNextMatch(query: string, replacement: string, findOptions?: EditorFindOptions): EditorFindResult {
      if (!editor) return { hit: null, error: '编辑器尚未就绪' }
      return editor.replaceNextMatch(query, replacement, findOptions)
    },
    replaceAllMatches(query: string, replacement: string, findOptions?: EditorFindOptions): EditorFindResult {
      if (!editor) return { hit: null, error: '编辑器尚未就绪' }
      return editor.replaceAllMatches(query, replacement, findOptions)
    },
    destroy() {
      container.removeEventListener('error', onImgError, true)
      pendingResolutions.clear()
      unresolvedRelativesByPath.clear()
      app.unmount()
      container.replaceChildren()
    },
  }
}
