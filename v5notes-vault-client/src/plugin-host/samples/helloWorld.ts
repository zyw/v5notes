export const HELLO_WORLD_MANIFEST = {
  id: 'hello-world',
  name: 'Hello World',
  kind: 'plugin' as const,
  version: '1.0.0',
  minAppVersion: '0.1.0',
  description: '示例本地插件（Phase 6）',
  author: 'v5notes',
  permissions: ['ui:commands'] as const,
  main: 'main.js',
}

export const HELLO_WORLD_MAIN_JS = `/**
 * Sample local plugin — CJS-style for PluginHost Function loader.
 * Host injects Plugin and expects module.exports = class extends Plugin.
 */
module.exports = class HelloWorldPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'say-hello',
      name: 'Say hello',
      callback: () => {
        this.app.workspace.openNotice('Hello Vault')
      },
    })
  }
}
`
