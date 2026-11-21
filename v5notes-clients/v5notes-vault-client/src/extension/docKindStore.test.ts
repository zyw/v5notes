import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryAppStore, setAppStore } from './appStorage'
import { forgetKindsForPlugin, readRememberedKinds, rememberKinds } from './docKindStore'

const ROOT = '/app/extensions'

const csv = {
  id: 'csv',
  label: 'CSV 表格',
  newLabel: '新建 CSV 表格',
  extension: '.csv',
  initialContent: '',
  pluginId: 'csv-plugin',
}

describe('docKindStore', () => {
  beforeEach(() => {
    setAppStore(createMemoryAppStore(), ROOT)
  })

  it('remembers a plugin kind and its owning plugin', async () => {
    await rememberKinds([csv])
    const map = await readRememberedKinds()
    expect(map.csv).toMatchObject({ id: 'csv', extension: '.csv', pluginId: 'csv-plugin' })
  })

  it('never remembers core kinds', async () => {
    await rememberKinds([
      { id: 'markdown', label: 'Markdown 笔记', newLabel: '新建 Markdown 笔记', extension: '.md', initialContent: '', pluginId: 'x' },
    ])
    expect(await readRememberedKinds()).toEqual({})
  })

  it('replaces a kind whose extension changed', async () => {
    await rememberKinds([csv])
    await rememberKinds([{ ...csv, extension: '.tsv' }])
    expect((await readRememberedKinds()).csv.extension).toBe('.tsv')
  })

  it('drops every kind belonging to an uninstalled plugin only', async () => {
    await rememberKinds([csv, { ...csv, id: 'sql', extension: '.sql', pluginId: 'sql-plugin' }])
    await forgetKindsForPlugin('csv-plugin')
    const map = await readRememberedKinds()
    expect(Object.keys(map)).toEqual(['sql'])
  })

  it('re-validates stored entries so a tampered file cannot widen note kinds', async () => {
    const store = createMemoryAppStore({
      [`${ROOT}/doc-kinds.json`]: JSON.stringify({
        schemaVersion: 1,
        kinds: [
          { id: 'evil', label: 'x', newLabel: 'x', extension: '.md', pluginId: 'p' },
          { id: 'evil2', label: 'x', newLabel: 'x', extension: '../x', pluginId: 'p' },
          csv,
        ],
      }),
    })
    setAppStore(store, ROOT)
    expect(Object.keys(await readRememberedKinds())).toEqual(['csv'])
  })

  it('treats a missing or broken file as empty', async () => {
    expect(await readRememberedKinds()).toEqual({})
    setAppStore(createMemoryAppStore({ [`${ROOT}/doc-kinds.json`]: 'not json' }), ROOT)
    expect(await readRememberedKinds()).toEqual({})
  })
})
