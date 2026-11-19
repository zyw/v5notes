import { createApp, h, ref } from 'vue'
import { V5Editor } from '@v5md/vue'
import type { Editor } from '@v5md/view'
import type {
  EditorFindOptions,
  EditorFindResult,
  EditorMountOptions,
  EditorSession,
} from '@v5notes/vault-plugin-api'
import { RelativeImageRewriter } from './relativeImages'

/** Loaded only when the note canvas mounts, so host tests do not pull the editor. */
export function mountV5Editor(container: HTMLElement, options: EditorMountOptions): EditorSession {
  const markdown = ref(options.markdown)
  const editable = ref(options.editable)
  let editor: Editor | null = null
  let applyingHost = false

  // `attachments/x.png` links resolve through the vault FS before the browser
  // tries (and fails) to fetch them.
  const relativeImages = new RelativeImageRewriter(container, {
    resolve: (relativePath) => options.resolveVaultAsset?.(relativePath) ?? Promise.resolve(''),
  })

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
      relativeImages.destroy()
      app.unmount()
      container.replaceChildren()
    },
  }
}
