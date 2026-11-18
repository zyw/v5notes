import {
  Plugin,
  type EditorFindResult,
  type EditorMountOptions,
  type EditorSession,
  type PluginManifest,
} from '@v5notes/vault-plugin-api'

export const PLAIN_EDITOR_ID = 'plain-text'

export const PLAIN_EDITOR_MANIFEST: PluginManifest = {
  id: PLAIN_EDITOR_ID,
  name: '纯文本',
  kind: 'plugin',
  version: '1.0.0',
  minAppVersion: '0.1.0',
  description: '可选的纯文本编辑器，用来替换默认 Markdown 编辑器。',
  author: 'v5notes',
  permissions: ['editor:provide'],
  main: 'core',
}

export class PlainEditorPlugin extends Plugin {
  onload() {
    this.registerEditorProvider({
      id: PLAIN_EDITOR_ID,
      name: '纯文本',
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
