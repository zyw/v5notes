# Vault 插件开发指南

给 `v5notes-vault-client` 写一个功能插件或主题。按顺序读下去，你能产出一个被设置页加载、能在真实库里跑起来的包。

两套官方脚手架：插件用 [`create-vault-plugin`](../v5notes-clients/packages/create-vault-plugin/)（见 3.2），主题用 [`create-vault-theme`](../v5notes-clients/packages/create-vault-theme/)（见 6.1）。

> 先读「一」。插件从哪来、装到哪、什么时候生效，这三件事决定了后面每一处细节。

---

## 一、先搞清三层数据

插件系统把「代码」「安装状态」「设置」分开存放：

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
3. **没有打开库时插件照常加载**，只是碰不到任何笔记（见 4.4）。

---

## 二、三个入口，数据从哪来

设置 → 插件与安全 上有三个和插件有关的地方。它们各有各的数据来源，理解了就不会在排查时找错方向。

### 2.1 「已安装扩展」——运行时扫描

列表不是从文件读出来的目录清单，而是 **PluginHost 内存里已完成加载尝试的插件**：

```
SettingsView        plugins = listPluginInfos()
  → extension/runtime.ts  listPluginInfos()
    → PluginHost.list()   ← 读内部 infos Map
```

`infos` 只有两类条目，启动时由 `reload()` 填进去：

| 来源 | 说明 | 行尾标签 |
|---|---|---|
| `CORE_REGISTRY` 常量 | `v5-editor` / `plain-text` / `daily-notes` / `templates`，编译进 app | 「核心」 |
| 磁盘扫描 | `extensions/plugins/*/` 下能解析出 `manifest.json` 的目录 | 「本地」 |

扫描规则（`extension/globalPlugins.ts`）：

- 跳过以 `.` 开头的目录；
- 跳过 `manifest.json` 不存在或解析失败的目录；
- 跳过 **目录名 ≠ `manifest.id`** 的包；
- 跳过 `kind: "theme"`（主题走 `extensions/themes`，由 ThemeHost 管理）。

**这些跳过是静默的**，不会在界面上留下任何一条「装错了」的提示。这是「我明明装了却看不见」最常见的两个原因：目录名对不上、manifest 解析失败。

### 2.2 「安装示例扩展」——写死在前端源码里的示例

它**不联网**。点击后执行三件事：

1. 把 `HELLO_WORLD_MANIFEST` + `HELLO_WORLD_MAIN_JS` 写成 `extensions/plugins/hello-world/{manifest.json,main.js}`；
2. 把 `SAFE_FETCH_MANIFEST` + `SAFE_FETCH_MAIN_JS` 写成 `extensions/plugins/safe-fetch-demo/…`；
3. 写入 `forest-ink`、`wanqing` 两个主题，并把两个示例插件 id 加进 `community-plugins.json` 的 `enabled`。

源码常量在 `src/plugin-host/samples/helloWorld.ts` 和 `samples/safeFetch.ts`。它是一组「写入即可用的参照物」，不是插件来源。

> 写文件用的是**覆盖写**。手改过 `extensions/plugins/hello-world/` 的文件后，再点一次这个按钮，你的改动会被源码里的常量盖掉。

### 2.3 「插件目录」——catalog

标题右侧的「服务器 / 本地种子」说明这次列表是从哪来的：

```
GET {server}/vault/v1/catalog/plugins               → 列表
GET {server}/vault/v1/catalog/plugins/{id}/package  → { files: { "manifest.json": "…", "main.js": "…" } }
```

- **服务器**：后端 `VaultCatalogController` + `VaultCatalogService`（`note-vault-sync` 模块）。目前是**硬编码的两条 seed**（`safe-fetch-demo` 插件 + `catalog-moss` 主题），没有数据库，也没有审核流程。
- **本地种子**：`src/catalog/bundled.ts` 里打包进前端的同一份内容。

请求失败、响应形状不合法、响应头协议不符时，**静默回退**到本地种子。所以看到「本地种子」只代表这次请求没拿到服务器数据，不代表目录不可用。

点「安装」会：拉取 package → 校验 manifest → 按 `kind` 写入 `extensions/plugins/<id>/` 或 `extensions/themes/<id>/` → 插件自动启用 / 主题重新扫描。安装前会拒绝 `publishing` 类标签、无限制 `network` 权限，以及文件名带 `/` 或 `..` 的包。

catalog 协议与文件同步协议**版本独立**（`/vault/v1/catalog/...` 不是 file-sync 资源）。

---

## 三、最小可运行插件

### 3.1 手工写一个

目录结构：

```
my-plugin/
  manifest.json
  main.js
```

`manifest.json`：

```json
{
  "id": "my-plugin",
  "name": "我的插件",
  "kind": "plugin",
  "version": "1.0.0",
  "minAppVersion": "0.1.0",
  "description": "一句话说明它做什么",
  "author": "你",
  "permissions": ["ui:commands"],
  "main": "main.js"
}
```

`main.js`（宿主用 `new Function` 加载，必须是 CJS 风格导出，`Plugin` 由宿主注入）：

```js
module.exports = class MyPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'say-hello',
      name: 'Say hello',
      callback: () => this.app.workspace.openNotice('Hello Vault'),
    })
  }
}
```

### 3.2 用脚手架生成

官方脚手架 `@v5notes/create-vault-plugin` 会生成上面这套结构，外加 TypeScript、打包脚本，以及直接装进本机应用目录的命令：

```bash
cd v5notes-clients/packages/create-vault-plugin
npm install
npm test

# 生成到 ../my-plugin
node bin/create-vault-plugin.js ../my-plugin --id my-plugin --name "我的插件"
cd ../my-plugin && npm install && npm run build
npm run install:app        # 拷到 <应用配置目录>/extensions/plugins/my-plugin
```

生成后的目录：

```
my-plugin/
  manifest.json          # 随包分发
  main.js                # 构建产物；随包分发
  src/main.ts            # 源码；只 import type，构建时替换成宿主注入的 Plugin
  scripts/build.mjs      # esbuild，顺带校验 manifest
  scripts/install.mjs    # 拷到本机应用目录
```

---

## 四、宿主契约

### 4.1 导出形式

宿主这样加载 `main.js`（`plugin-host/PluginHost.ts`）：

```js
const fn = new Function('Plugin', 'module', 'exports',
  source + '\n;return module.exports.default || module.exports;')
const exported = fn(Plugin, module, exports)   // 必须是 Plugin 子类
```

所以：

- `module.exports` 或 `module.exports.default` 都可以；
- **必须导出 `Plugin` 的子类**，否则该插件状态为「加载失败」，错误是「main.js 必须导出 Plugin 子类」；
- **不能把 `@v5notes/vault-plugin-api` 打进产物**。运行时 `Plugin` 由宿主注入，打进去会形成两个 `Plugin` 类，`extends` 出来的东西宿主认不出。源文件里可以正常 `import type`，构建时把该包设为 external 即可——脚手架的 `scripts/build.mjs` 已经这么做。

### 4.2 生命周期

| 钩子 | 时机 |
|---|---|
| `onload()` | 宿主启动时（打开应用即可，不必先开库）；插件启用状态变化、安全模式切换时重新加载 |
| `onunload()` | 禁用插件、安全模式切换、宿主停止 |
| `onUserEnable()` | 用户**首次**把这个插件从关闭打到开启，全机至多一次 |

约定：

- 所有 `add*` / `register*` 注册的东西由宿主统一拆除；`onunload` 里只需要释放你自己的句柄。定时器、监听器用 `this.register(() => clearInterval(t))` 挂上，宿主会一并执行。
- **禁止顶层副作用**，逻辑写进 `onload`。
- `onUserEnable` 不按库触发——插件是全局的，一次性引导也应该是全局的。

### 4.3 权限

在 `manifest.permissions` 里声明，宿主按权限裁剪 `this.app` 上的方法。调用未声明的能力会抛「缺少权限 xxx」。

| 权限 | 含义 |
|---|---|
| `vault:read` | 读库内文件（`list/read/exists`） |
| `vault:write` | 写 / 删 / 改名库内文件 |
| `ui:commands` | 注册命令 |
| `ui:ribbon` | 工作区工具条图标 |
| `ui:settings` | 设置页分区 |
| `ui:views` | 自定义视图（已登记，宿主当前无挂载点） |
| `ui:status` | 状态栏（已登记，宿主当前未渲染） |
| `ui:theme` | 切换主题 |
| `editor:extend` | 编辑器扩展（已登记，宿主当前未对外暴露） |
| `editor:provide` | 注册一个可切换的笔记编辑器 |
| `network:safe` | 白名单联网，必须同时提供 `networkAllowlist` |
| `clipboard` | 剪贴板（已登记，尚未接入 API） |

**永不发放**：`network`（无限制）、`publish:*`、`sync:control`、`fs:arbitrary`、`shell`。申请了这些的包会被直接拒绝。

`network:safe` 的 allowlist 只写 host，支持精确 host 或 `*.example.com`：

```json
{ "permissions": ["network:safe"], "networkAllowlist": ["api.example.com"] }
```

带协议、路径、端口、空格的写法会被拒绝。请求时：

- 只允许 `GET` / `HEAD` / `POST`；`GET` / `HEAD` 不得带 body；
- `POST` body 上限 64 KiB，响应上限 1 MiB，超出直接报错；
- 重定向手动跟随，每一跳都重新比对 allowlist，最多 5 跳；
- 路径里出现 `publish`、`deploy`、`wp-json/wp/v2/posts`、`ghost/api` 一类**发布类**字符串会被拒绝。

### 4.4 App API 面

| 成员 | 需要权限 | 说明 |
|---|---|---|
| `app.vault.list(path)` | `vault:read` | 返回该目录下的路径数组（不是文件名） |
| `app.vault.read(path)` | `vault:read` | 读文本 |
| `app.vault.write(path, data)` | `vault:write` | 写文本，自动建父目录 |
| `app.vault.delete(path)` / `rename(from, to)` | `vault:write` | |
| `app.vault.exists(path)` | `vault:read` | 路径均**相对库根** |
| `app.workspace.openNotice(msg)` | 无 | 状态提示 |
| `app.workspace.getActiveFile()` | 无 | 当前笔记 `{ path }` 或 `null` |
| `app.workspace.openFile(path)` | 无 | 打开一篇笔记 |
| `app.theme.list()` / `getActive()` / `getCssVariables()` | 无 | 读主题 |
| `app.theme.setActive(id)` | `ui:theme` | 切换主题 |
| `app.plugins.getEnabledIds()` | 无 | 已启用插件 id |
| `app.plugins.isSafeMode()` | 无 | 是否安全模式 |
| `app.network.request(url, opts)` | `network:safe` | 只有申请了该权限才存在 |

**没开库时**：`app.vault.list()` 返回 `[]`，`read/write/delete/rename` 抛「打开库后可读写笔记」，`exists()` 返回 `false`。插件不该假设库一定存在。

宿主对 `app` 的顶层属性做了 `writable: false`，往 `app` 上加东西会被静默忽略——自己的状态存在插件实例上。

### 4.5 注册界面

```js
// 命令：出现在工作区命令面板
this.addCommand({ id: 'run', name: '执行', callback: () => {} })

// 工作区顶部工具条图标，icon 是短文本（1~2 个字符）
this.addRibbonIcon({ id: 'run', title: '执行', icon: '◆', callback: () => {} })

// 设置 →「插件设置」分区；宿主给一个空容器，自己往里画
this.addSettingTab({
  id: 'general',
  name: '常规',
  display: (el) => { el.textContent = '插件自定义控件放在这里' },
})
```

### 4.6 注册编辑器（`editor:provide`）

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

`EditorSession` 必须实现 `getMarkdown` / `setMarkdown` / `setEditable` / `focus` / `focusAt` / `insertImage` / `getOutline` / `selectFindMatch` / `replaceNextMatch` / `replaceAllMatches` / `destroy`（完整签名见 `@v5notes/vault-plugin-api`）。

**预览与编辑的切换只调 `setEditable`，宿主不会重新 mount**，否则撤销历史会丢。换笔记用 `setMarkdown`，换 provider 才销毁旧会话。

---

## 五、设置存哪一层

`loadData` / `saveData` 都接受一个 scope 参数，默认 `'vault'`：

```js
// 这个库的模板目录 —— 每库不同，跟着库同步
const vaultPrefs = await this.loadData()
await this.saveData({ templateDir: '模板' })

// 界面密度、自己的接口地址 —— 全机一份
const globalPrefs = await this.loadData('global')
await this.saveData({ density: 'compact' }, 'global')
```

**默认值特意选 `'vault'`**：插件设置绝大多数是「上次打开哪篇笔记」「这个库的模板在哪」这类跟库内容绑定的东西，默认落库层更安全。只有真正该跨库共享的才显式写 `'global'`。

| 数据 | scope | 理由 |
|---|---|---|
| 上次打开的笔记路径、当前库的模板目录 | `'vault'` | 换个库就该变 |
| 缓存的笔记索引、这个库的标签统计 | `'vault'` | 描述的是这个库的内容 |
| 界面密度、面板折叠状态、用户自己的接口地址 | `'global'` | 跟库无关 |

**没有库时**：`loadData()` 返回 `null`，`saveData()` 抛「打开库后可保存库内设置」。全局层任何时候都能读写。

---

## 六、写一个主题

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

`theme.css` 的规则：

- 只写 CSS 变量。需要定义的 token：`--bg` `--panel` `--ink` `--muted` `--line` `--accent` `--accent-hover` `--surface` `--danger` `--danger-bg`；缺一半以上直接判失败，缺少量只回退内置值。
- **所有 `:root` 规则必须限定到本主题**，例如 `:root[data-community-theme='forest-ink']`。裸 `:root` 会把配色泄漏给其他主题，切换看起来像没生效。
- 拒绝：`@import`、`expression()`、`javascript:`、`-moz-binding`、`behavior`、`@document`、`position: fixed`、`* { all: unset }`、`* { display:none / visibility:hidden }`、远程 `url(http…)`。

主题包**不得**申请 `network:safe`、`vault:*`。校验失败会回退内置主题，设置页的「外观」区会给出失败原因。

装的主题全机共享，但**当前用哪个主题是每个库各自的**（存在该库的 `.v5notes/appearance.json`）。

### 6.1 用脚手架生成

`@v5notes/create-vault-theme` 生成一份能通过上面全部校验的三段式 `theme.css`（浅色 / 深色 / 明暗安全网），以及校验与安装脚本：

```bash
cd v5notes-clients/packages/create-vault-theme
npm test

node bin/create-vault-theme.js ../ink-night --name "墨夜" --accent indigo
cd ../ink-night
npm run check          # 只校验
npm run build          # 校验并输出 dist/
npm run install:app    # 拷到 <应用配置目录>/extensions/themes/ink-night
```

| 选项 | 说明 |
|---|---|
| `--id <id>` | `[a-z0-9-]+`，必须等于目录名；省略时由目录名推导 |
| `--name <名称>` | 显示名 |
| `--accent <颜色>` | 预设 `moss` `indigo` `brick` `plum` `amber` `slate`，或 `#rgb` / `#rrggbb` |
| `--mode <warm\|cool>` | 暖纸底 / 冷灰底 |

生成的 `theme.css` 是普通文本，直接改；`npm run check` 会按本节的每条规则重新校验，校验失败时宿主只会静默回退到「默认」，这里则会指出是哪条规则。

---

## 七、安装到 Vault Client

宿主**没有**「从文件夹导入」或「拖 zip 进来」的入口。开发期只有一条路：**把文件夹放进应用配置目录，然后启用**。

### 7.1 开发期：自动安装（推荐）

脚手架生成的 `npm run install:app` 就是这一步：

```bash
npm run build && npm run install:app
```

它把 `manifest.json` 和 `main.js` 拷到：

```
<应用配置目录>/extensions/plugins/<id>/
```

macOS 上是：

```bash
~/Library/Application Support/xin.v5ai.v5notes.vault/extensions/plugins/<id>/
```

### 7.2 手动安装

```bash
mkdir -p "$HOME/Library/Application Support/xin.v5ai.v5notes.vault/extensions/plugins/my-plugin"
cp manifest.json main.js "$HOME/Library/Application Support/xin.v5ai.v5notes.vault/extensions/plugins/my-plugin/"
```

### 7.3 启用与重载

**安装 ≠ 启用。** 文件就位后，到 设置 → 插件与安全 里点该行的「启用」。启用会触发 `PluginHost.setEnabled()` → `reload()`，重新扫描并加载，**不需要重启 app**。

顺序很重要：**先写文件，再启用**。如果先点「启用」而磁盘上还没有包，插件根本不在这份列表里，按钮不会出现。

看到的状态：

| 状态 | 含义 |
|---|---|
| 已启用 | 加载成功 |
| 已停用 | 包在，但不在 `community-plugins.json` 的 `enabled` 里 |
| 加载失败 | 加载抛错，行内给出原因（缺 main.js / 不是 Plugin 子类 / 版本不够 …） |
| 安全模式跳过 | 安全模式开着，非核心插件一律不加载 |

> **宿主没有文件监听。** 只改了 `main.js` 内容、既不切启用状态也不重开应用，设置页不会刷新。开发循环是：`npm run build && npm run install:app` → 在设置里「禁用」再「启用」。开关一次安全模式同样会触发 `reload()`。

### 7.4 分发：走插件目录

要让别人也能装，需要后端 catalog 和前端种子各加一条：

1. 后端 `VaultCatalogService` 里加一个 `SeedEntry`：`VaultCatalogItemVo` + `files`（`manifest.json` + `main.js` 的文本）；
2. 前端 `src/catalog/bundled.ts` 加对应的 `BUNDLED_ITEMS` / `BUNDLED_PACKAGES`，保持离线回退一致；
3. 用户在「插件目录」点「安装」即写入全局目录并启用。

---

## 八、常见错误

| 现象 | 原因 |
|---|---|
| 设置页看不到这个插件 | 目录名与 `manifest.id` 不一致，或 `manifest.json` 解析失败（此类包被静默跳过） |
| 显示「加载失败」+ main.js | `main.js` 没有导出 `Plugin` 子类（把 api 包打进去了，或写成 ESM `export default` 又没被转换） |
| 显示「加载失败」+ 缺 main.js | `manifest.main` 指向的文件不存在 |
| 显示「加载失败」+ 需要应用版本 | `minAppVersion` 高于当前宿主（宿主版本在 `PluginHost.ts` 的 `APP_VERSION`） |
| 改了代码没变化 | 宿主无文件监听：改完要「禁用 → 启用」 |
| 命令点了没反应 | `callback` 抛错了，看状态栏提示 |
| 改完再点「安装示例扩展」改动没了 | 示例按钮是覆盖写，会拿源码常量盖掉你的文件 |
| 换台机器插件没了 | 正常：插件代码是全局的、不随库同步，需重新安装 |
| 某设置换库后丢了 | 该设置写在了 `'vault'` 层，跨库共享的应该用 `'global'` |
| 调用 `app.network.request` 报 undefined | 没申请 `network:safe`，`app.network` 根本不存在 |
| 请求报「响应超过大小上限」 | `network:safe` 响应上限 1 MiB |

---

## 参考

| 文件 | 内容 |
|---|---|
| [`@v5notes/vault-plugin-api`](../v5notes-clients/packages/vault-plugin-api/src/index.ts) | 全部对外类型：`App`、`Plugin`、权限、`EditorSession` |
| [`create-vault-plugin`](../v5notes-clients/packages/create-vault-plugin/) | 插件脚手架：生成、构建、安装 |
| [`create-vault-theme`](../v5notes-clients/packages/create-vault-theme/) | 主题脚手架：调色、生成、校验、安装 |
| [`theme-host/cssValidate.ts`](../v5notes-clients/v5notes-vault-client/src/theme-host/cssValidate.ts) | 主题 CSS 校验规则 |
| [`plugin-host/PluginHost.ts`](../v5notes-clients/v5notes-vault-client/src/plugin-host/PluginHost.ts) | 加载、生命周期、安全模式、状态 |
| [`plugin-host/manifest.ts`](../v5notes-clients/v5notes-vault-client/src/plugin-host/manifest.ts) | manifest 校验规则 |
| [`plugin-host/permissions.ts`](../v5notes-clients/v5notes-vault-client/src/plugin-host/permissions.ts) | 可申请 / 永不可申请的权限 |
| [`plugin-host/networkSafe.ts`](../v5notes-clients/v5notes-vault-client/src/plugin-host/networkSafe.ts) | `network:safe` 的全部限制 |
| [`extension/appStorage.ts`](../v5notes-clients/v5notes-vault-client/src/extension/appStorage.ts) | 全局扩展目录 |
| [`extension/globalPlugins.ts`](../v5notes-clients/v5notes-vault-client/src/extension/globalPlugins.ts) | 扫描与启用列表 |
| [`extension/pluginData.ts`](../v5notes-clients/v5notes-vault-client/src/extension/pluginData.ts) | 两层设置读写 |
| [`catalog/`](../v5notes-clients/v5notes-vault-client/src/catalog/) | 插件目录协议、本地种子、安装 |
| [`plugin-host/samples/`](../v5notes-clients/v5notes-vault-client/src/plugin-host/samples/helloWorld.ts) | 「安装示例扩展」写入的示例源码 |

