# V5Notes Vault Client 可执行开发计划

**受众：** Yanwei Zhu  
**依据：** `docs/vault-client-design.md`、`docs/vault-client-plugin-design.md`（已按 `vault-design-patch-notes.md` / `vault-design-review.md` 补洞）  
**原则：** 先本地可用 → 可选账号/同步 → 插件/主题 → 官方增值；**不**把 Cloud Client 改成 Vault；**不**开放第三方发布。  
**约束（全程可见）：** 双产品 / 双 API / 本地文件夹权威 / 文件级增量同步 / 冲突副本 / 第三方无发布 / Catalog ≠ 文件 sync 协议。

---

## 0. 现状锚点（脚手架必须贴合现实）

| 现状 | 对 Phase 0 的含义 |
|---|---|
| 仓库已有 `v5notes-client2/`（Tauri 2 + Vue 3 + Vite）、`v5notes2/note-modules/{note-basics,note-notes,note-system}` | Vault 客户端与 Sync 模块作为**同仓兄弟目录**落地，不另起仓库 |
| **不存在** 顶层 `packages/` npm workspace | Phase 0 **默认不强制**一次切成 monorepo；先建独立 App，共享物按需抽出 |
| 编辑器依赖为 `vendor/v5md/*.tgz`（`@v5md/core|view|vue`） | Vault 壳先 **同方式引用**（复制或 symlink vendor）；后续再抽 `@v5notes/editor` 可选 |
| Cloud deep link：`v5notes://`，bundle `xin.v5ai.v5notes.client2`，`deviceType=client` | Vault 必须独立：`v5notes-vault://`、新 identifier、`deviceType=vault_client` |
| 社交登录落地页：`v5notes-oauth-landing/` + `justauth.client-address` | Phase 3 前扩展 `app=vault` → `v5notes-vault://`；后端加 `justauth.vault-client-address` |
| Cloud API 在 `note-notes`（`/client/notes*`） | Sync **禁止**并入 note-notes；新建 `note-vault-sync`，前缀 `/vault/v1` |

**工程形态默认（文档开放题 → 本计划拍板建议）：**

1. 在仓库根创建 `v5notes-vault-client/`（镜像 `v5notes-client2` 的 Tauri+Vue 骨架）。  
2. **暂不**引入根级 npm/pnpm workspace；共享包到真正有第二消费者时再抽到 `packages/`。  
3. 后端在 `v5notes2/note-modules/note-vault-sync/` 新建 Maven 模块并挂入 `note-api`/`note-admin` 启动装配。

---

## 1. 总览：Phase ↔ 里程碑 ↔ 工作流

```
Phase 0 脚手架/冻结
  → Phase 1 本地 Vault MVP
      → Phase 2 本地打磨（token 地基）
          → Phase 3 Account（可选登录）
              → Phase 4 note-vault-sync + SyncEngine
                  → Phase 5 同步硬化
          ↘ Phase 6 PluginHost + Theme（可与 Phase 5 部分并行）
              → Phase 7 扩展 + network:safe + catalog
                  → Phase 8 官方增值与双产品收尾
|| 并行轨：v5notes-client2 继续 Cloud；套餐文案区分；不做 Vault 插件宿主
```

| 里程碑 | Phase | 用户可感知结果 | 建议主工作流 |
|---|---|---|---|
| **M1 本地可用** | 0–2 | 免登录建/开库，读写搜索稳定 | WS-A 客户端本地 |
| **M2 可同步** | 3–5 | 登录后多设备增量同步，冲突可读 | WS-B 账号 + WS-C 后端 Sync + WS-D SyncEngine |
| **M3 可扩展** | 6–7 | 主题一等 + 插件（含安全联网），无第三方发布 | WS-E 插件平台 |
| **M4 产品完整** | 8 + Cloud 文案 | 官方增值与双产品边界清晰 | WS-F 产品收尾 |

---

## 2. Phase 0 冻结清单：已有默认 vs 仍需产品拍板

### 2.1 文档已写死（开发按此执行，勿再议）

| 项 | 默认 |
|---|---|
| 双客户端 / 双 API | Cloud=`v5notes-client2`+`note-notes`；Vault=`v5notes-vault-client`+`note-vault-sync` |
| 本地权威 | 桌面用户自选文件夹；`.md` 真相；`.v5notes/` 可重建 |
| 同步身份 §6.2 | 相对 path + `/` + NFC + **case-fold 身份键** + 展示 path；保留名拒绝；symlink 不跟随出库；rename 保 `fileId` |
| Sync 硬表 §6.4 | `sync-state` / `index.sqlite` / 设备字段 / 本地 trash **永不同步**；意图配置默认同步；代码二进制默认同步关 |
| 冲突 §9.3 | 冲突副本；禁止静默覆盖；删改/rename 矩阵；副本命名模板 |
| Bootstrap 权威 | 云端空→本机增量上传；云端有内容→云端为基线；禁止静默整库覆盖 |
| 超额 | push 拒；**pull 仍允许只读**；设备超限拒新 bind |
| 插件 P1 承诺 | 权限代理 + Safe Mode + 审核；**不**承诺进程级沙箱；token 对插件不可达 |
| 第三方 | 无 `publish:*` / 无限制 network / `fs:arbitrary` / `sync:control` / `shell` |
| Deep link | Vault = `v5notes-vault://app/social-callback` |

### 2.2 仍需产品拍板（短清单；未拍板前脚手架可用括号内建议开工）

| # | 开放题 | 建议默认（可改） | 挡住谁 |
|---|---|---|---|
| 1 | 套餐售卖 **A 双 SKU** vs **B 一账号双配额字段** | **B**（实现简单、账号统一；商店文案分桶展示） | Phase 3 套餐 UI / 计费表 |
| 2 | Catalog 前缀 **A** `/vault/v1/catalog/...`（标明非文件 sync）vs **B** 旁路+独立版本头 | **A** | Phase 7；Phase 0 只记入 ADR 即可 |
| 3 | 双产品一句话定稿 | 「同一账号可登录两个客户端；Cloud 笔记与 Vault 库默认不是同一份数据。Cloud 在服务端目录树；Vault 在本机文件夹，可选同步。」 | Phase 3 登录/设置文案 |
| 4 | 商店/安装包显示名与 bundle id 字符串 | `productName=V5Notes Vault`；`identifier=xin.v5ai.v5notes.vault` | Phase 0 脚手架 |
| 5 | tombstone GC 天数 | **≥ 90 天**（文档建议） | Phase 4/5 后端 |
| 6 | 工程：何时抽 `packages/` | M1 完成后再抽 `account-sdk` / `vault-plugin-api`；Phase 0 不建 workspace | 仅节奏，不挡开工 |

**Phase 0 Done when：** 上表 2.1 全部写入团队 checklist；2.2 至少勾选 1–4（或书面接受建议默认）；空壳 App 可 `npm run tauri dev` 启动并注册 scheme。

---

## 3. 前 2–4 周（Phase 0 → Phase 1 启动）：极具体清单

### Week 1 — Phase 0 脚手架（WS-A0）

**目录与仓库动作：**

```
v5notes/
  v5notes-vault-client/          # NEW：从 create-tauri-app 或复制 client2 骨架后删业务
    package.json                 # name: v5notes-vault-client
    src/                         # Vue 空壳：欢迎占位 + 设置空页
    src-tauri/
      tauri.conf.json            # productName / identifier / deep-link schemes
      capabilities/              # fs/dialog 预留，先最小
    vendor/v5md/                 # 复用 client2 的 tgz（复制或文档约定同步方式）
  v5notes2/note-modules/
    note-vault-sync/             # NEW：空 Maven 模块 + 占位 Controller 健康检查
  docs/
    adr/vault-phase0-freeze.md   # 可选：固化 §2 勾选结果
```

**配置冻结（写入 `tauri.conf.json` / README）：**

| 键 | 值 |
|---|---|
| `productName` | `V5Notes Vault`（或拍板后的商店名） |
| `identifier` | `xin.v5ai.v5notes.vault` |
| deep link schemes | `["v5notes-vault"]` |
| 窗口标题 | 与 Cloud「V5Notes云笔记」区分，如「V5Notes Vault」 |

**交付物：**

- [ ] `v5notes-vault-client` 可编译、可启动空窗  
- [ ] scheme `v5notes-vault://` 在 macOS/Windows 开发构建上可注册（至少文档+配置就位）  
- [ ] `vault.json` / `sync-state.json` TypeScript 类型 + JSON Schema 草稿（对齐设计 §6.5）  
- [ ] 错误码枚举表 TS/Java 各一份草稿（设计 §8.2）  
- [ ] 后端空模块 `note-vault-sync` 能被父 POM 编译；`GET /vault/v1/health` 或等价占位  
- [ ] README：双产品边界一句 + 「勿把库放进网盘再开官方 Sync」  

**PR 边界建议：** `PR-0a` 客户端空壳；`PR-0b` 后端空模块（可同周并行）。

### Week 2 — Phase 0 收尾 + Phase 1 骨架

- [ ] 路径工具库：`normalizeDisplayPath` / `toIdentityKey`（NFC + case-fold）+ 非法名单测  
- [ ] `VaultWorkspace` 接口桩：open/create/switch（尚可不接真实 dialog）  
- [ ] 欢迎页 UI 三选一布局（无真实 fs 亦可先 mock）  
- [ ] 产品拍板纪要：套餐 A/B、Catalog A/B、bundle 字符串、双产品文案  

### Week 3–4 — Phase 1 核心路径（冲 M1 前半）

- [ ] Tauri `dialog` 选目录 + 动态 fs scope / 书签持久化  
- [ ] 创建库：写 `.v5notes/vault.json` + 默认 `syncignore` + 可选示例笔记  
- [ ] `VaultFs`：listTree / read / write / mkdir / rename / delete（原子写）  
- [ ] 侧栏树 + 打开 `.md` → `VaultEditorBridge` + V5Editor（预览/编辑同实例策略对齐 AGENTS）  
- [ ] 本地搜索 MVP（先全文扫描可接受）  
- [ ] **零网络、零账号、零插件市场**

**四周末目标（软门禁）：** 开发者本机可「创建库 → 写笔记 → 重启再打开 → 搜索命中」；无 Sync。

---

## 4. 分 Phase 工作包（目标 / 交付 / 验收 / 依赖 / 风险 / Done when）

### Phase 0 — 冻结与工程脚手架

| | |
|---|---|
| **目标** | 命名、协议默认、空壳可跑；团队对强约束无歧义 |
| **交付** | `v5notes-vault-client` 空壳；`note-vault-sync` 空模块；schema/错误码草稿；Phase 0 checklist 勾选记录 |
| **验收** | 两 App 可并存安装（至少不同 identifier/scheme）；文档 §2.1 默认被引用；§2.2 有决策或书面采纳建议 |
| **依赖** | 设计文档已补洞（完成） |
| **风险** | 过早上 monorepo 拖慢空壳；OAuth scheme 与 Cloud 撞车 |
| **Done when** | `tauri dev` 空壳绿；后端模块编译绿；冻结纪要入库 |

**建议 PR：** `PR-0a` 客户端壳；`PR-0b` 后端壳；`PR-0c` docs/ADR（可选）。

---

### Phase 1 — 本地 Vault MVP（免登录）→ 进 M1

| | |
|---|---|
| **目标** | 打开 App 即可建库写笔记，零网络 |
| **交付** | 欢迎三路径；`.v5notes` 骨架；树 CRUD；V5Editor 读写；路径身份键拦截；本地搜索 MVP |
| **验收** | 创建/打开/默认库均可；重启恢复最近库；非法名/仅大小写冲突被拒；预览↔编辑不丢 undo（对齐 AGENTS 精神） |
| **依赖** | Phase 0 |
| **风险** | macOS 目录权限续期；Windows 保留名；把业务写进 Vue 组件导致难测 |
| **Done when** | 无账号完整本地闭环；自动化单测覆盖 path 规范化 |

**建议 PR：** `PR-1a` VaultFs+路径；`PR-1b` 欢迎/开库；`PR-1c` 树+编辑器；`PR-1d` 搜索 MVP。

---

### Phase 2 — 本地体验打磨 → 完成 M1

| | |
|---|---|
| **目标** | 日常本地不脆；预埋 Theme CSS 变量 |
| **交付** | watcher；原子写/崩溃安全；移盘提示；最近库；本地 trash；设计 token 初版；脏保存守卫；基础快捷键 |
| **验收** | 外部改文件树能刷新；强制杀进程不丢已写入内容；trash 可还原或明确不可；内置外观可切 |
| **依赖** | Phase 1 |
| **风险** | watcher 在大库性能；token 契约事后大改影响 Phase 6 |
| **Done when** | M1 验收表全绿；「外观」设置入口存在（可仅内置） |

**建议 PR：** `PR-2a` 稳健性；`PR-2b` UX（最近库/trash/快捷键）；`PR-2c` design tokens。

---

### Phase 3 — Account 接入（可选登录）→ 开 M2

| | |
|---|---|
| **目标** | 能登录看套餐；未登录仍纯本地 |
| **交付** | Account 客户端（可先从 client2 抽薄 SDK 或复制再抽）；设置页账号区；`deviceType=vault_client`；社交回调 `v5notes-vault://`；双产品一句话；同步入口引导但不阻断编辑 |
| **验收** | 登录/登出/401 清 token；不存密码；无套餐仍可编辑；文案含「不是同一份数据」 |
| **依赖** | Phase 2；后端已有账号体系；落地页支持 `app=vault` |
| **风险** | Gitee 等单回调限制 → 需独立 OAuth 应用或中转；与 Cloud token 串用 |
| **Done when** | 可选登录闭环；同步按钮在未登录时只引导 |

**建议 PR：** `PR-3a` account 客户端 + sys_client；`PR-3b` OAuth landing/scheme；`PR-3c` 设置与文案。

---

### Phase 4 — `note-vault-sync` + SyncEngine（首版同步）→ M2 核心

| | |
|---|---|
| **目标** | 登录后文件级增量同步；冲突可见 |
| **交付（后端）** | 表 `vault_space/device/file/change`（+ blob 元数据）；vault CRUD；bind；manifest；PUT/batch；DELETE tombstone；rename 保 fileId；409 `vault.conflict.rev`；配额错误码；超额只读 pull |
| **交付（客户端）** | SyncEngine；§6.4+syncignore 过滤；bootstrap 权威；冲突副本；同步状态 UI；意图配置可进 sync（**不**依赖 PluginHost） |
| **验收** | 两设备同库增量一致；冲突出副本不丢内容；空本地绑非空云端 = pull 基线；禁止 zip 整库替换 API |
| **依赖** | Phase 3；对象存储或过渡方案（小 md 可先 DB） |
| **风险** | 身份键跨平台；误同步 sync-state；rename 拆成 delete+create |
| **Done when** | 设计 §14 同步用例主路径通过；错误码分支有 UI |

**建议 PR：** `PR-4a` DB+API 读路径；`PR-4b` 写路径+冲突；`PR-4c` SyncEngine；`PR-4d` bootstrap+冲突 UI；`PR-4e` §6.4 过滤单测。

---

### Phase 5 — 同步硬化与附件 → 完成 M2

| | |
|---|---|
| **目标** | 多设备可日常用 |
| **交付** | 空闲/后台同步；重试队列；断网恢复；设备列表/踢设备；附件上限；配额文案与 Cloud 区分；（可选）版本历史；（后置）E2E |
| **验收** | 弱网可恢复；超容量 push 拒、pull 通；超设备拒 bind；附件超限角标 |
| **依赖** | Phase 4；OSS 直传可本 Phase 引入 |
| **风险** | 大附件与配额；设备踢出与 cursor |
| **Done when** | M2 验收全绿；无 E2E 也可宣布 M2 |

**建议 PR：** `PR-5a` 队列/重试；`PR-5b` 设备管理；`PR-5c` 附件+OSS；`PR-5d` 配额文案。

---

### Phase 6 — PluginHost + Theme API → 开 M3

| | |
|---|---|
| **目标** | 可加载官方/本地功能插件；主题可切换 |
| **交付** | `@v5notes/vault-plugin-api`（可此时建 `packages/vault-plugin-api`）；PluginHost；权限代理；Safe Mode；ThemeHost + CSS 校验；`appearance.json`；核心插件：日记、模板；**无**第三方发布；**无** `network:safe` |
| **验收** | 启用/禁用热加载；无权限写入抛错；非法主题回退；Safe Mode 仅核心+内置主题；token 不可被插件枚举 |
| **依赖** | Phase 2 tokens；可与 Phase 5 **部分并行**，但以主设计依赖图为准（建议 Phase 4 完成后再大面积开宿主） |
| **风险** | API 面一次铺太大；同页隔离被误解为沙箱 |
| **Done when** | 官方日记/模板可用；外观可切社区主题包（本地装） |

**建议 PR：** `PR-6a` api 包；`PR-6b` PluginHost P1；`PR-6c` Theme P1b；`PR-6d` 日记/模板。

---

### Phase 7 — 插件扩展、安全网络与目录 → 完成 M3

| | |
|---|---|
| **目标** | 社区可装插件/主题；联网仅白名单；catalog 与 sync 版本解耦 |
| **交付** | SettingTab/Ribbon/View/postProcessor/editorExtension；MetadataCache 基础；`network:safe`；本地文件夹安装；Catalog（kind=plugin\|theme，前缀按 Phase 0 决策）；签名校验；拒绝 publishing 标签；反向链接等核心插件 |
| **验收** | 非白名单 host 失败；声称 publish 的包拒载；catalog 变更不逼 sync 客户端升级 |
| **依赖** | Phase 6 |
| **风险** | 网络策略被绕过；市场审核流程未建 |
| **Done when** | M3 验收全绿；文档写明「无第三方发布」 |

**建议 PR：** `PR-7a` API 扩展面；`PR-7b` network:safe；`PR-7c` catalog；`PR-7d` 更多核心插件。

---

### Phase 8 — 官方增值与产品收尾 → M4

| | |
|---|---|
| **目标** | 官方能力与双产品叙事完整；第三方仍无发布权 |
| **交付** | 官方 Publish/分享（若做，仅产品通道）；整库 zip **仅备份**；Cloud↔Vault 显式迁移（若需要）；帮助与套餐页全文案 |
| **验收** | 用户能理解两 App 数据关系；备份不作 Sync；社区包仍无发布 API |
| **依赖** | M2 至少稳定；M3 视产品是否强依赖插件 |
| **风险** | 迁移工具被当成「自动合并」 |
| **Done when** | M4 验收；对外帮助页上线 |

**建议 PR：** 按功能拆 `PR-8*`；Cloud 并行轨单独 PR 改文案。

---

### 并行轨 — Cloud Client（`v5notes-client2`）

| | |
|---|---|
| **目标** | 不阻塞 Vault Phase 1–2；套餐与叙事区分 |
| **交付** | 继续 `/client/notes*`；套餐展示避开 Vault 同步额度混淆；文档两产品关系；**不**引入 Vault 插件宿主 |
| **Done when** | Cloud 发版说明含双产品一句；无 Vault 插件代码混入 |

---

## 5. 建议工作流与 PR 边界（汇总）

| 工作流 | 范围 | 主要 Phase | 典型 PR 前缀 |
|---|---|---|---|
| WS-A 客户端本地 | vault-client UI/Fs/Editor | 0–2 | `PR-0a`, `PR-1*`, `PR-2*` |
| WS-B 账号 | Account SDK、OAuth、sys_client | 3 | `PR-3*` |
| WS-C 后端 Sync | `note-vault-sync` | 0 空壳 + 4–5 | `PR-0b`, `PR-4a/b`, `PR-5*` |
| WS-D SyncEngine | 客户端同步状态机 | 4–5 | `PR-4c/d`, `PR-5a` |
| WS-E 插件平台 | api / host / catalog | 6–7 | `PR-6*`, `PR-7*` |
| WS-F 产品收尾 | 官方增值、帮助、迁移 | 8 | `PR-8*` |
| WS-G Cloud 并行 | client2 文案/套餐 | 全程 | `PR-cloud-*` |

**合并规则建议：** 协议/表结构变更（Phase 4）与 UI 大改尽量不同 PR；Sync 过滤硬表变更必须带单测；禁止在 Vault PR 中改 `/client/notes` 语义。

---

## 6. 测试与质量门禁（按里程碑）

| 里程碑 | 最少测试 |
|---|---|
| M1 | path 身份键；欢迎三路径；原子写；非法名；编辑器脏守卫 |
| M2 | §6.4/syncignore；冲突矩阵抽样；bootstrap 权威；409/402/413 UI；Cloud/Vault API 隔离冒烟 |
| M3 | 权限否定；主题校验回退；Safe Mode；network allowlist；publish 权限拒载 |
| M4 | 备份 zip 不做 sync；迁移显式确认；双产品帮助页 |

---

## 7. 明确不做（排期禁区）

- 单客户端双模式合并；Vault CRUD 复用 `/client/notes`  
- 日常 Sync = 整库 zip 覆盖  
- 首期 OT/CRDT 实时协同；首期 E2E 加密（可后置）  
- 第三方发布 / 无限制网络 / 进程级插件沙箱承诺  
- `v5notes-client2` 引入同款第三方插件宿主  
- Cloud 与 Vault 数据自动互通  

---

## 8. 计划接受后的推荐下一编码动作（单一 kickoff）

**Kickoff：** 开 `PR-0a`——在仓库根创建可启动的空壳 `v5notes-vault-client/`（Tauri 2 + Vue 3），配置 `identifier=xin.v5ai.v5notes.vault`、`schemes=["v5notes-vault"]`，vendor 复用 `@v5md`，并附最小 README（双产品一句 + Phase 0 冻结引用）。**同周并行**可开 `PR-0b` 空 `note-vault-sync` 模块，但不阻塞客户端空壳合并。

在 Yanwei Zhu 书面接受本计划（含 §2.2 建议默认或改选）之前，**不开始**业务编码。

---

## 9. 文档索引

| 文档 | 路径 |
|---|---|
| 主设计 | `docs/vault-client-design.md` |
| 插件设计 | `docs/vault-client-plugin-design.md` |
| 评审 | store `docs/vault-design-review.md` |
| 补丁说明 | store `docs/vault-design-patch-notes.md` |
| 本计划 | `docs/vault-client-dev-plan.md` |
