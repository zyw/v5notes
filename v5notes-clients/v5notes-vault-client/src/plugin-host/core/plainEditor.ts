import {
  Plugin,
  type EditorFindResult,
  type EditorMountOptions,
  type EditorSession,
  type PickedImage,
  type PluginManifest,
} from '@v5notes/vault-plugin-api'
import { TEXT_KIND } from '../../vault/docKinds'

export const PLAIN_EDITOR_ID = 'plain-text'

export const PLAIN_EDITOR_MANIFEST: PluginManifest = {
  id: PLAIN_EDITOR_ID,
  name: '纯文本',
  kind: 'plugin',
  version: '1.0.0',
  minAppVersion: '0.1.0',
  description: '纯文本笔记（.txt）的编辑器；与 Markdown 编辑器并存。',
  author: 'v5notes',
  permissions: ['editor:provide'],
  main: 'core',
}

export class PlainEditorPlugin extends Plugin {
  onload() {
    this.registerEditorProvider({
      id: PLAIN_EDITOR_ID,
      name: '纯文本',
      docKind: TEXT_KIND,
      mount(container, options) {
        return mountPlainEditor(container, options)
      },
    })
  }
}

function mountPlainEditor(container: HTMLElement, options: EditorMountOptions): EditorSession {
  const textarea = document.createElement('textarea')
  textarea.className = 'vault-plain-editor'
  textarea.value = options.markdown
  textarea.placeholder = options.placeholder ?? ''
  textarea.readOnly = !options.editable
  textarea.spellcheck = false
  textarea.addEventListener('input', () => options.onChange(textarea.value))
  if (options.onUploadImage) {
    // Keep pasted images from being swallowed: insert the stored Markdown link.
    textarea.addEventListener('paste', (event) => {
      const files = event.clipboardData?.files
      const image = files ? Array.from(files).find((file) => file.type.startsWith('image/')) : undefined
      if (!image) return
      event.preventDefault()
      void Promise.resolve(options.onUploadImage!(image))
        .then((url) => {
          if (!url) return
          const alt = image.name.replace(/\.[^.]+$/, '')
          const pos = textarea.selectionStart ?? textarea.value.length
          const next = `${textarea.value.slice(0, pos)}![${alt}](${url})${textarea.value.slice(pos)}`
          textarea.value = next
          options.onChange(next)
        })
        .catch(() => {
          /* host reports upload failures */
        })
    })
  }
  container.replaceChildren(textarea)
  options.onReady?.()

  function replaceAll(query: string, replacement: string): EditorFindResult {
    if (!query) return { hit: null, error: null }
    const next = textarea.value.split(query).join(replacement)
    if (next !== textarea.value) {
      textarea.value = next
      options.onChange(next)
    }
    return { hit: null, error: null }
  }

  return {
    getMarkdown: () => textarea.value,
    setMarkdown(value: string) {
      if (textarea.value !== value) textarea.value = value
    },
    setEditable(value: boolean) {
      textarea.readOnly = !value
    },
    focus() {
      textarea.focus()
    },
    focusAt(offset: number) {
      textarea.focus()
      const pos = Math.max(0, Math.min(offset, textarea.value.length))
      textarea.setSelectionRange(pos, pos)
    },
    insertImage({ url, name }: PickedImage) {
      const target = url.trim()
      if (!target) return
      const label = name.replace(/[[\]\r\n]/g, '').trim()
      const pos = textarea.selectionStart ?? textarea.value.length
      const next = `${textarea.value.slice(0, pos)}![${label}](${target})${textarea.value.slice(pos)}`
      textarea.value = next
      options.onChange(next)
    },
    getOutline: () => [],
    selectFindMatch(from: number, to: number) {
      textarea.focus()
      textarea.setSelectionRange(from, to)
    },
    replaceNextMatch(query: string, replacement: string): EditorFindResult {
      if (!query) return { hit: null, error: null }
      const index = textarea.value.indexOf(query)
      if (index < 0) return { hit: null, error: null }
      const next = textarea.value.slice(0, index) + replacement + textarea.value.slice(index + query.length)
      textarea.value = next
      options.onChange(next)
      return {
        hit: { from: index, to: index + replacement.length, index: 0, total: 1 },
        error: null,
      }
    },
    replaceAllMatches: replaceAll,
    destroy() {
      textarea.remove()
    },
  }
}
