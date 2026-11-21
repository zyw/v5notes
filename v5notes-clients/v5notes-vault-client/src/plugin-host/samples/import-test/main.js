/**
 * Import Test —— 用来验证「导入 zip → 待装列表 → 安装 → 已启用」整条链路。
 *
 * 装上以后可以在三个地方确认它真的活着：
 *   1. 设置 → 插件与安全：出现「Import Test 已启用」，权限 vault:read / ui:*。
 *   2. 侧边功能区：多一个「IT」按钮，点它弹公告。
 *   3. 设置 → 插件与安全 → 插件设置：多一块 Import Test 自己的面板。
 *
 * CJS 风格，宿主用 Function 加载。
 */
module.exports = class ImportTestPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'import-test-hello',
      name: 'Import Test：打个招呼',
      callback: () => {
        const active = this.app.workspace.getActiveFile()
        const where = active ? '当前笔记 ' + active.path : '还没有打开笔记'
        this.app.workspace.openNotice('Import Test 已加载 · ' + where)
      },
    })

    this.addCommand({
      id: 'import-test-list-notes',
      name: 'Import Test：数一下库里的文件',
      callback: async () => {
        try {
          const paths = await this.app.vault.list('.')
          this.app.workspace.openNotice('库里第一层有 ' + paths.length + ' 项')
        } catch (e) {
          this.app.workspace.openNotice('读取失败：' + (e && e.message ? e.message : String(e)))
        }
      },
    })

    this.addRibbonIcon({
      id: 'import-test-ribbon',
      title: 'Import Test',
      icon: 'IT',
      callback: () => {
        this.app.workspace.openNotice('Ribbon 可用 · 命令面板里还有两条 Import Test 命令')
      },
    })

    this.addSettingTab({
      id: 'import-test-settings',
      name: 'Import Test',
      display: (el) => {
        el.innerHTML = ''
        const title = document.createElement('p')
        title.textContent = '这个面板由 Import Test 提供，看到它就说明插件代码真的跑起来了。'
        const state = document.createElement('p')
        state.textContent = '启用中的插件：' + this.app.plugins.getEnabledIds().join('、')
        el.appendChild(title)
        el.appendChild(state)
      },
    })
  }

  async onunload() {
    /* 宿主会回收本插件注册的命令、Ribbon 和设置页。 */
  }
}
