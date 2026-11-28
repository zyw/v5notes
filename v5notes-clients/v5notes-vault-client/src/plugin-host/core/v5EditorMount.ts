import { createApp, h, nextTick, ref, watch } from 'vue'
import { createVideoPlugin, serializeVideoBlock, type VideoApi } from '@v5md/plugin-video'
import { V5Editor } from '@v5md/vue'
import type { Editor, V5mdPlugin } from '@v5md/view'
import type {
  EditorFindOptions,
  EditorFindResult,
  EditorMountOptions,
  EditorSession,
  PickedImage,
  PickedMedia,
} from '@v5notes/vault-plugin-api'
import { RelativeImageRewriter } from './relativeImages'

/** Loaded only when the note canvas mounts, so host tests do not pull the editor. */
export function mountV5Editor(container: HTMLElement, options: EditorMountOptions): EditorSession {
  const markdown = ref(options.markdown)
  const editable = ref(options.editable)
  const theme = ref(options.theme ?? 'paper')
  // @v5md/vue owns the editable flag: it watches its `editable` prop and calls
  // editor.setEditable whenever the prop changes, so an imperative
  // editor.setEditable() would not stick. Drive it through the prop instead.
  const sourceMode = ref(false)
  /** Tail of the ordered update queue, so mode requests are applied in order. */
  let pending: Promise<void> = Promise.resolve()
  let editor: Editor | null = null
  let applyingHost = false

  // `attachments/x.png` links resolve through the vault FS before the browser
  // tries (and fails) to fetch them.
  const relativeImages = new RelativeImageRewriter(container, {
    resolve: (relativePath) => options.resolveVaultAsset?.(relativePath) ?? Promise.resolve(''),
  })

  const baseVideoPlugin = createVideoPlugin({ locale: options.locale ?? 'zh-CN' })
  const videoPlugin: V5mdPlugin = {
    ...(baseVideoPlugin as unknown as V5mdPlugin),
    commands: {
      ...baseVideoPlugin.commands,
      'video.pick': {
        isEnabled: (state) => state.editable && !state.sourceMode,
        run: (ctx, ...args) => {
          if (options.onPickVideo && options.onPickVideo() !== false) return true
          return baseVideoPlugin.commands?.['video.insert']?.run(ctx as never, ...args) ?? false
        },
      },
      'audio.pick': {
        isEnabled: (state) => state.editable && !state.sourceMode,
        run: (ctx, ...args) => {
          if (options.onPickAudio && options.onPickAudio() !== false) return true
          return baseVideoPlugin.commands?.['video.insert']?.run(ctx as never, ...args) ?? false
        },
      },
    },
    toolbar: baseVideoPlugin.toolbar?.map((item) => {
      if (item.id === 'video.insert') return { ...item, command: 'video.pick' }
      if (item.id === 'video.insert.audio') return { ...item, command: 'audio.pick' }
      return item
    }),
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
          theme: theme.value,
          placeholder: options.placeholder ?? '开始写作…',
          plugins: [videoPlugin],
          onUploadImage: options.onUploadImage,
          // Claim the toolbar image button for the host's attachment picker.
          // The library opens its hidden system file input only when this
          // callback is absent or returns `false`; calling it with a void
          // return keeps that fallback away.
          onPickImage: () => {
            options.onPickImage?.()
          },
          onReady: (instance: Editor) => {
            editor = instance
            options.onReady?.()
          },
          onFindRequest: () => options.onFindRequest?.(),
        })
    },
  })
  app.mount(container)

  /**
   * Vue renders watched prop changes asynchronously and flushes them in watcher
   * order. Two mode changes in one tick (e.g. leaving source for preview) would
   * otherwise be applied out of order, leaving the editor editable in preview.
   * Each change therefore waits for the previous one and is then reconciled
   * against the props Vue just wrote.
   */
  function reconcile(): void {
    pending = pending.then(async () => {
      await nextTick()
      editor?.setEditable(editable.value)
      editor?.setSourceMode(sourceMode.value)
    })
  }

  watch(editable, reconcile)
  watch(sourceMode, reconcile)

  /** Wait until every visible image has finished loading or failed, capped. */
  async function waitForImages(timeoutMs = 6000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const pending = Array.from(container.querySelectorAll('img'))
        .filter(img => img.getAttribute('src') && !img.complete)
        .map(img => img.decode?.().catch(() => undefined))
      if (!pending.length) {
        relativeImages.scanAll()
        const stillPending = Array.from(container.querySelectorAll('img'))
          .some(img => img.getAttribute('src') && !img.complete)
        if (!stillPending || Date.now() > deadline) return
      } else {
        await Promise.race([
          Promise.all(pending),
          new Promise(resolve => setTimeout(resolve, Math.max(0, deadline - Date.now()))),
        ])
      }
      if (Date.now() > deadline) return
      await new Promise(resolve => setTimeout(resolve, 30))
    }
  }

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
    setSourceMode(enabled: boolean) {
      // Source is a writable surface; preview stays read-only.
      if (enabled && !editable.value) editable.value = true
      sourceMode.value = enabled
    },
    isSourceMode() {
      return editor?.isSourceMode() ?? false
    },
    setTheme(value: string) {
      theme.value = value || 'paper'
    },
    getContentElement() {
      return editor?.getContentElement() ?? null
    },
    waitForImages,
    focus() {
      editor?.focus()
    },
    focusAt(offset: number) {
      editor?.focusAt(offset)
    },
    insertImage({ url, name }: PickedImage) {
      const target = url.trim()
      if (!target) return
      if (editor) {
        editor.insertImageUrl(target, name)
        return
      }
      // Editor not ready yet — splice into the Markdown at the end.
      const label = name.replace(/[[\]\r\n]/g, '').trim()
      const next = `${markdown.value}\n![${label}](${target})\n`
      markdown.value = next
      options.onChange(next)
    },
    insertMedia({ kind, url, name }: PickedMedia) {
      const target = url.trim()
      if (!target) return
      const title = name.replace(/[\r\n"]/g, '').trim() || undefined
      if (editor) {
        editor.focus()
        const videoApi = editor.getPlugin<VideoApi>('video')?.api
        if (videoApi?.insert(target, { audio: kind === 'audio', title })) return
      }
      const lang = kind === 'audio' ? 'audio' : 'video'
      const body = serializeVideoBlock(target, { audio: kind === 'audio', title })
      const next = `${markdown.value}\n\`\`\`${lang}\n${body}\n\`\`\`\n`
      markdown.value = next
      options.onChange(next)
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
