/**
 * Sample local plugin — CJS-style for PluginHost Function loader.
 * Host injects `Plugin` and expects `module.exports = class extends Plugin`.
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
