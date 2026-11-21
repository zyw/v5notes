/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest'
import { createPluginHost } from './PluginHost'
import type { CommunityPluginsFile } from './communityPlugins'
import { saveSafeMode } from './safeMode'
import { ACTIVE_EDITOR_STORAGE_KEY, ACTIVE_EDITORS_STORAGE_KEY } from './PluginHost'
import { MARKDOWN_KIND, TEXT_KIND } from '../vault/docKinds'
import { PLAIN_EDITOR_ID } from './core/plainEditor'
import { V5_EDITOR_ID } from './core/v5Editor'
import type { ThemeApi, VaultAdapter, WorkspaceApi } from '@v5notes/vault-plugin-api'

function vault(): VaultAdapter {
  return {
    async list() {
      return []
    },
    async read() {
      return ''
    },
    async write() {},
    async delete() {},
    async rename() {},
    async exists() {
      return false
    },
  }
}

function workspace(): WorkspaceApi {
  return { openNotice: vi.fn(), getActiveFile: () => null }
}

function theme(): ThemeApi {
  return {
    list: () => [{ id: 'default', name: '默认', builtin: true, source: 'builtin' }],
    getActive: () => 'default',
    setActive: vi.fn(async () => undefined),
    getCssVariables: () => ({}),
  }
}

function hostWith(enabled: string[]) {
  let community: CommunityPluginsFile = {
    schemaVersion: 1,
    enabled,
    versions: {},
    userEnableSeen: {},
  }
  return createPluginHost({
    vault: vault(),
    workspace: workspace(),
    theme: theme(),
    readCommunityPlugins: async () => community,
    writeCommunityPlugins: async (file) => {
      community = file
    },
    loadPluginData: async () => null,
    savePluginData: async () => undefined,
    listVaultPlugins: async () => [],
  })
}

describe('editor providers', () => {
  it('always loads the default V5 editor and refuses to disable it', async () => {
    saveSafeMode(false)
    localStorage.removeItem('v5notes.vault.active-editor')
    const host = hostWith([])
    await host.start()
    expect(host.list().find((p) => p.id === V5_EDITOR_ID)?.status).toBe('loaded')
    expect(host.list().find((p) => p.id === PLAIN_EDITOR_ID)?.status).toBe('disabled')
    expect(host.getActiveEditorId()).toBe(V5_EDITOR_ID)

    const notice = vi.fn()
    const noticed = createPluginHost({
      vault: vault(),
      workspace: workspace(),
      theme: theme(),
      onNotice: notice,
      readCommunityPlugins: async () => ({ schemaVersion: 1, enabled: [], versions: {}, userEnableSeen: {} }),
      writeCommunityPlugins: async () => undefined,
      loadPluginData: async () => null,
      savePluginData: async () => undefined,
      listVaultPlugins: async () => [],
    })
    await noticed.start()
    await noticed.setEnabled(V5_EDITOR_ID, false)
    expect(notice).toHaveBeenCalled()
    expect(noticed.list().find((p) => p.id === V5_EDITOR_ID)?.status).toBe('loaded')
    await host.stop()
    await noticed.stop()
  })

  it('switches to the plain-text editor without remounting on preview toggle', async () => {
    saveSafeMode(false)
    localStorage.removeItem('v5notes.vault.active-editor')
    const host = hostWith([PLAIN_EDITOR_ID])
    await host.start()
    host.setActiveEditor(PLAIN_EDITOR_ID)
    expect(host.getActiveEditorId(TEXT_KIND)).toBe(PLAIN_EDITOR_ID)

    const provider = host.getActiveEditor(TEXT_KIND)
    const el = document.createElement('div')
    document.body.append(el)
    let latest = '# hello'
    const session = await provider!.mount(el, {
      markdown: latest,
      editable: false,
      onChange: (markdown) => {
        latest = markdown
      },
    })
    const textarea = el.querySelector('textarea')
    expect(textarea).toBeTruthy()
    expect(textarea!.readOnly).toBe(true)
    session.setEditable(true)
    expect(el.querySelector('textarea')).toBe(textarea)
    expect(textarea!.readOnly).toBe(false)
    session.setMarkdown('next')
    expect(textarea!.value).toBe('next')
    textarea!.value = 'typed'
    textarea!.dispatchEvent(new Event('input'))
    expect(latest).toBe('typed')
    session.destroy()
    expect(el.querySelector('textarea')).toBeNull()
    await host.stop()
  })

  it('rejects a community editor that lacks editor:provide', async () => {
    saveSafeMode(false)
    let community: CommunityPluginsFile = {
      schemaVersion: 1,
      enabled: ['alt-editor'],
      versions: {},
      userEnableSeen: {},
    }
    const host = createPluginHost({
      vault: vault(),
      workspace: workspace(),
      theme: theme(),
      readCommunityPlugins: async () => community,
      writeCommunityPlugins: async (file) => {
        community = file
      },
      loadPluginData: async () => null,
      savePluginData: async () => undefined,
      listVaultPlugins: async () => [
        {
          id: 'alt-editor',
          manifest: {
            id: 'alt-editor',
            name: 'Alt',
            version: '1.0.0',
            permissions: ['ui:commands'],
            main: 'main.js',
          },
          mainSource: `
            module.exports = class extends Plugin {
              onload() {
                this.registerEditorProvider({
                  id: 'alt',
                  name: 'Alt',
                  mount() { throw new Error('should not mount') }
                })
              }
            }
          `,
        },
      ],
    })
    await host.start()
    expect(host.list().find((p) => p.id === 'alt-editor')?.status).toBe('failed')
    expect(host.listEditorProviders().some((ed) => ed.id === 'alt')).toBe(false)
    await host.stop()
  })
  it('keeps one active editor per document kind', async () => {
    saveSafeMode(false)
    localStorage.removeItem(ACTIVE_EDITOR_STORAGE_KEY)
    localStorage.removeItem(ACTIVE_EDITORS_STORAGE_KEY)
    const host = hostWith([PLAIN_EDITOR_ID])
    await host.start()

    // Two kinds coexist; neither replaces the other.
    expect(host.getActiveEditorId()).toBe(V5_EDITOR_ID)
    expect(host.getActiveEditorId(TEXT_KIND)).toBe(PLAIN_EDITOR_ID)
    expect(host.listEditorKinds().map((row) => row.docKind)).toEqual([MARKDOWN_KIND, TEXT_KIND])

    // Selecting by id writes only that provider's kind slot.
    host.setActiveEditor(PLAIN_EDITOR_ID)
    expect(host.getActiveEditorId()).toBe(V5_EDITOR_ID)
    expect(host.getActiveEditorId(TEXT_KIND)).toBe(PLAIN_EDITOR_ID)
    await host.stop()
  })

  it('migrates a legacy single active-editor id into its kind slot', async () => {
    saveSafeMode(false)
    localStorage.removeItem(ACTIVE_EDITORS_STORAGE_KEY)
    localStorage.setItem(ACTIVE_EDITOR_STORAGE_KEY, PLAIN_EDITOR_ID)
    const host = hostWith([PLAIN_EDITOR_ID])
    await host.start()

    expect(host.getActiveEditorId(TEXT_KIND)).toBe(PLAIN_EDITOR_ID)
    expect(localStorage.getItem(ACTIVE_EDITOR_STORAGE_KEY)).toBeNull()
    expect(JSON.parse(localStorage.getItem(ACTIVE_EDITORS_STORAGE_KEY) || '{}')).toEqual({
      [TEXT_KIND]: PLAIN_EDITOR_ID,
    })
    await host.stop()
  })

  it('drops a kind from the list once its only provider is disabled', async () => {
    saveSafeMode(false)
    localStorage.removeItem(ACTIVE_EDITOR_STORAGE_KEY)
    localStorage.removeItem(ACTIVE_EDITORS_STORAGE_KEY)
    const host = hostWith([PLAIN_EDITOR_ID])
    await host.start()
    expect(host.getActiveEditorId(TEXT_KIND)).toBe(PLAIN_EDITOR_ID)

    await host.setEnabled(PLAIN_EDITOR_ID, false)
    expect(host.getActiveEditorId(TEXT_KIND)).toBeNull()
    expect(host.listEditorKinds().map((row) => row.docKind)).toEqual([MARKDOWN_KIND])
    // Markdown is untouched by the text provider going away.
    expect(host.getActiveEditorId()).toBe(V5_EDITOR_ID)
    await host.stop()
  })
  it('registers a plugin-declared kind and offers it beside core kinds', async () => {
    saveSafeMode(false)
    localStorage.removeItem(ACTIVE_EDITOR_STORAGE_KEY)
    localStorage.removeItem(ACTIVE_EDITORS_STORAGE_KEY)
    const host = createPluginHost({
      vault: vault(),
      workspace: workspace(),
      theme: theme(),
      readCommunityPlugins: async () => ({ schemaVersion: 1, enabled: ['csv-editor'], versions: {}, userEnableSeen: {} }),
      writeCommunityPlugins: async () => undefined,
      loadPluginData: async () => null,
      savePluginData: async () => undefined,
      listVaultPlugins: async () => [
        {
          id: 'csv-editor',
          manifest: { id: 'csv-editor', name: 'CSV', version: '1.0.0', permissions: ['editor:provide'], main: 'main.js' },
          mainSource: `
            module.exports = class extends Plugin {
              onload() {
                this.registerEditorProvider({
                  id: 'csv-editor',
                  name: 'CSV 编辑器',
                  docKind: 'csv',
                  docKindSpec: { id: 'csv', label: 'CSV 表格', newLabel: '新建 CSV 表格', extension: '.csv' },
                  mount() { throw new Error('not mounted in this test') }
                })
              }
            }
          `,
        },
      ],
    })
    await host.start()

    const kinds = host.listDocKinds()
    expect(kinds.map((kind) => kind.id).sort()).toEqual(['csv', 'markdown'])
    expect(kinds.find((kind) => kind.id === 'csv')?.extension).toBe('.csv')
    // The plugin kind is directly creatable, but plain text stays gone until enabled.
    expect(host.getActiveEditorId('csv')).toBe('csv-editor')
    await host.stop()
  })

  it('refuses a plugin kind that would take over a core suffix', async () => {
    saveSafeMode(false)
    const notice = vi.fn()
    const host = createPluginHost({
      vault: vault(),
      workspace: workspace(),
      theme: theme(),
      onNotice: notice,
      readCommunityPlugins: async () => ({ schemaVersion: 1, enabled: ['hijack'], versions: {}, userEnableSeen: {} }),
      writeCommunityPlugins: async () => undefined,
      loadPluginData: async () => null,
      savePluginData: async () => undefined,
      listVaultPlugins: async () => [
        {
          id: 'hijack',
          manifest: { id: 'hijack', name: 'Hijack', version: '1.0.0', permissions: ['editor:provide'], main: 'main.js' },
          mainSource: `
            module.exports = class extends Plugin {
              onload() {
                this.registerEditorProvider({
                  id: 'hijack',
                  name: 'Hijack',
                  docKind: 'secret-md',
                  docKindSpec: { id: 'secret-md', label: '伪 Markdown', newLabel: '新建', extension: '.md' },
                  mount() { throw new Error('should not mount') }
                })
              }
            }
          `,
        },
      ],
    })
    await host.start()

    expect(host.list().find((plugin) => plugin.id === 'hijack')?.status).toBe('failed')
    expect(host.listDocKinds().map((kind) => kind.id)).toEqual([MARKDOWN_KIND])
    expect(notice).toHaveBeenCalled()
    await host.stop()
  })
})
