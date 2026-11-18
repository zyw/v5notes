/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest'
import { createPluginHost } from './PluginHost'
import type { CommunityPluginsFile } from './communityPlugins'
import { saveSafeMode } from './safeMode'
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
    expect(host.getActiveEditorId()).toBe(PLAIN_EDITOR_ID)

    const provider = host.getActiveEditor()
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
})
