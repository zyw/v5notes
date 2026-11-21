import { describe, expect, it, vi } from 'vitest'
import { fetchCatalogList, fetchCatalogPackage } from './api'
import { assertCatalogItemInstallable, hasPublishingTag } from './rejectPublishing'
import { bundledCatalogList, bundledCatalogPackage } from './bundled'
import { CATALOG_PROTOCOL_VERSION } from './types'
import { validateThemeCss } from '../theme-host/cssValidate'
import { parseManifestJson } from '../plugin-host/manifest'

describe('catalog reject publishing', () => {
  it('detects publishing tags', () => {
    expect(hasPublishingTag(['demo', 'publishing'])).toBe(true)
    expect(hasPublishingTag(['official'])).toBe(false)
    expect(() => assertCatalogItemInstallable({ tags: ['publishing'] })).toThrow(/publishing/)
    expect(() =>
      assertCatalogItemInstallable({ permissions: ['publish:*'] }),
    ).toThrow(/publish/)
  })

  it('parseManifestJson rejects publishing tags', () => {
    expect(() =>
      parseManifestJson({
        id: 'evil-pub',
        name: 'Evil',
        version: '1.0.0',
        permissions: ['ui:commands'],
        tags: ['publishing'],
        main: 'main.js',
      }),
    ).toThrow(/publishing/)
  })

  it('parseManifestJson requires allowlist for network:safe', () => {
    expect(() =>
      parseManifestJson({
        id: 'net',
        name: 'Net',
        version: '1.0.0',
        permissions: ['network:safe'],
        main: 'main.js',
      }),
    ).toThrow(/networkAllowlist/)
  })
})

describe('bundled catalog', () => {
  it('is marked non-file-sync with independent protocol version', () => {
    const list = bundledCatalogList()
    expect(list.fileSyncResource).toBe(false)
    expect(list.catalogProtocolVersion).toBe(CATALOG_PROTOCOL_VERSION)
    expect(list.items.length).toBeGreaterThan(0)
    const pkg = bundledCatalogPackage('safe-fetch-demo')
    expect(pkg.files['manifest.json']).toContain('network:safe')
  })

  it('seeds Hello World as an installable plugin', () => {
    const list = bundledCatalogList('plugin')
    expect(list.items.map((i) => i.id)).toEqual(['hello-world', 'safe-fetch-demo'])
    const pkg = bundledCatalogPackage('hello-world')
    expect(pkg.kind).toBe('plugin')
    expect(pkg.files['manifest.json']).toContain('"id": "hello-world"')
    expect(pkg.files['main.js']).toContain('HelloWorldPlugin')
    // 种子 manifest 必须能过插件清单解析，否则点「安装」会在落盘前失败。
    expect(parseManifestJson(pkg.files['manifest.json']!).id).toBe('hello-world')
  })

  // 主题种子直接落盘给 ThemeHost 注入，必须符合社区主题 CSS 规则，
  // 否则点选时会校验失败并回退内置（catalog-moss 曾用裸 :root 踩过）。
  it('bundled theme packages pass community CSS validation', () => {
    for (const item of bundledCatalogList('theme').items) {
      const css = bundledCatalogPackage(item.id).files['theme.css'] ?? ''
      const check = validateThemeCss(css)
      expect(check.errors, `${item.id}: ${check.errors.join('; ')}`).toEqual([])
      expect(css).toContain(`[data-community-theme='${item.id}']`)
    }
  })
})

describe('fetchCatalogList', () => {
  it('falls back to bundled when server fails', async () => {
    const transport = vi.fn(async () => {
      throw new Error('offline')
    })
    const { list, source } = await fetchCatalogList(undefined, {
      server: 'http://127.0.0.1:9',
      transport: transport as unknown as typeof fetch,
    })
    expect(source).toBe('bundled')
    expect(list.items.some((i) => i.id === 'safe-fetch-demo')).toBe(true)
  })

  it('filters publishing items from server response', async () => {
    const transport = vi.fn(async () =>
      new Response(
        JSON.stringify({
          code: 200,
          data: {
            catalogProtocolVersion: '1',
            fileSyncResource: false,
            items: [
              {
                id: 'ok',
                name: 'Ok',
                kind: 'plugin',
                version: '1',
                tags: ['demo'],
                permissions: ['ui:commands'],
              },
              {
                id: 'bad',
                name: 'Bad',
                kind: 'plugin',
                version: '1',
                tags: ['publishing'],
                permissions: ['ui:commands'],
              },
            ],
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Vault-Catalog-Version': '1',
            'X-Vault-Resource-Kind': 'catalog-non-file-sync',
          },
        },
      ),
    )
    const { list, source } = await fetchCatalogList(undefined, {
      server: 'http://example.test',
      transport: transport as unknown as typeof fetch,
      allowBundledFallback: false,
    })
    expect(source).toBe('server')
    expect(list.items.map((i) => i.id)).toEqual(['ok'])
  })

  it('fetchCatalogPackage uses bundled fallback', async () => {
    const { pkg, source } = await fetchCatalogPackage('catalog-moss', {
      server: 'http://127.0.0.1:9',
      transport: (async () => {
        throw new Error('down')
      }) as unknown as typeof fetch,
    })
    expect(source).toBe('bundled')
    expect(pkg.files['theme.css']).toContain('--accent')
  })
})
