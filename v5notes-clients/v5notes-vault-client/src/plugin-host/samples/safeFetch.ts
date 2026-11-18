/** Sample community plugin demonstrating `network:safe` + ribbon/settings surface. */

export const SAFE_FETCH_MANIFEST = {
  id: 'safe-fetch-demo',
  name: 'Safe Fetch Demo',
  kind: 'plugin' as const,
  version: '1.0.0',
  minAppVersion: '0.1.0',
  description: '示例：白名单 GET（httpbin）+ Ribbon / SettingTab',
  author: 'v5notes',
  permissions: ['ui:commands', 'ui:ribbon', 'ui:settings', 'network:safe'] as const,
  networkAllowlist: ['httpbin.org'],
  tags: ['demo', 'network'],
  main: 'main.js',
}

export const SAFE_FETCH_MAIN_JS = `/**
 * Sample network:safe plugin — CJS-style for PluginHost Function loader.
 */
module.exports = class SafeFetchDemoPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'ping-httpbin',
      name: 'Ping httpbin (network:safe)',
      callback: async () => {
        try {
          const res = await this.app.network.request('https://httpbin.org/get?from=v5notes-vault')
          this.app.workspace.openNotice('httpbin OK · status ' + res.status)
        } catch (e) {
          this.app.workspace.openNotice('network:safe 失败: ' + (e && e.message ? e.message : String(e)))
        }
      },
    })

    this.addRibbonIcon({
      id: 'safe-fetch-ribbon',
      title: 'Safe Fetch',
      icon: 'SF',
      callback: async () => {
        this.app.workspace.openNotice('Ribbon → 使用命令「Ping httpbin」')
      },
    })

    this.addSettingTab({
      id: 'safe-fetch-settings',
      name: 'Safe Fetch',
      display: (el) => {
        el.innerHTML = ''
        const p = document.createElement('p')
        p.textContent = '仅允许访问 httpbin.org（GET/HEAD；POST 需白名单且有体积上限）。无第三方发布。'
        el.appendChild(p)
      },
    })
  }
}
`
