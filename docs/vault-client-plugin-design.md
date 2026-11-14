# v5notes-vault-client 插件系统设计

**范围：** 仅 `v5notes-vault-client`（本地 Vault 优先）。`v5notes-client2` 首期不做第三方插件。

**参考：** Obsidian Plugin（`manifest.json` + `main.js`、`Plugin` 生命周期、`App` / `Vault` / `Workspace` / 命令与设置页）。

**关联：** [Vault 双客户端设计](vault-client-design.md)

**命名：**

| 组件 | 名称 |
|---|---|
| 宿主应用 | `v5notes-vault-client` |
| 插件 API 包 | `@v5notes/vault-plugin-api`（含 `ThemeApi`） |
| 宿主运行时 | `PluginHost` + `ThemeHost` |
| 库内功能插件目录 | `.v5notes/plugins/<plugin-id>/` |
| 库内主题目录 | `.v5notes/themes/<theme-id>/` |
| 社区缓存（可选） | 应用数据下 `installed-plugins/`、`installed-themes/` |

---

## 1. 目标与非目标

### 1.1 目标

- 用户可在 Vault 内启用/禁用第三方（及官方）插件，扩展命令、侧栏、视图、编辑器能力、文件处理。
- **主题为一等品类**：经稳定 **Theme API** 安装/切换外观（不仅是「随便塞一段 CSS」）。
- 开发者体验贴近 Obsidian：清单 + 打包入口 + `onload` / `onunload`，降低迁移与学习成本。
- **能力分级**：插件默认只能碰公开 API；网络仅开放**安全只读/白名单**类能力；危险能力（任意路径、Shell）默认不开放。
- 插件配置随库走（可同步），与「本机安装的社区包」可分离。

### 1.2 非目标（首期）

- 不兼容直接加载未改写的 Obsidian 插件（API 同构但非二进制兼容）。
- 不做任意 Node/Electron 原生模块加载。
- 不做云端远程执行插件代码；插件始终在本机宿主内加载。
- **不对第三方开放「发布」类能力**（站点托管、一键发博客/文档站、官方 Publish 等价物）；发布若需要，仅官方产品功能。
- 第三方**不得**实现整库 Sync / 替代 `SyncEngine`。
- 首期不做付费插件商店结算（可后置）；目录与签名可先做只读清单。

---

## 2. 与 Obsidian 对齐 / 刻意差异

| 维度 | Obsidian | v5notes-vault-client（采用） |
|---|---|---|
| 包结构 | `manifest.json` + `main.js`；主题多为 CSS | 功能插件同左；**主题**另有一等包格式 + Theme API |
| 生命周期 | `onload` / `onunload` | 同左；另加 `onUserEnable`（语义见 §4.2）；主题可无 JS 或仅设置控件 |
| 全局入口 | `this.app` | `this.app`（类型来自 `@v5notes/vault-plugin-api`） |
| 文件系统 | 近乎完整 Node `fs` | **禁止**默认暴露任意 `fs`；经 `app.vault` / 声明的 `permissions` |
| 网络 / 发布 | 社区插件可较自由联网与自建发布流 | **安全网络白名单**；**发布不对第三方开放** |
| 编辑器 | CodeMirror 6 | V5Editor（`@v5md`）抽象扩展点，不直接暴露底层实现细节过多 |
| 运行环境 | Electron 主/渲染混用历史包袱 | **仅渲染进程沙箱脚本** + Tauri 能力命令白名单 |
| 社区源 | Obsidian 官方库 | 自建清单 API 或静态 JSON（可挂 `note-vault-sync` 旁路） |

原则：**心智对齐 Obsidian，安全模型严于 Obsidian；主题一等公民；发布与官方 Sync 留在产品侧。**

---

## 3. 目录与启用模型

### 3.1 布局

```
MyVault/
  .v5notes/
    vault.json
    appearance.json               # 当前 themeId、色模式偏好（可同步）
    plugins/
      community-plugins.json      # 启用列表、版本钉扎（可同步）
      hello-world/
        manifest.json             # kind: "plugin"（默认）
        main.js
        styles.css                # 可选：插件局部样式（非全局主题）
        data.json
    themes/
      community-themes.json       # 已装主题列表（可同步意图）
      forest-ink/
        manifest.json             # kind: "theme"
        theme.css                 # 必需：仅写约定 CSS 变量 / 允许选择器
        theme.json                # 可选：色板、亮暗变体元数据
        main.js                   # 可选：仅 Theme 设置控件，无网络/写库默认权限
    index.sqlite
    sync-state.json
  工作/
    ...
```

应用数据（不随库同步的安装缓存，可选）：

```
~/Library/Application Support/v5notes-vault-client/
  plugin-store-cache/
  installed-plugins/
  installed-themes/
```

### 3.2 启用语义

- **安装** ≠ **启用**：下载/拷贝到 `plugins/<id>` 后，仍需在「插件」设置中打开。
- `community-plugins.json` 示例：

```json
{
  "enabled": ["hello-world", "daily-notes"],
  "versions": {
    "hello-world": "1.2.0"
  }
}
```

- 打开库时：`PluginHost` 读启用列表 → 校验 `manifest` → 按依赖顺序加载 → 失败则禁用并写入错误日志，不阻断开库。
- **主题**与功能插件分目录、分清单；同一时间仅 **一个** 社区/自选主题生效（可叠加官方「基础壳」变量）；切换走 `app.theme`（§5.6）。

### 3.3 同步

**权威总表：** 主设计 [§6.4 Sync 路径分类](vault-client-design.md)（含 `sync-state.json` / `index.sqlite` / 设备私有字段 / 本地 trash **永不同步**）。下表仅为插件相关切片；与主表冲突时以主设计为准。本规则在 **Phase 4 SyncEngine** 即生效，**不依赖** Phase 6 `PluginHost`。

| 路径 | 是否进 Vault Sync |
|---|---|
| `plugins/*/data.json`、`community-plugins.json` | **默认同步开**（设置跟库） |
| `appearance.json`、`themes/community-themes.json`、`themes/*/data.json` | **默认同步开**（当前主题意图） |
| `plugins/*/main.js`、`themes/*/theme.css` 等代码 | **默认同步关闭**（各端自装）；仅同步「启用/选中意图」 |
| `sync-state.json`、`index.sqlite`、`vault.json` 设备字段、`.v5notes/trash/**` | **永不同步**（见主设计 §6.4） |
| 官方核心插件与内置主题 | 随 App 发版，不放库内 |

文档需提示：多设备启用同一社区插件/主题时，各端需自行安装对应版本；仅同步「启用意图」。

---

## 4. 插件包契约

### 4.1 `manifest.json`

功能插件示例：

```json
{
  "id": "hello-world",
  "name": "Hello World",
  "kind": "plugin",
  "version": "1.0.0",
  "minAppVersion": "0.1.0",
  "description": "示例插件",
  "author": "v5notes",
  "authorUrl": "https://example.com",
  "isDesktopOnly": true,
  "permissions": ["vault:read", "vault:write", "ui:commands", "ui:settings"],
  "main": "main.js"
}
```

主题包示例：

```json
{
  "id": "forest-ink",
  "name": "Forest Ink",
  "kind": "theme",
  "version": "1.0.0",
  "minAppVersion": "0.1.0",
  "description": "Muted green vault theme",
  "author": "v5notes",
  "permissions": ["ui:theme"],
  "theme": "theme.css",
  "themeMeta": "theme.json"
}
```

字段说明：

| 字段 | 要求 |
|---|---|
| `id` | 稳定唯一，目录名一致，`[a-z0-9-]+` |
| `kind` | `plugin`（默认）或 `theme`（一等主题品类） |
| `version` | semver |
| `minAppVersion` | 宿主版本下限 |
| `permissions` | 能力白名单（见 §7）；主题默认仅 `ui:theme` |
| `main` | 功能插件入口，默认 `main.js`；纯 CSS 主题可省略 |
| `theme` / `themeMeta` | `kind=theme` 时样式与元数据入口 |
| `isDesktopOnly` | 真则移动端跳过 |
| `networkAllowlist` | 仅当申请 `network:safe` 时填写允许的 host 列表（见 §7.4） |

### 4.2 入口与生命周期

```ts
import { Plugin } from '@v5notes/vault-plugin-api'

export default class HelloWorldPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'say-hello',
      name: 'Say hello',
      callback: () => this.app.workspace.openNotice('Hello Vault'),
    })
  }

  onunload() {
    // 注销由 Plugin.register* 自动清理；仅释放插件自有句柄
  }
}
```

约定：

1. **必须** `export default` 继承 `Plugin` 的类（与 Obsidian 一致，降低心智切换）。
2. 所有 `register*` / `add*` 在 `onunload` 时由宿主统一拆除；插件应调用 `this.register(disposer)` 挂自有清理。
3. 禁止插件顶层副作用；逻辑放进 `onload`。
4. **`onUserEnable`（可选）：** 用户在设置中**首次**将该插件从关闭打到开启时调用一次（每个库、每个 `plugin id` 至多一次，直到卸载/清除启用记录）。用于迁移旧 `data.json`、展示权限说明、一次性引导。**不是**每次开库的钩子——每次开库仍走 `onload`；关闭走 `onunload`。未实现该方法则跳过。主题包若带 `main.js`，对等可选用，语义相同。

### 4.3 构建

- 官方脚手架：`@v5notes/create-vault-plugin`（esbuild/rollup 打成 IIFE 或 ESM）。
- 依赖：仅允许 `import` `@v5notes/vault-plugin-api`（宿主注入，**不打包进 main.js**）；其它第三方必须打进 bundle。
- 宿主用动态 `import()` / `new Function` 沙箱加载（见 §6），不跑未打包的多文件裸源码。

---

## 5. 宿主 API 面（深模块）

对外只暴露 `@v5notes/vault-plugin-api` 中的稳定类型；内部映射到 Vault Client 模块。

```
PluginHost
  ├─ App
  │    ├─ vault: VaultAdapter      → VaultFs
  │    ├─ workspace: Workspace     → 侧栏/标签/通知/模态
  │    ├─ metadataCache            → 标题、链接、标签缓存
  │    ├─ theme: ThemeApi          → 一等主题：安装态、切换、变量
  │    ├─ keymap / commands
  │    └─ plugins                  → 启用状态查询（只读）
  └─ Plugin (基类)
       addCommand / addRibbonIcon / addStatusBarItem
       addSettingTab / registerView / registerMarkdownPostProcessor
       registerEditorExtension / registerEvent
       loadData / saveData
```

### 5.1 `VaultAdapter`（对标 Obsidian `Vault`）

| 方法（示意） | 权限 | 说明 |
|---|---|---|
| `adapter.list(path)` | `vault:read` | 相对库根；禁 `..` |
| `adapter.read(path)` | `vault:read` | 文本 |
| `adapter.readBinary(path)` | `vault:read` | 附件 |
| `adapter.write(path, data)` | `vault:write` | 原子写 |
| `adapter.delete(path)` | `vault:write` | 进本地 trash 策略 |
| `adapter.rename(from, to)` | `vault:write` | |
| `on('create'\|'modify'\|'delete'\|'rename')` | `vault:read` | 事件 |

**不提供** 库根之外的绝对路径 API。`fs:arbitrary` **第三方永不可申请、宿主永不发放**（与 §7.1 / 非目标一致）；官方核心模块若需库外路径，走产品通道而非插件权限。

### 5.2 `Workspace`

- 打开/关闭笔记路径、分屏（后期）、Toast/Notice、模态框、侧栏叶子（`registerView`）。
- 获取当前活动文件：`getActiveFile(): TFile | null`。

### 5.3 `MetadataCache`

- 解析 frontmatter、wikilink/反向链接（若产品支持）、标题大纲。
- 插件可读缓存；写正文仍走 `vault.write`，由宿主重解析。

### 5.4 编辑器扩展

- `registerEditorExtension(spec)`：对接 V5Editor 公开扩展点（命令、装饰、块菜单、输入规则），**不**保证暴露完整 ProseMirror/TipTap 内部。
- Markdown 渲染后处理：`registerMarkdownPostProcessor`（预览模式 HTML 节点）。

### 5.5 设置

- `loadData()` / `saveData()` → `.v5notes/plugins/<id>/data.json`（主题可选 `.v5notes/themes/<id>/data.json`）。
- `addSettingTab`：在设置「插件」分区挂 Vue/自定义 DOM 容器（宿主提供 `SettingTab` 挂载点）。

### 5.6 Theme API（一等品类）

主题不是「功能插件顺便注入全局 CSS」，而是独立品类 + 稳定 API。

**宿主职责：**

- 维护设计 token / CSS 变量契约（颜色、字号、侧栏、编辑器画布、边框等），写入公开文档。
- 校验 `theme.css`：仅允许约定变量与白名单选择器；拒绝任意 `*` 重置、`position:fixed` 盖住安全 UI 等危险规则（规则表随版本演进）。
- 一次只激活一个用户主题；内置 fallback 主题始终可恢复。
- 设置 → 外观：浏览/启用主题；与 Safe Mode 联动（安全模式回退内置主题）。

**`app.theme` 示意：**

| 方法 | 说明 |
|---|---|
| `list(): ThemeInfo[]` | 已装主题 |
| `getActive(): string` | 当前 `themeId` |
| `setActive(id: string)` | 切换；写 `appearance.json` |
| `getCssVariables(): Record<string, string>` | 只读当前生效变量 |
| `registerStyleSettings?(schema)` | 可选：主题设置控件（色板微调），仍不得越权写库外/联网 |

**主题包权限：** 默认仅 `ui:theme`。主题 `main.js` 若存在，**不得**申请 `vault:write` / `network:*` / 发布相关能力；越权则拒绝加载。

**功能插件的局部样式：** 继续用可选 `styles.css`，作用域应尽量限制在插件 UI；**不得**冒充全局主题（无 `ui:theme` 时禁止改 `:root` 核心变量）。

### 5.7 明确不提供给第三方的 API

| 能力 | 政策 |
|---|---|
| 发布到 Web / 静态站 / 文档站托管 | **不开放**；无 `publish:*` 权限，API 面不暴露 |
| 官方 Vault Sync 协议控制面 | **不开放**；同步仅 `SyncEngine` |
| 任意 URL 上传笔记正文批量外发 | **不开放**（即便有网络，也禁止「导出整库到外部发布端点」类桥接） |

官方若做 Publish / 分享，走产品功能或**官方签名核心模块**，不进社区第三方权限模型。

---

## 6. 加载与隔离

### 6.1 加载顺序

1. 应用内置主题（fallback）→ 再应用用户选中主题（`appearance.json`）。
2. 内置核心插件（官方，随 App）。
3. 库内已启用社区/本地**功能插件**（按 `id` 字典序；显式 `dependencies` 字段后期再加）。
4. 单个失败：捕获、标记 `failed`、其余继续；主题 CSS 校验失败则回退内置主题并提示。

### 6.2 隔离策略与威胁模型（诚实边界）

| 阶段 | 策略 | 实际保证 |
|---|---|---|
| **P1** | 同页 JS 模块加载 + **API 代理**按 `permissions` 裁剪；CSS 尽量加前缀作用域 | **不是进程隔离**。恶意/被攻破插件与宿主同渲染页，技术上可尝试原型污染、读同页可达对象。硬门槛是：能力只经代理、最小权限、Safe Mode、审核；「禁止静默全库外传」在 P1 = **政策 + 权限最小化 +（Phase 7）`network:safe`**，**不是**可执行沙箱保证 |
| **P2** | iframe / Worker 跑无 UI 逻辑；UI 仍主文档（复杂度高，按需） | 较强隔离边界另议；未落地前对外不得宣称 |
| **不做** | 任意 native `.node` / 未声明 Shell / 无限制 `network` | — |

**对外/对内文案（Phase 0 冻结）：** 只承诺「权限代理 + Safe Mode + 审核」；**不**承诺进程级沙箱或「插件无法读到同页其它状态」。有 `vault:read` 的插件在获得网络能力后，仍可能分段读库外传——靠 allowlist、payload 策略与审核收敛，而非 P1 隔离神话。

**Account / Sync token：** 插件 API、`createPluginApi` 返回对象、以及可被插件触及的全局/原型上，**不得**挂载或可枚举到 Account/Sync access token。Token 仅存宿主私有闭包 / 安全存储；bridge `invoke` 由宿主代持凭证，插件侧只见业务结果或权限错误。

### 6.3 API 注入

```ts
// 伪代码
const api = createPluginApi(app, manifest) // 按 permissions 裁剪方法；永不注入 token
const mod = await import(pluginUrl)       // asset 或 blob URL
const PluginClass = mod.default
const instance = new PluginClass(api, manifest)
await instance.onload()
```

`createPluginApi`：未授予的方法直接 `throw` 或返回 `undefined` 并打日志，避免插件探测后提权。注入对象与 `Object.prototype` 污染面需审查：敏感字段不可枚举、不可写到插件可见全局。

---

## 7. 权限模型

### 7.1 权限枚举（首期）

| 权限 | 含义 |
|---|---|
| `vault:read` | 读库内文件与事件 |
| `vault:write` | 写/删/改名库内文件 |
| `ui:commands` | 注册命令与快捷键 |
| `ui:ribbon` | 侧栏图标 |
| `ui:status` | 状态栏 |
| `ui:settings` | 设置页 |
| `ui:views` | 自定义视图叶子 |
| `ui:theme` | 注册/提供主题（一等 Theme 品类） |
| `editor:extend` | 编辑器扩展 / 后处理器 |
| `network:safe` | **安全网络**：仅白名单 host + 方法限制（见 §7.4） |
| `clipboard` | 读写剪贴板 |

**不发放（第三方永不可申请）：** `network`（无限制）、`publish:*`、`sync:control`、`fs:arbitrary`、`shell`。

### 7.2 UX

- 启用插件/主题前展示权限列表；变更 `manifest.permissions` 升级后需重新确认。
- `network:safe`：展示将访问的 host 列表；用户确认后写入信任表。
- 申请了未开放权限（如发布）的包：**拒绝安装/启用**，并提示「发布仅为官方功能」。

### 7.3 与 Tauri

- 插件 **不** 直接 `invoke` 任意命令。
- 宿主维护 `plugin-bridge` 命令集；仅当权限满足时转发。

### 7.4 安全网络（`network:safe`）策略

第三方**可以**做安全联网插件，**不可以**做发布流水线。

| 规则 | 要求 |
|---|---|
| Host | 必须写在 `networkAllowlist`（精确 host 或 `*.example.com` 有限通配）；空列表拒绝 |
| 方法 | 默认仅 `GET`/`HEAD`；若需 `POST`，仅允许到白名单，且 payload 不得默认附带「整库扫描结果」 |
| 响应 | 大小上限；禁止跟随到非白名单 redirect |
| 禁止用途 | 将 Vault 笔记批量上传到博客/CMS/静态托管/「发布 API」；宿主可对已知发布类 endpoint 模式拒绝 |
| 典型允许 | 词典/天气查询、只读拉取公开元数据、用户显式粘贴的单条内容翻译（当前编辑器选区，非批量爬库） |
| AI | 允许调用用户自配 endpoint（写入 allowlist）；**禁止**插件在后台静默遍历全库外传 |

「发布类」判定（产品策略，代码+审核双轨）：catalog 标签禁止 `publishing`；运行时无 Publish API；文档与审核指南写明社区包不得宣称一键发站。

---

## 8. 品类：核心 / 社区功能插件 / 主题

| 类型 | 存放 | 更新 | 示例 |
|---|---|---|---|
| 核心功能插件 | App 内置 | 随客户端发版 | 反向链接、日记、模板、大纲增强 |
| 社区功能插件 | `.v5notes/plugins` | 市场 / 手动安装 | 日历、看板、安全联网工具、编辑增强 |
| **主题（一等）** | `.v5notes/themes` | 市场「主题」分区 / 手动安装 | 色板与排版主题；经 Theme API 切换 |
| 官方发布 / Sync | 产品功能，非社区插件 | 随客户端 / 套餐 | Publish、Vault Sync |

核心功能插件同样走 `Plugin` 基类。主题走 `kind: "theme"` + Theme API。

### 8.1 社区可做 / 不可做（摘要）

| 可做 | 不可做（第三方） |
|---|---|
| 命令、文件自动化、面板、编辑器/预览增强 | 一键发布站点 / 对外 CMS 发布管线 |
| **主题包**（Theme API） | 无限制任意联网、静默全库外传 |
| `network:safe` 白名单查询类、用户触发的单次辅助 | 接管或旁路官方 Sync |

---

## 9. 插件 / 主题市场（后期，可挂后端）

**与文件 sync 协议解耦（Phase 0 与主设计 §8.2 对齐）：** Catalog **版本与破坏性变更独立于** `note-vault-sync` 的文件 manifest/rev 协议。可选：（A）独立路由前缀（推荐文档示例仍可用 `/vault/v1/catalog/...`，但标明非文件 sync 资源）；或（B）同进程旁路 + 独立版本协商。**禁止**把 catalog 条目塞进文件 `manifest`；sync 协议 bump 不得强制市场客户端升级。

示例（路径可按 Phase 0 所选方案微调）：

```
GET /vault/v1/catalog/plugins?kind=plugin|theme
GET /vault/v1/catalog/plugins/{id}
```

包分发：

- 功能插件 zip：`manifest` + `main.js` + 可选签名。
- 主题 zip：`manifest`（`kind=theme`）+ `theme.css` + 可选 `theme.json` / 签名。
- 客户端校验 `minAppVersion`、主题 CSS 规则、可选 ed25519（官方源）。
- Catalog **不收录** 发布类第三方包；审核拒绝 `publish` 相关声明。
- 私有部署：可配置自建 catalog URL。

账号/套餐：市场浏览可匿名；部分「官方高级核心插件 / 官方主题」再与套餐挂钩（产品可选）。

---

## 10. 工程结构

```
v5notes-vault-client/
  src/
    plugin-host/           # PluginHost、加载器、权限代理
    theme-host/            # ThemeApi、CSS 校验、appearance
    ...
packages/
  vault-plugin-api/        # @v5notes/vault-plugin-api（含 ThemeApi 类型）
  create-vault-plugin/     # 功能插件脚手架
  create-vault-theme/      # 主题脚手架
  plugins/
    hello-world/
    daily-notes/
  themes/
    forest-ink/            # 示例一等主题
```

`vault-plugin-api` 跟宿主 **同版本策略**（`minAppVersion` ↔ API 版本表写在文档）。

---

## 11. 安全与滥用面

- Path：一律相对库根规范化；拒绝 symlink 逃逸（与 Vault 主设计 §6.2 一致）。
- 资源：限制单插件 CSS/内存；命令注册名强制 `pluginId:` 前缀防撞。
- 主题：CSS 变量契约 + 选择器白名单；校验失败回退内置主题。
- 网络：仅 `network:safe` + allowlist；无发布 API；「禁止静默全库外传」= 政策 + 审核 + 网络策略（P1 非沙箱保证，见 §6.2）。
- Token：Account/Sync 凭证对插件不可达（§6.2）。
- 权限：`fs:arbitrary` / 无限制 `network` / `publish:*` / `sync:control` / `shell` 第三方永不发放。
- 更新：不允许插件自改 `main.js` / `theme.css` 提权绕过（代码目录只读挂载）。
- 审计：设置页一键「安全模式」：仅核心插件 + 内置主题（对标 Obsidian Safe Mode）。

---

## 12. 实施路线

**总排期以 [Vault 主设计 §13](vault-client-design.md#13-实施路线图) 为准**（主设计 Phase 6–8 覆盖插件平台）。下表仅映射插件子系统内部切片，避免与总路线重复排期。

| 插件切片 | 对应主设计 | 内容 |
|---|---|---|
| P0 API 草案 | Phase 0 / 6 启动前 | `@v5notes/vault-plugin-api`（含 ThemeApi）、CSS 变量契约、权限表、示例文档 |
| P1 宿主最小闭环 | **Phase 6** | `PluginHost`、命令/`data.json`、权限代理、Safe Mode |
| P1b Theme 一等 | **Phase 6** | `.v5notes/themes`、`appearance.json`、校验与回退、外观设置 |
| P2 扩展面 | **Phase 7** | 视图/编辑器扩展、MetadataCache、`network:safe` |
| P3 分发 | **Phase 7** | 本地安装、catalog（plugin/theme）、拒绝 publishing 标签 |
| P4 核心与官方增值 | **Phase 6–8** | 日记/模板/反向链接；官方 Publish 仅产品通道 |

约束（排期不得违反）：

- 主题为一等品类，与功能插件同里程碑交付（Phase 6），不挪到「有空再做」。  
- 第三方永不排期「发布类 API」；`network:safe` 不进 Phase 6，放在 Phase 7。  
- **`.v5notes` 意图/配置同步（主设计 §6.4）在 Phase 4 生效**，不阻塞、也不等待 PluginHost。  
- Catalog 与文件 sync 协议版本解耦（§9）。  
- 插件平台不阻塞 Phase 1–2 本地 MVP；可与 Phase 5 同步硬化部分并行，但以主设计依赖图为准。  

---

## 13. 测试要点

- 启用/禁用热加载与泄漏（事件、DOM、命令是否卸净）。  
- 权限否定：无 `vault:write` 时写入抛错。  
- 主题：非法 CSS、切换、Safe Mode 回退；功能插件无 `ui:theme` 时不能改 `:root` 核心变量。  
- 网络：非白名单 host 失败；redirect 逃逸失败；声称发布类权限的包拒绝加载。  
- 路径逃逸、超大 `main.js`、损坏 manifest。  
- Safe Mode 下社区插件全跳过、主题回退内置。  
- API 版本：`minAppVersion` 不满足时拒绝加载并提示升级。  

---

## 14. 结论摘要

| 议题 | 结论 |
|---|---|
| 是否做插件 | **做**，且仅 Vault Client |
| 形态 | Obsidian 同款包结构与生命周期；API 包 `@v5notes/vault-plugin-api` |
| 主题 | **一等品类** + **Theme API**（`kind: theme`，独立目录与市场分区） |
| 网络 | 仅 **`network:safe`**（白名单）；禁止无限制联网与静默全库外传 |
| 发布 | **不对第三方开放**；官方产品能力另做 |
| 安全 | **权限声明 + 宿主代理**（P1 非进程隔离）；无任意 fs/shell/publish；token 不对插件暴露 |
| 代码同步 | 默认同步启用意图、`data.json`、`appearance.json`；不同步二进制；永不同步项见主设计 §6.4 |
| 市场 | catalog 分插件/主题；**协议版本独立于**文件 sync；可同进程旁路或 CDN |
| 与云端客户端 | `v5notes-client2` 首期不引入同一套第三方插件 |
