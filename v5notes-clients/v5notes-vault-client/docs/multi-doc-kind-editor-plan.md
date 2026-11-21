# 计划：多类型文档编辑器（Markdown / 纯文本）

> 目标：编辑器可以有多个。**同一类型只启用一个编辑器**，不同类型各自对应一种新建笔记入口。
> 例：同时启用 V5 编辑器与纯文本后，新建菜单出现「新建 Markdown 笔记」「新建纯文本笔记」。

## 1. 需求拆解

| 概念 | 含义 | 现状 |
|---|---|---|
| 文档类型 docKind | `markdown` / `text` … | 不存在，所有笔记都当 Markdown |
| 编辑器类型 | 一个 provider 声明它写哪一类 | 不存在，provider 只有 id/name |
| 激活编辑器 | 每类一个当前选中的 | 全局只有一个 `active-editor` |
| 新建入口 | 按类型各一条 | 只有「新建笔记」，写死 `.md` |

### 已确认的决策

1. **类型由插件 manifest 声明，宿主只认不硬编码。** 内置 V5 编辑器声明 `markdown`，纯文本声明 `text`；第三方插件可声明新类型并自带后缀与新建名。宿主对已知类型提供内置图标与文案，未知类型按插件给的名称显示。
2. **纯文本笔记后缀定为 `.txt`。** 仓库无历史包袱，`sync/attachments.ts` 的 `TEXT_EXT` 已含 `.txt`，同步层默认走文本 PUT。
3. **不引入「同类型可选多个编辑器」的选择器。** 每类激活一个，缺省回落到该类的内置 provider。理由：同一类型挂两个编辑器时切换不可解释，也违背「同类只能有一个」。

## 2. 数据与 API 变更

### 2.1 packages/vault-plugin-api/src/index.ts

```ts
export interface EditorProviderSpec {
  id: string
  name: string
  /** 新增：该 provider 负责的文档类型。缺省视为 'markdown'（兼容存量插件）。 */
  docKind?: string
  mount(container: HTMLElement, options: EditorMountOptions): EditorSession | Promise<EditorSession>
}
```

新增 `docKind` 为**可选**，存量社区插件不写也能继续跑（按 `markdown` 处理）。

### 2.2 内置 provider

- `core/v5Editor.ts`：`docKind: 'markdown'`
- `core/plainEditor.ts`：`docKind: 'text'`

## 3. 文档类型注册表（新增 src/vault/docKinds.ts）

把「类型 → 后缀 / 新建文案 / 图标 / 内置 provider」集中一处，**消除散落在各处的 `.md` 字面量**。

```ts
export interface DocKindSpec {
  id: string
  label: string              // 'Markdown 笔记'
  newLabel: string           // '新建 Markdown 笔记'
  extension: string          // '.md'
  builtinProviderId: string  // 'v5-editor'
  icon: string
}
export const DOC_KINDS: DocKindSpec[]
export function docKindOfPath(path: string): DocKindSpec | null   // 按后缀判类，取代 isMarkdown
export function noteSuffixes(): string[]                          // 供 sync / trash / 搜索复用
```

## 4. PluginHost 改造（src/plugin-host/PluginHost.ts）

| 现有 | 改为 |
|---|---|
| `ACTIVE_EDITOR_STORAGE_KEY` 单值 | 保留该键作旧版迁移，新增 `v5notes.vault.active-editor-by-kind`（JSON map） |
| `getActiveEditor()` | `getActiveEditor(docKind?)`，缺省 `'markdown'` |
| `getActiveEditorId()` | `getActiveEditorId(docKind?)` |
| `setActiveEditor(id)` | 按 provider 的 `docKind` 写入对应槽位 |
| `listEditorProviders()` | 保留；新增 `listEditorKinds()` 返回「每类激活一个」的列表 |

**冲突规则**：同类第二个 provider 注册成功但不参与激活；它出现在类别列表里作为备选。若插件卸载导致某类无可用 provider，该类从新建菜单消失，已打开的该类笔记回落到只读提示，**不静默换成 Markdown 编辑器**（避免把 `.txt` 当 Markdown 写坏）。

**迁移**：首次启动若存在旧键且其 provider 仍加载，按该 provider 的 `docKind` 填入新 map，然后删除旧键。

## 5. 新建链路改造（WorkspaceView.vue + VaultTree.vue + NameDialog.vue）

1. `openCreateNote(parent, docKind)`：`nameDialog` 增加 `docKind` 字段。
2. `submitName` 的 `note` 分支：后缀取自 `docKindOfPath`，Markdown 初始模板写 `# title`，纯文本写空串。
3. 新建后打开的笔记按后缀选 provider 挂载。
4. **入口形态**（按 AGENTS.md「少写说明书」）：
   - 只有一个文档类型时，保持单按钮「新建笔记」，不制造多余选择；
   - 有两个及以上时，新建按钮变为菜单，每项一个文档类型，带图标与 `aria-label`；
   - `⌘N` 仍新建**当前激活笔记的类型**（无选中时用最近一次新建的类型）。
5. `VaultTree` 根节点 `add-note` 事件透传 `docKind`。

**空状态页**（WorkspaceView.vue 第 2035 行）同步改为按类型列出新建项。

## 6. 后缀驱动的既有逻辑（必须一起改，否则纯文本笔记会「消失」）

| 文件 | 现状 | 改动 |
|---|---|---|
| `vault/vaultFs.ts:68` `isMarkdown` | 只认 `.md` | 换成 `docKindOfPath(name) !== null`，决定 kind 是 note 还是 file |
| `vault/workspace.ts:164` `newestNoteMtime` | 只统计 `.md` | 统计全部笔记后缀，否则只写 `.txt` 的库被判为无活动 |
| `sync/attachments.ts:43` `classifyFileKind` | `.md` → note | 笔记后缀 → note |
| `vault/trash.ts:108` | `.md` → note | 同上 |
| `vault/search.ts` / `searchScore.ts:12` | 依赖 kind 为 note 与剥 `.md` | 统一用 `docKindOfPath` 剥后缀 |
| `WorkspaceView.vue` 10 处 `/\.md$/i`、`VaultTree.vue:133` | 字面量剥后缀 | 全部替换为 `displayNameOf(path)` |
| 备份 `backup/listFiles.ts` | 待确认 | 若只备份 `.md`，补笔记后缀 |

## 7. 设置页（SettingsView.vue 第 1081-1096 行）

按类型分组：每组一个标题（「Markdown 笔记」「纯文本笔记」）与一组单选按钮，文案改为「每类只用一个」。删掉现在那句「同一时间只用一个，切换后回到笔记生效」。切换后靠已有的 `ensureEditorMounted` 生效即可，**不新增状态行**。

## 8. 实施顺序（每步可独立验证）

| 步骤 | 内容 | 验证 |
|---|---|---|
| S1 | 新增 `vault/docKinds.ts` 与单测 | `docKindOfPath` / `displayNameOf` 覆盖大小写与无后缀 |
| S2 | 用 `docKinds` 替换所有 `.md` 字面量（行为不变，纯重构） | 既有全量测试通过，无行为变化 |
| S3 | API 加 `docKind`，内置 provider 声明类型 | 类型检查通过；存量插件无 `docKind` 仍按 markdown |
| S4 | PluginHost 按类型激活 + 旧键迁移 | 扩展 `editorProviders.test.ts`：两类互不干扰、旧键迁移、卸载回落 |
| S5 | `.txt` 笔记在树/搜索/回收站/同步中被识别 | 新增 `docKinds.test.ts` + 扩充 vaultFs/trash/search 测试 |
| S6 | 新建菜单按类型出项 | 组件测试：单类型单按钮，双类型出菜单，`⌘N` 走当前类型 |
| S7 | 设置页按类型分组 | 手测 |

## 9. 风险与开放问题

1. **导出/发布**：若有导出 HTML 或发布按 Markdown 渲染，纯文本笔记要绕过渲染。需确认现有导出带不带 `.md` 前提。
2. **搜索高亮**：`searchScore` 的 snippet 是按 Markdown 语义抽的，纯文本走同一逻辑只会少高亮，不会出错，可接受。
3. **同步冲突命名**：`engine.test.ts:411` 用 `.md` 找冲突文件，改用后缀集合后需同步调整断言。
4. **第三方 `docKind` 的信任边界**：后缀必须经 `normalizeVaultPath` 校验；非法后缀（含 `/`、空白、`..`）直接拒绝注册并报错，不静默降级。

## 10. 待你确认

- [ ] 同意「类型由 manifest 声明 + 每类内置一个不可删的 provider」这个模型？
- [ ] 纯文本后缀用 `.txt` 可以吗？（也可选 `.md` 加纯文本编辑器，但那样两类笔记无法区分，不推荐）
- [ ] `⌘N` 语义：新建**当前激活类型**，还是始终弹菜单让你选？
