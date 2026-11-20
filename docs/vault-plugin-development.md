# Vault 插件开发指南

给 `v5notes-vault-client` 写一个功能插件或主题。读完这一篇可以产出一个能被设置页加载的包。

## 一、先搞清三层数据

插件系统按「代码」「安装状态」「设置」分开存放，这是理解整个模型的关键：

| 内容 | 归属 | 位置 |
|---|---|---|
| 插件代码 `manifest.json` / `main.js` | **全局**，装一次全机可用 | `<应用配置目录>/extensions/plugins/<id>/` |
| 是否启用 | **全局**，一份 | `<应用配置目录>/extensions/community-plugins.json` |
| 主题包 | **全局** | `<应用配置目录>/extensions/themes/<id>/` |
| 插件**全局**设置 | **全局** | `<应用配置目录>/extensions/plugins/<id>/data.json` |
| 插件**库**设置 | **跟库** | `<库>/.v5notes/plugins/<id>/data.json` |

`<应用配置目录>` 是 Tauri 的 app config dir（macOS 上是 `~/Library/Application Support/xin.v5ai.v5notes.vault/`），和 `recent-vaults.json`、`vault-registry.json` 同级。

**三条由此推出的规则：**

1. **插件代码和全局设置不随库同步**，换台机器需要重新安装插件。
2. **库设置跟着库走并参与同步**，因为它描述的是这个库的笔记。
3. **没有打开库时插件照常加载**，只是碰不到任何笔记（见下文 `vault` 适配器的行为）。

## 二、最小可运行插件

目录结构：

```
hello-world/
  manifest.json
  main.js
```

`manifest.json`：

```json
{
  "id": "hello-world",
  "name": "Hello World",
  "kind": "plugin",
  "version": "1.0.0",
  "minAppVersion": "0.1.0",
  "description": "示例插件",
  "author": "你",
  "permissions": ["ui:commands"],
  "main": "main.js"
}
```

`main.js`（宿主用 `new Function` 加载，必须是 CJS 风格导出，`Plugin` 由宿主注入）：

```js
module.exports = class HelloWorld extends Plugin {
  async onload() {
    this.addCommand({
      id: 'say-hello',
      name: 'Say hello',
      callback: () => this.app.workspace.openNotice('Hello Vault'),
    })
  }
}
```

**关于导出形式**：源文件里可以写 `import { Plugin } from '@v5notes/vault-plugin-api'` 正常开发，但**不要把这个包打进产物**——宿主已经注入了 `Plugin`。构建时把该 import 设为 external，或用 `module.exports = class ... extends Plugin` 的直写形式。宿主接受 `module.exports.default` 或 `module.exports` 两种情况。

**目录名必须等于 `manifest.id`**，不一致的包会被静默跳过（[vaultBridge 扫描逻辑](../v5notes-clients/v5notes-vault-client/src/extension/globalPlugins.ts)）。

## 三、设置存哪一层

`loadData` / `saveData` 都接受一个 scope 参数，默认 `'vault'`：

```js
// 这个库的模板目录 —— 每库不同，跟着库同步
const vaultPrefs = await this.loadData()
await this.saveData({ templateDir: '模板' })

// 界面密度、自己的接口地址 —— 全机一份
const globalPrefs = await this.loadData('global')
await this.saveData({ density: 'compact' }, 'global')
}
```

**默认值特意选 `'vault'`**：插件设置绝大多数是「上次打开哪篇笔记」「这个库的模板在哪」这类跟库内容绑定的东西，默认落库层更安全。只有真正该跨库共享的才显式写 `'global'`。

怎么选：

| 数据 | scope | 理由 |
|---|---|---|
| 上次打开的笔记路径、当前库的模板目录 | `'vault'` | 换个库就该变 |
| 缓存的笔记索引、这个库的标签统计 | `'vault'` | 描述的是这个库的内容 |
| 界面密度、面板折叠状态、用户自己的接口地址 | `'global'` | 跟库无关 |

**没有库时**：`loadData()` 返回 `null`，`saveData()` 抛 `打开库后可保存库内设置`。全局层则任何时候都能读写。

## 四、生命周期

| 钩子 | 时机 |
|---|---|
| `onload()` | 宿主启动时（打开应用即可，不必先开库）；插件启用状态变化时重新加载 |
| `onunload()` | 禁用插件、安全模式切换、宿主停止 |
| `onUserEnable()` | 用户**首次**把这个插件从关闭打到开启，全机至多一次 |

约定：

- 所有 `add*` / `register*` 注册的东西由宿主统一拆除，`onunload` 里只需要释放你自己的句柄（定时器、监听器用 `this.register(() => ...)` 挂上，宿主会一并执行）。
- **禁止顶层副作用**，逻辑写进 `onload`。
- `onUserEnable` 不再按库触发——插件是全局的，一次性引导也应该是全局的。

## 五、权限

在 `manifest.permissions` 里声明，宿主按权限裁剪 `this.app` 上的方法。

| 权限 | 含义 |
|---|---|
| `vault:read` | 读库内文件 |
| `vault:write` | 写 / 删 / 改名库内文件 |
| `ui:commands` | 注册命令 |
| `ui:ribbon` | 侧栏图标 |
| `ui:settings` | 设置页分区 |
| `ui:views` | 自定义视图 |
| `ui:status` | 状态栏 |
| `ui:theme` | 主题相关 |
| `editor:extend` | 编辑器扩展 |
| `editor:provide` | 注册一个可切换的笔记编辑器 |
| `network:safe` | 白名单联网，必须同时在 `networkAllowlist` 列出 host |
| `clipboard` | 剪贴板 |

**永不发放**：`network`（无限制）、`publish:*`、`sync:control`、`fs:arbitrary`、`shell`。申请了这些的包会被直接拒绝安装。

`network:safe` 要求 `manifest` 里写 `networkAllowlist`，支持精确 host 或 `*.example.com` 形式的有限通配：

```json
{
  "permissions": ["network:safe"],
  "networkAllowlist": ["api.example.com"]
}
```

使用时走 `this.app.network?.request(url)`，只有申请了该权限才存在这个方法。

## 六、App API 面

| 成员 | 需要权限 | 说明 |
|---|---|---|
| `app.vault.list/read/write/delete/rename/exists` | 见各方法 | 路径**相对库根**，禁止 `..` |
| `app.workspace.openNotice(msg)` | 无 | 状态提示 |
| `app.workspace.getActiveFile()` | 无 | 当前笔记 `{ path }` 或 `null` |
| `app.workspace.openFile(path)` | 无 | 打开一篇笔记 |
| `app.theme.list/getActive/setActive` | 无 | 主题切换 |
| `app.plugins.getEnabledIds()` | 无 | 已启用插件 id |
| `app.plugins.isSafeMode()` | 无 | 是否安全模式 |
| `app.network.request(url, opts)` | `network:safe` | 白名单请求 |

**没开库时**：`app.vault.list()` 返回空数组，`read/write/delete/rename` 抛 `打开库后可读写笔记`，`exists()` 返回 `false`。插件不该假设库一定存在。

### 注册命令 / 图标 / 设置页

```js
this.addCommand({ id: 'run', name: '执行', callback: () => {} })
this.addRibbonIcon({ id: 'run', title: '执行', icon: '◆', callback: () => {} })
this.addSettingTab({
  id: 'general',
  name: '常规',
  display: async (el) => {
    el.textContent = '插件自定义控件放在这里'
  },
})
}
```

### 注册编辑器（`editor:provide`）

```js
this.registerEditorProvider({
  id: 'my-editor',
  name: '我的编辑器',
  mount(container, options) {
    // 自己把编辑器画进 container，返回一个 EditorSession
    return session
  },
})
```

`EditorSession` 必须实现 `getMarkdown` / `setMarkdown` / `setEditable` / `focus` / `insertImage` / `getOutline` / `destroy` 等（完整签名见 [`@v5notes/vault-plugin-api`](../v5notes-clients/packages/vault-plugin-api/src/index.ts)）。**预览与编辑的切换只调 `setEditable`，宿主不会重新 mount**，否则撤销历史会丢。

## 七、写一个主题

`manifest.json`：

```json
{
  "id": "forest-ink",
  "name": "Forest Ink",
  "kind": "theme",
  "version": "1.0.0",
  "permissions": ["ui:theme"],
  "theme": "theme.css"
}
```

主题包**不得**申请 `network:safe`、`vault:write` 等权限，`theme.css` 只允许写约定的 CSS 变量与白名单选择器，校验失败会回退内置主题。装的主题全机共享，但**当前用哪个主题是每个库各自的**（存在该库的 `.v5notes/appearance.json`）。

## 八、安装与调试

**开发期**：把包目录放到 `<应用配置目录>/extensions/plugins/<id>/`，然后到 设置 → 插件与安全 里点「启用」，宿主会重新扫描并加载。加载失败的原因显示在该插件那一行的错误位置。

**通过设置页**：

- 「安装示例扩展」会写入 `hello-world`、`safe-fetch-demo` 两个示例插件和 `forest-ink` 主题，可当作参照物。
- 「插件目录」页可从 catalog 安装，同样落到全局目录。

**安全模式**打开时，所有非核心插件显示为 `skipped-safe-mode` 且不加载；用来定位「是不是我的插件把应用搞坏了」。

## 九、常见错误

| 现象 | 原因 |
|---|---|
| 设置页看不到这个插件 | 目录名与 `manifest.id` 不一致，或 `manifest.json` 解析失败（此类包被静默跳过） |
| 显示 `failed` + 缺 main.js | `manifest.main` 指向的文件不存在 |
| 显示 `failed` + 需要应用版本 | `minAppVersion` 高于当前宿主 |
| 命令点了没反应 | `callback` 抛错了，看状态栏提示 |
| 换台机器插件没了 | 正常：插件代码是全局的、不随库同步，需重新安装 |
| 某设置换库后丢了 | 该设置写在了 `'vault'` 层，跨库共享的应该用 `'global'` |

## 参考

| 文件 | 内容 |
|---|---|
| [`@v5notes/vault-plugin-api`](../v5notes-clients/packages/vault-plugin-api/src/index.ts) | 全部对外类型：`App`、`Plugin`、权限、`EditorSession` |
| [`plugin-host/PluginHost.ts`](../v5notes-clients/v5notes-vault-client/src/plugin-host/PluginHost.ts) | 加载、生命周期、安全模式 |
| [`plugin-host/manifest.ts`](../v5notes-clients/v5notes-vault-client/src/plugin-host/manifest.ts) | manifest 校验规则 |
| [`extension/appStorage.ts`](../v5notes-clients/v5notes-vault-client/src/extension/appStorage.ts) | 全局扩展目录 |
| [`extension/pluginData.ts`](../v5notes-clients/v5notes-vault-client/src/extension/pluginData.ts) | 两层设置读写 |
| [`plugin-host/samples/`](../v5notes-clients/v5notes-vault-client/src/plugin-host/samples/helloWorld.ts) | 可直接参考的示例插件 |
