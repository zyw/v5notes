import { Plugin, type PluginManifest } from '@v5notes/vault-plugin-api'
import { MARKDOWN_KIND } from '../../vault/docKinds'

/** Always loaded. Users can switch away, but cannot disable this provider. */
export const V5_EDITOR_ID = 'v5-editor'

export const V5_EDITOR_MANIFEST: PluginManifest = {
  id: V5_EDITOR_ID,
  name: 'V5 编辑器',
  kind: 'plugin',
  version: '1.0.0',
  minAppVersion: '0.1.0',
  description: '默认 Markdown 编辑器。预览与编辑复用同一实例。',
  author: 'v5notes',
  permissions: ['editor:provide'],
  main: 'core',
}

export class V5EditorPlugin extends Plugin {
  onload() {
    this.registerEditorProvider({
      id: V5_EDITOR_ID,
      name: 'V5 编辑器',
      docKind: MARKDOWN_KIND,
      mount(container, options) {
        return import('./v5EditorMount').then((mod) => mod.mountV5Editor(container, options))
      },
    })
  }
}
