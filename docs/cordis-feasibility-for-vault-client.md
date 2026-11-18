# 把 v5notes-vault-client 插件系统交由 Cordis 的可行性分析报告

**日期:** 2026-11-18(§7 为同日修订,纳入「编辑器可替换为插件」新需求后的再评估)
**分析对象:** `v5notes-clients/v5notes-vault-client` 现有插件系统(`PluginHost` + `@v5notes/vault-plugin-api`)
**候选框架:** [Cordis](https://github.com/cordiverse/cordis)(`@cordisjs/core`),参考落地案例 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
**决策(2026-11-18):** **当前 `v5notes-vault-client` 不引入 Cordis。** 下文分析保留作记录;§7 的「有条件采纳 / S1–S4」不再执行。插件宿主继续用现有 `PluginHost` + `@v5notes/vault-plugin-api`。编辑器可替换已按这条决策落地：`editor:provide` + 核心插件 `v5-editor`（见插件设计 §5.4），不经过 Cordis。

**结论先行(分析当时):** **技术上可行,但收益不抵成本。** Cordis 能替换 PluginHost 的"生命周期管理"那一半,但替换不了、也不必替换"权限代理 + Safe Mode + 审核边界"这一半——而后者才是这个插件系统的核心价值。迁移收益主要体现在"插件间依赖注入 / 服务发现"这一尚未被需要的能力上,成本则是真实且近期的(浏览器运行环境验证、API 不稳定、维护信号)。
**修订结论(§7,已被上面的决策取代):** 纳入"编辑器作为可替换插件"需求后,曾建议有条件采纳(先 EditorProvider 接缝,再兼容层迁 Cordis)。该建议未采纳。编辑器可替换若以后要做,走现有 PluginHost,不绑 Cordis。

---

## 1. 背景与三方的现状

### 1.1 Cordis 是什么

- **定位:** "Meta-Framework for Modern JavaScript Applications"(自述为"时空可组合性元框架",配套论文 arXiv:2608.25512)。本质是 JS 生态的插件容器:Context、Service、Fiber 生命周期、`inject` 声明式依赖、可回滚的 effects、事件系统。
- **形态:** `@cordisjs/core` npm 包,MIT,运行时依赖仅 `cosmokit` 一个,体积约 40KB(本次实测下载检查)。
- **核心概念:**
  - **Plugin**:函数 / 带 `apply()` 的对象 / 类,挂载进 Context;通过 `export const inject = ['server']` 声明依赖的服务。
  - **Service**:继承 `Service` 类,`start()` / `stop()` / `fork()` 接入生命周期,经 `declare module` 声明合并挂到 `ctx.xxx`。
  - **Fiber**:插件实例的生命周期载体,状态机 `PENDING → LOADING → ACTIVE → UNLOADING → DISPOSED`(可进 FAILED)。
  - **Effects**:插件经 ctx 注册的监听器、子插件、定时器包装等,卸载时**自动回滚**——这是它相对手写卸载逻辑的核心卖点。
  - **Events**:`emit`(同步)/ `parallel`(异步并发)/ `bail` / `serial`(短路式瀑布)。
  - **Config**:配合 schemastery 做声明式校验(《cordis.yml》→ 插件树,类似 Koishi)。
- **血统:** 即 Koishi 机器人框架 underlying 框架的演进版,作者 shigma,社区成熟度主要来自 Koishi 生态。

### 1.2 DeepSeek Harness 怎么用它

- 自述 "everything-is-a-plugin, powered by Cordis":模型适配器、工具注册表、会话日志、agent 循环**全部**是插件,无特权内核,一切可由配置(bundles/profiles + `cordis.patch.yml`)替换。
- 工程形态:pnpm monorepo,`vendor/cordis` 内嵌 Cordis(不依赖 npm 分发),`node --import tsx vendor/cordis/bin.js` 单文件启动;`dsh-base` 及上层 bundle 是"Cordis 配置行 + 代码"的分层组合。
- 关键启示:**dsh 是 Node 服务端程序**,它把"整个产品"拆成可配置替换的服务图;插件来自可信的开发者社区,信任模型与 Obsidian/V5Notes 这类桌面笔记应用**不同**。

### 1.3 v5notes-vault-client 现有插件系统

已落地(Phase 6–7,约 2100 行插件相关代码):

| 组件 | 位置 | 说明 |
|---|---|---|
| `@v5notes/vault-plugin-api` | `v5notes-clients/packages/vault-plugin-api` | Obsidian 风格稳定 API:抽象 `Plugin` 类(`onload`/`onunload`/`onUserEnable`)、`App`(vault/workspace/theme/plugins/network?)、11 项权限枚举 + 6 项禁止权限 |
| `PluginHost` | `src/plugin-host/PluginHost.ts`(422 行) | 加载/卸载、Safe Mode、启用列表持久化、命令/ribbon/设置页/视图四类注册表 |
| 权限代理 | `src/plugin-host/createPluginApi.ts` | 按 `manifest.permissions` 逐方法裁剪 `app.vault` 等;token 永不进插件可达对象 |
| `network:safe` | `src/plugin-host/networkSafe.ts` | 白名单 host + 方法限制 + 响应大小上限,宿主代理 fetch |
| CJS 加载器 | `PluginHost.loadCjsPluginClass` | `new Function('Plugin','module','exports', source)` 注入 `Plugin` 基类后执行 main.js |
| 核心插件 | `src/plugin-host/core/` | 日记、模板(吃狗粮);samples 有 hello-world、safe-fetch |
| ThemeHost | `src/theme-host/` | 一等主题品类,CSS 校验 + 回退 |

设计文档([vault-client-plugin-design.md](docs/vault-client-plugin-design.md))冻结的边界:**"权限代理 + Safe Mode + 审核"是承诺的安全模型,不承诺进程级沙箱**;第三方永不获得 publish/sync/shell/任意 fs;主题一等;发布仅官方通道。

---

## 2. 技术可行性逐项对照

### 2.1 运行环境:浏览器可行 ✅(已验证,但有保留)

- 本次实测:下载 `@cordisjs/core` 3.18.1(latest)与 4.0.0-beta.5(next)的 npm 包,静态检查 **无任何 `node:` 内建模块导入**,唯一依赖 `cosmokit` 纯 JS。core 是 ESM+CJS 双构建,可直接进 Vite/Tauri WebView 渲染进程。
- dsh 是 Node 端,但其用法(TS 源、tsx 启动)与本客户端无关;浏览器侧只需 core,不需要 loader/yaml 等外围包。
- **保留:** 无官方"browser build"承诺,README 明示 "API is not yet stable and may change without notice"。上 4.0 beta 还是 3.18 稳定线,需要自行钉住版本。

### 2.2 概念映射:Cordis 能覆盖什么

| 现有能力 | Cordis 等价物 | 映射难度 | 说明 |
|---|---|---|---|
| `onload`/`onunload` | `apply()` + Fiber 自动卸载 / `ctx.on('dispose')` | 低,甚至更优 | Cordis 卸载是**自动回滚注册过的 effects**,比现在手写 `clearSurfaceFor()` 前缀清理更不易漏 |
| `onUserEnable` | 无直接等价物,需在 `plugin()` 调用处包装 | 低 | 保留在宿主包装层即可 |
| 命令/ribbon/设置页/视图注册表 | `ctx.on('dispose')` + 自己维护注册表,或做成 Service | 中 | Cordis 不管 UI 表面,注册表逻辑仍要自己写;但每个注册天然随插件销毁回滚,`clearSurfaceFor` 可删 |
| `Plugin` 基类 + `app` 对象 | 不提供——Cordis 插件拿到的是 `ctx` | **中高** | API 形态完全不同:插件从"继承基类、持有 `this.app`"变成"接收 `ctx`、`inject` 服务"。`@v5notes/vault-plugin-api` 整包要重新设计 |
| 权限代理(`createPluginApi`) | **无** | — | Cordis 没有权限/能力安全模型。权限裁剪、network allowlist、token 隔离这层**原样保留**,与 Cordis 正交 |
| Safe Mode | 无 | 低 | 仍是宿主逻辑:Safe Mode 下只挂核心插件,不挂社区插件 |
| manifest 校验 / minAppVersion / 禁止权限 | 无 | — | 原样保留 |
| CJS `new Function` 加载 | Cordis 期望 import/require 到的真实模块 | **高** | 现在 `loadCjsPluginClass` 把字符串源码变成类再实例化;Cordis 的 fiber 管理期望挂载的是插件对象/类,需要写适配器:把加载出的类包装成 Cordis 插件单元,内部再走现有实例化流程。可行,但这是粘合层里最别扭的一处 |
| 主题(ThemeHost) | 无关 | — | 主题基本是 CSS + 元数据,不进插件生命周期,保留现状 |
| 插件间依赖(`dependencies` 字段,设计里"后期再加") | **`inject` 声明式依赖 + 就绪等待 + 消失回滚** | — | **这是 Cordis 最大的增量价值**:现在 PluginHost 按 id 字典序加载、无依赖解析;Cordis 白送"插件 A 等插件 B 的服务就绪才加载、B 被禁 A 自动卸载/回滚" |

### 2.3 成本盘点

**一次性迁移成本(估算 1–2 周工程 + 设计评审):**

1. 重写 `@v5notes/vault-plugin-api`:插件作者视角 API 大改(`Plugin` 基类 → `apply(ctx)` 或包装后的类)。**已写好的核心插件(日记、模板)、samples、文档、未来的社区插件生态全部要改**。
2. `PluginHost` 重构为 Cordis Context 树;`extension/runtime.ts` 的 start/stop 切换库流程对接 fiber dispose。
3. CJS 字符串加载器 → Cordis 插件单元适配层(最脏的一块)。
4. 注册表(commands/ribbons/settingTabs/views)逻辑保留但改为 effect 风格注册。
5. 全部测试(`PluginHost.test.ts` 等)重写适配。

**持续成本:**

- **维护信号是真实风险**:`@cordisjs/core` latest 3.18.1 发布于 2024-09-17,4.0.0-beta.5 是 2025-06-01,**已约 17 个月无新发布**(截至 2026-11);GitHub README 明示 API 不稳定;官方文档站(cordis-primer)仍在建设中。dsh 的做法是 `vendor/cordis` 整体内嵌——等于自认不能把它当稳定依赖。
- 版本钉死 + vendor 内嵌意味着安全更新要自己盯。
- 插件作者需要学习 Cordis 概念(Fiber、inject、effect),而目标生态是"Obsidian 迁移者"——设计文档明确"开发者体验贴近 Obsidian,降低迁移与学习成本"。**Cordis 心智模型与 Obsidian 完全不同,直接违背这条已冻结的设计原则。**

### 2.4 收益盘点(诚实评估)

**真实收益:**

1. **自动回滚的卸载语义**——消除手写清理遗漏类 bug(现在 `clearSurfaceFor` 靠字符串前缀匹配,本身就可改进)。这是 Cordis 最扎实的优点,但它只需要"scoped disposal"这个子集,30–50 行代码可以自实现(事实上 `Plugin.__disposeAll` 已经是一半)。
2. **插件间依赖注入**——设计文档标注"后期再加"的能力,Cordis 白送,且语义比手写依赖图完整(就绪等待、消失回滚、循环检测)。
3. **事件系统**(typed events、bail/serial 瀑布)——对 workspace 事件广播有用。
4. **热重载/配置树**——对开发体验有吸引力,但 vault 客户端首期不需要。

**虚收益(用不上):**

- dsh 式"一切皆插件、无特权内核"——**v5notes 不需要也不应该要**。笔记客户端的 vault/workspace/editor/sync 是产品内核,不是可配置替换的服务图;设计文档冻结"SyncEngine 永不对第三方开放",产品边界明确。
- HMR、YAML 配置树、bundle/profile 分层——服务端/CLI 工具的价值,桌面 GUI 应用收益有限。

---

## 3. 结论与建议

### 3.1 总体结论

| 维度 | 评级 |
|---|---|
| 技术可行性(能不能跑) | **可行**——core 无 Node 依赖,浏览器可跑(已实测验证) |
| 架构适配度(值不值得) | **低**——需要的能力只是 Cordis 的一个子集(disposal + 依赖注入),且核心卖点"一切皆插件"与产品定位冲突 |
| 安全模型贡献 | **零**——权限代理/allowlist/Safe Mode 这层真正的安全边界 Cordis 完全不涉及,迁移后原样保留 |
| 生态与学习成本 | **负收益**——目标生态是 Obsidian 开发者,Cordis 心智模型与已冻结的"贴近 Obsidian"原则冲突 |
| 维护风险 | **偏高**——17 个月无 npm 发布、API 未稳定、文档建设中;dsh 尚且选择 vendor 内嵌 |
| 迁移工作量 | 1–2 周工程量 + API breaking change,波及全部插件与文档 |

### 3.2 建议

**不建议现在迁移。** 保留现有 `PluginHost` + `vault-plugin-api` 架构,理由:

1. 插件系统已完成 Phase 6–7 闭环,处于"能用、够用"状态;迁移换来的核心增量(依赖注入、自动回滚)目前**没有真实需求驱动**——设计文档里插件间依赖是"后期再加"的占位。
2. 真正的安全边界(权限、allowlist、token 隔离)Cordis 不提供,迁了也白迁这一半。
3. API 不稳定 + 维护静默期,现在引入等于把第三方 beta 风险内置进产品。

**如果未来要吸收 Cordis 的优点,推荐两个低成本替代路径(按优先级):**

- **路径 A(推荐):在现有 `Plugin` 基类内自实现 scoped disposal**。把 `register(disposer)` 提升为命令/ribbon/tab/view 的统一注册方式(现在已经是雏形:四个 register 方法 + `__disposeAll`),删除 `clearSurfaceFor` 的前缀清理逻辑,让所有表面注册都走 disposer。约 1–2 天,零破坏,拿走 Cordis 的最大优点。
- **路径 B:插件间依赖等需求真实出现时**,在 PluginHost 里加一个"依赖排序 + 就绪门"的加载阶段(拓扑排序,约 3–5 天),语义按自家 API 设计,不必引入整个框架。
- **观察哨**:若 Cordis 4.0 正式发布、官方 browser 支持明确、文档站建成,或未来产品形态转向"可配置组合的 agent/自动化管线"(更接近 dsh 的形态),届时再重评;届时也可能直接考虑其成熟下游生态的实践。

### 3.3 与 dsh 对照的根本差异(一页话)

dsh 用 Cordis 成功的前提是:它是**开发者工具**,产品价值就在于"一切可替换、可组合成不同 profile";插件来自愿意读论文和教程的工程社区。v5notes-vault-client 是**面向笔记用户的桌面产品**,插件系统的价值在"安全的、贴近 Obsidian 习惯的扩展面",产品内核(vault、sync、editor)刻意**不可**被插件替换。框架的选择应该跟随产品形态:Cordis 是为前者生的,对后者是超配,且超配的部分(可替换内核)恰是设计文档明确禁止的方向。

---

## 7. 修订评估(2026-11-18):编辑器插件化 + 「借 dsh 名气」诉求

### 7.1 新需求:编辑器作为可替换插件

现状(已核实代码):编辑器集成面很窄——[WorkspaceView.vue:1447](../v5notes-clients/v5notes-vault-client/src/views/WorkspaceView.vue) 里仅一个 `<V5Editor v-model="content" :editable="..." :on-ready="...">` 组件,依赖 `@v5md/core`(搜索/大纲)、`@v5md/view`、`@v5md/vue` 三个自研包。**这是做「可替换编辑器」的绝佳起点**:集成面窄,意味着接缝抽出来成本低。

**关键判断:可替换编辑器与 Cordis 是两个独立决策。** 把编辑器抽成 `EditorProvider` 接缝(v1 里一个 `mount(el, doc): EditorInstance` 协议 + 查找/大纲/主题等能力探测),用现有 PluginHost 也能加载"编辑器插件"——就像 Obsidian 的核心编辑器与其插件系统的关系:编辑器本身未必需要经过 DI 框架才能可替换。Cordis 的 `inject` 能让"编辑器插件"声明依赖(如 `metadata-cache`),但这在 v1 只有一条默认实现,依赖图是一根线,用不到 Cordis 的核心优势。**正确顺序是:先抽 EditorProvider 接缝(这是产品能力),编辑器插件化落地后再决定宿主要不要迁 Cordis(这是框架选型)。** 若直接在 Cordis 里做编辑器插件,等于把两个未验证的变更捆绑在一起冒一次险。

注意 AGENTS.md 已冻结的约束:"进入和离开预览必须复用已挂载的 V5Editor 实例以保留 Markdown 状态与撤销历史"、"编辑器扩展点走 `@v5md` 抽象,不过多暴露底层实现"。可替换编辑器插件意味着这条要放宽为"默认编辑器保留此语义;第三方编辑器插件自担状态保持责任"——这是设计变更,不是技术障碍。

### 7.2 「dsh 在用所以更有卖点」——客观拆解

这个论点有真实成分,但需要诚实地看清楚:

**成立的部分:**
- dsh 确实是大流量开源项目(约 283k stars),"基于 Cordis,一切皆插件"是它的显性卖点;若 V5Notes 宣称"与 DeepSeek Harness 同款插件框架",对**开发者受众**有真实的话题性与检索性(catalog、GitHub topic、社区插件可跨项目互认心智)。
- "兼容 Cordis 生态"在叙事上是真卖点:Cordis 插件的写法(Fiber/inject/effect)一旦被开发者熟悉,理论上可横向迁移。

**打折的部分:**
- dsh 的 283k stars 用户中,真正写 Cordis 插件的是极小众;其卖点来自 agent 产品本身,**不是**来自 Cordis。Cordis 本身 npm 月发布记录显示其独立生态(Koishi 之外)尚小。
- V5Notes 的终端用户是**笔记作者**,不是 agent 开发者;"同款框架"对这批人的购买决策几乎无影响。卖点是给**写笔记插件的开发者**的,而他们被 Obsidian 的 API 习惯塑造——这恰恰与 Cordis 心智模型冲突(§3.2)。
- 结论:**"用 Cordis"作为营销叙事成立,但只对开发者侧成立,且需要产品真正兑现"可组合"才有说服力**。只换框架内核、插件 API 仍是自家封闭面,叙事会立刻被戳破。所以若采纳 Cordis,应把 `ctx` 直接暴露给插件作者(经权限代理),而不是包一层假的兼容壳。

### 7.3 「把 v5notes-vault-client 设计得更贴近 dsh」——三条路线对比

**路线一:大爆炸——宿主全面 dsh 化(把 vault/sync/editor/search 全做成 Service,一切皆插件)**
- ✗ 直接违背已冻结的产品边界:SyncEngine/发布/账号 token 永不对第三方开放;vault、sync 是产品内核,不是可替换服务图。
- ✗ 工作量:dsh 的 core 分了 7+ 个包(session/tools/agent/agent-loop/scope/llm/system-prompt),V5Notes 对应物要全部重画 Service 边界,加浏览器侧验证、CJS 加载适配、API 全重写——**估算 4–8 周全职工期**,期间 Phase 8 的官方增值功能全部阻塞。
- ✗ 风险叠加:框架换(Cordis 不稳定)+ API breaking(插件生态归零)+ 产品内核重画,三重变更同时落地,任何一处翻车都互相牵连。
- **成功率评估:低(<40%)。** 不推荐。

**路线二:兼容层——宿主内核用 Cordis,插件作者 API 保持现有 `Plugin` 基类形态**
- Cordis 只在宿主内部扮演 PluginHost 的角色:每个插件实例被包成一个 Cordis fiber,`onload/onunload` 映射到 fiber 生命周期;核心能力(vault/workspace/theme/network-safe)做成宿主自有 Service;将来 editor/metadata-cache/search 也做成 Service,插件用 `inject` 声明可选依赖。
- ✓ 插件生态零破坏:现有 hello-world、safe-fetch、日记、模板不改一行;`@v5notes/vault-plugin-api` 保持稳定;Obsidian 心智不丢。
- ✓ 拿到 Cordis 的内部好处:卸载自动回滚、依赖就绪/回滚、HMR 调试,全部惠及宿主而不用插件作者学习新范式。
- ✓ 卖点叙事诚实:开发者写的是"V5Notes 插件",宿主基于 Cordis——想写原生 Cordis 风格插件时,可以在未来开一个"pro 模式"直接暴露受限 ctx。
- 工作量:**1–2 周**(PluginHost 内部重构 + CJS 加载器适配 fiber + 测试重写),编辑器接缝另外 3–5 天(见 7.1)。
- 风险:Cordis 3.x/4.x 选择与钉版;浏览器环境需先做一个 spike 验证(约 1 天)。
- **成功率评估:高(80%+)。推荐。**

**路线三:最小吸收——不引入 Cordis,自实现 scoped disposal + EditorProvider(§3.2 路径 A + 7.1)**
- 2–3 天拿到 80% 的技术收益,零依赖风险;但**拿不到叙事卖点**。
- 若 7.2 的开发者侧卖点对本产品是重要战略(比如打算做插件市场、吸引 agent 圈开发者),则路线二值得多花一周;若卖点优先级一般,路线三仍是性价比之王。

### 7.4 编辑器插件化 v1 契约草案(无论选哪条路线都需要)

```ts
// @v5notes/vault-plugin-api 新增(概念草案)
export interface EditorInstance {
  getDoc(): string
  setDoc(md: string): void
  /** 编辑器自担状态保持;宿主不再保证跨切换复用 */
  focus(): void
  destroy(): void
  /** 能力探测:查找/大纲由宿主 UI 调用,插件可不支持 */
  supports(cap: 'find' | 'outline' | 'theme'): boolean
  find?(opts: FindOptions): Promise<OutlineEntry[]> // 形状参考 @v5md/core
}

export interface EditorProviderSpec {
  type: string           // 'v5md' | 'codemirror' | ...
  name: string
  mount(el: HTMLElement, doc: string): Promise<EditorInstance>
  /** 声明依赖的服务名,如 ['metadata-cache'];路线二下走 Cordis inject */
  requires?: string[]
}

// Plugin 基类新增
registerEditorProvider(spec: EditorProviderSpec): void   // 需 ui:editor 或新权限 editor:provider
```

宿主侧:WorkspaceView 的 `<component :is="activeEditor">` 化,默认 provider 注册内置 V5Editor;切换编辑器 = 卸载旧 provider fiber/实例 → 挂新 provider,脏检查守卫沿用现有 dirty 流程。Safe Mode 回退默认编辑器(与主题回退同语义)。

### 7.5 分阶段执行建议(若采纳路线二)——已否决,不执行

| 阶段 | 内容 | 工期 | 产出 |
|---|---|---|---|
| S1 | 浏览器 spike:Cordis core 在 Vite/Tauri WebView 里跑通 fiber 生命周期 | 1 天 | go/no-go 决策 |
| S2 | EditorProvider 接缝落地(现 PluginHost 上) | 3–5 天 | 编辑器可替换,默认仍是 V5Editor |
| S3 | PluginHost 内部迁 Cordis(兼容层) | 1–2 周 | 插件 API 不变,宿主获得 fiber/依赖注入 |
| S4 | 编辑器插件改造为 Cordis service + 权限 `editor:provider`;示例插件(如一个最小 CodeMirror 包装) | 3–5 天 | 卖点叙事可对外发布 |

S1 失败即止损回路线三;S2 独立有价值,任何路线都建议做。**关键纪律:S2 与 S3 不得合并成一个 PR/里程碑。**

### 7.6 修订后风险清单

1. Cordis 4.x 未定稿——钉 3.18.1,vendor 内嵌(学 dsh),升级走手动。
2. 权限模型新增 `editor:provider` 需更新 manifest 校验、信任 UX 与文档冻结文案(§6.2 对外承诺边界不扩)。
3. 第三方编辑器的状态保持(撤销历史)是产品体验雷区——v1 建议仅允许"预览只读渲染类"插件替换,`editable` 场景收紧到官方签名 provider;待审核机制成熟再放开。
4. 叙事风险:对外讲"Cordis"时必须同时讲权限边界,避免被理解为"可任意替换内核的 agent 框架"。

---

## 附录:信息来源

- Cordis 仓库与概念:https://github.com/cordiverse/cordis ;@cordisjs/core npm(registry 实测 3.18.1 / 4.0.0-beta.5);[koishijs/skills cordis 插件开发 SKILL](https://github.com/koishijs/skills/blob/master/skills/cordis-v3-plugin-dev/SKILL.md);[ams-harness cordis-tutorial](https://github.com/yan-mc/ams-harness/blob/main/docs/cordis-tutorial/index.md)
- DeepSeek Harness:https://github.com/deepseek-ai/deepseek-harness 及其 `docs/architecture.md`(everything-is-a-plugin、bundles/profiles、vendor/cordis)
- 本地代码与文档:`v5notes-clients/v5notes-vault-client/src/plugin-host/`、`v5notes-clients/packages/vault-plugin-api/`、[docs/vault-client-plugin-design.md](docs/vault-client-plugin-design.md)、[docs/vault-client-design.md](docs/vault-client-design.md)
- 浏览器兼容验证:本次实测 npm pack 下载两版 core,静态检查无 `node:` 内建导入(未执行下载代码)
