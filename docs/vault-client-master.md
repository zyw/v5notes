# v5notes Vault 客户端总设计（合并版）

本文合并原四份文档：`vault-client-design.md`（主设计）、`vault-client-plugin-design.md`（插件系统）、`vault-client-dev-plan.md`（开发计划）、`vault-deferred-features.md`（延期能力决策），并纳入 2026-11 设计评审对 §8.2 / §9.3 的修订（manifest 分页、活跃身份唯一性、bootstrap 冲突副本、getContent rev 语义、bind 端点核实结论）。修订处标注 **【协议修订 2026-11】**。

**产品定位：** 同时保留「纯云端笔记客户端」与「本地 Vault 优先、可选云同步」两类产品；后端 API 分两套；套餐与账号体系可共用。

**参考：** Obsidian Vault（用户自选文件夹）+ Obsidian Sync（加密增量同步，非整库 zip 上传）+ Obsidian Plugin（清单与生命周期）。

**命名冻结：**

| 组件 | 名称 |
|---|---|
| Vault 客户端 | `v5notes-vault-client` |
| 后端同步模块 | `note-vault-sync`（API 前缀 `/vault/v1`） |
| 插件 API 包 | `@v5notes/vault-plugin-api` |
| 云端客户端（现有） | `v5notes-client2` |
| 云端笔记 API（现有） | `note-notes`（`/client/notes*`） |

---

## 第一部分 · 总体设计

### 1. 目标与非目标

#### 1.1 目标

| 产品 | 启动 | 数据主存 | 网络 | 变现 |
|---|---|---|---|---|
| **Cloud Client**（现有 `v5notes-client2` 演进） | 需登录（或恢复 token） | 仅云端 | 强依赖 API | 账号 + 笔记套餐 |
| **Vault Client**（新建 `v5notes-vault-client`） | 免登录即可用 | 本地 Vault | 可选登录同步 | 同步配额 / 套餐 |

#### 1.2 非目标（首期不做）

- 两个客户端共用同一套「笔记 CRUD」REST（刻意拆开，避免本地语义污染云端）
- 首期跨端实时协同编辑（OT/CRDT）
- 首期把 Cloud Client 改成也落本地缓存（可后置）
- 首期兼容任意第三方 Sync（只做自有云）
- 第三方插件发布站点 / CMS 发文能力（发布若需要，仅官方产品通道；见第三部分）
- `v5notes-client2` 首期引入与 Vault 同款第三方插件宿主

### 2. 为何拆成两个客户端 + 两套 API

#### 2.1 决策

| 维度 | 同一客户端双模式 | **双客户端（采用）** |
|---|---|---|
| 启动路径 | 登录门 vs 直进 Vault，分支多 | 各自一条主路径 |
| 数据模型 | 雪花 ID vs 文件路径易缠在一起 | Cloud 继续 ID；Vault 以路径/本地 ID 为源 |
| 发布节奏 | 绑死 | Vault 可独立发版 |
| 后端 | 一个 API 要吞两种语义 | **Cloud API / Vault Sync API** 边界清晰 |
| 成本 | 短期省仓库 | 中长期省复杂度 |

#### 2.2 仍建议共享的部分（库，不是 App）

- Markdown 编辑器（V5Editor）
- 设计 token / 部分 UI 原子组件
- 账号登录、支付、套餐查询的 **Account SDK**（薄封装）
- 品牌资源、i18n 词条子集

原则：共享 **深模块**（编辑器、鉴权客户端），不共享「工作区状态机」。

### 3. 产品信息架构

```
┌─────────────────────┐     ┌──────────────────────────────┐
│  Cloud Client       │     │  Vault Client                │
│  (v5notes-client2)  │     │  (v5notes-vault-client)      │
│  登录 → 云端树/编辑  │     │  开库 → 本地树/编辑 → 可选同步│
└─────────┬───────────┘     └──────────────┬───────────────┘
          │                                │
          ▼                                ▼
┌─────────────────────┐     ┌──────────────────────────────┐
│  Cloud Notes API    │     │  Vault Sync API              │
│  /client/notes*     │     │  /vault/v1/*                 │
│  现有 note-notes    │     │  模块 note-vault-sync        │
└─────────┬───────────┘     └──────────────┬───────────────┘
          │                                │
          └────────────┬───────────────────┘
                       ▼
          ┌────────────────────────┐
          │ Account / Billing      │
          │ 注册、登录、套餐、配额  │
          └────────────────────────┘
```

**账号关系：** 同一用户可同时用两个客户端；Cloud 空间与 Vault 同步空间建议 **产品上分开计费维度**（见 §8），数据默认 **不自动互通**（避免「本地文件」与「云端笔记行」混成一份真相）。若以后要「导入云端到 Vault / 导出 Vault 到云端」，做成显式迁移工具。

### 4. Vault 落盘：自选文件夹 vs 应用沙箱

#### 4.1 Obsidian 怎么做

- **桌面默认：用户自选（或创建）文件夹作为 Vault**
  笔记是普通 `.md` + 子目录；配置在 Vault 内 `.obsidian/`。
- **移动端：** 受系统沙箱限制，更接近「应用管理的存储」，但仍保持「一个库一个根」的心智。
- 用户可有多个 Vault，切换即换根目录。

#### 4.2 方案对比

| | **A. 用户自选文件夹**（贴近 Obsidian） | **B. 应用沙箱目录** |
|---|---|---|
| 用户心智 | 「文件夹就是库」，可用访达/资源管理器、Git、网盘旁路 | 「笔记在 App 里」，路径不可见或难找 |
| 可移植 | 拷文件夹即备份；易迁机 | 依赖 App 导出；迁机靠同步或导出包 |
| 安全风险 | 用户可能把库放进已同步网盘 → **双写冲突**（Obsidian 也警告） | 较少被旁路同步踩踏 |
| 权限 | macOS/Windows 要目录权限（Tauri scope） | 权限简单 |
| 实现 | 书签路径、权限续期、移盘检测 | 路径固定，实现快 |
| 多库 | 自然（多个路径） | 要在沙箱内再模拟多库 |
| Git/外部工具 | 强 | 弱 |

#### 4.3 建议（Vault Client）

**桌面：默认 A（用户自选文件夹）；可选提供「使用应用内默认库」作为新手快捷入口（本质仍是沙箱内一个文件夹）。**

实现要点：

1. 首次启动：**创建新库 / 打开已有库**（与 Obsidian 一致）。
2. 库根写入 `.v5notes/vault.json`（配置、同步绑定、设备 id），**笔记正文仍是用户可见的 `.md`**。
3. Tauri：`dialog.open` 选目录 + 持久化 path + `fs` scope 动态授权。
4. 文档明确：**不要把 Vault 放在 iCloud/OneDrive/坚果云同步目录里再开官方 Sync**（双同步）。

**移动端（若有）：** 以 B 为主，提供「导出/导入 zip」与桌面互通。

### 5. 同步模型：整库上传 vs 按笔记增量

#### 5.1 Obsidian Sync（概念层）

- **不是**每次把整个 Vault 打成 zip 上传。
- 更接近：**按文件/笔记变更做增量同步**，带版本历史、可选端到端加密、选择性同步（设置/插件等可关）。
- 冲突时常见策略：生成冲突副本或保留多版本，而不是静默覆盖。

#### 5.2 方案对比

| | **整库上传（快照）** | **按笔记/文件增量**（贴近 Obsidian） |
|---|---|---|
| 协议复杂度 | 低：打包 → 上传 → 替换或存快照 | 高：清单、revision、分块、删除墓碑 |
| 流量与时间 | 库一大即不可用 | 可随改随传 |
| 冲突 | 难精细合并，易整库覆盖 | 可按文件冲突 |
| 版本历史 | 靠整包快照，贵 | 按文件版本更自然 |
| 离线多设备 | 弱 | 强 |
| 配额计费 | 按快照体积粗糙 | 按存储量 + 流量/设备数精细 |
| 实现周期 | MVP 快 | 中长期正确做法 |

#### 5.3 建议

| 阶段 | 策略 |
|---|---|
| **MVP（可选）** | 「首次绑定：扫描上传」= **仅 bootstrap**：客户端扫盘后**逐文件走增量 `PUT/batch`** 写入；**不是**整库替换 API，也不静默全量覆盖已有云端内容（权威规则见 §9.3） |
| **正式版** | **文件级增量同步**（同步身份键见 §6.2；content hash + rev） |
| **不做** | 每次同步 zip 整库覆盖（只可作「灾难恢复导出」，不作日常 Sync） |

### 6. Vault Client：本地领域模型

#### 6.1 库内布局（建议）

```
MyVault/                          # 用户自选根
  .v5notes/
    vault.json                    # 见 §6.5；设备字段永不同步（§6.4）
    appearance.json               # 当前主题意图（默认同步）
    syncignore                    # 可选：用户追加忽略规则（§6.6）
    index.sqlite                  # 可重建；永不同步
    sync-state.json               # 见 §6.5；永不同步
    trash/                        # 本地回收；永不同步
    plugins/                      # 见第三部分
      community-plugins.json
    themes/
      community-themes.json
  工作/
    周报.md
    项目A/
      需求.md
  附件/
    xxx.png
```

**笔记真相：** 文件系统中的 `.md`（及附件）。
**索引/同步状态：** `.v5notes/` 可重建；丢了最多全量重扫，不应丢正文。
**插件：** 启用意图与 `data.json` 可随库同步；插件代码默认各端自装；**永不同步**项见 §6.4。

#### 6.2 本地 ID（跨平台同步身份 — Phase 0 冻结）

同步层对每个库内文件使用**稳定身份键**；展示名与磁盘名可保留用户大小写，但身份比较必须跨平台一致。

| 规则 | 冻结值 |
|---|---|
| 路径形态 | Vault 根下的相对路径；段分隔一律 `/`（入库前把 `\` 规范为 `/`） |
| Unicode | 路径段与文件名一律 **NFC** 规范化后再比较 / 哈希 |
| **大小写** | **同步身份键 = NFC + 按段 Unicode case-fold（locale-independent）后的相对 path**；磁盘与 UI 保留用户原始大小写作「展示 path」。云端 `path` 存展示 path；冲突检测与去重一律用身份键。同库内禁止两个仅大小写不同的展示 path 并存（Win/macOS 默认卷上本就会撞；Linux 上客户端在扫盘时拒绝第二者并提示）。TS 侧 `toLowerCase()`，Java 侧 `toLowerCase(Locale.ROOT)` |
| 禁止名 | 拒绝 Windows 保留基名（`CON`/`PRN`/`AUX`/`NUL`/`COM1`–`COM9`/`LPT1`–`LPT9`，大小写不敏感）及尾部空格/`.`；拒绝控制字符与 `<>:"\|?*` |
| Symlink | **默认不跟随出库**（符号链接指向库外 → 跳过并记警告）；库内 symlink 不作为独立同步实体 |
| 云端键 | `fileId`（雪花**字符串**）在首次成功上传后写入本地 `sync-state`；**用户不可见**。全链路按字符串处理，禁止 JS `number` 化 |
| 重命名 | 本地 path 变更 → 同步层发显式 `rename`（**保留同一 `fileId`**）；禁止默默拆成无关联的 delete+create（否则丢版本历史）。仅当对端无 rename 能力/迁移脚本时才允许 delete+create（新 `fileId`）。**【协议修订 2026-11】** SyncEngine push 阶段必须比对 `sync-state` 与扫盘结果：跟踪中的 clean 文件的身份键在本机消失且匹配到一个未跟踪新文件 → 发 `rename`；本机消失且无匹配 → 发 tombstone `DELETE`。二者此前均未实现，导致云端残留幽灵文件、他端收不到删除（修复见 `src/sync/engine.ts` 推送传播段与 `engine.test.ts`） |

#### 6.3 客户端模块（深模块切分）

| 模块 | 接口职责（小） | 实现内藏 |
|---|---|---|
| `VaultWorkspace` | open/create/switch vault | 权限、书签、最近库列表 |
| `VaultFs` | listTree / read / write / mkdir / rename / delete | 平台 fs、原子写、回收站 |
| `VaultSearch` | search(query) → hits | sqlite FTS / 扫描缓存 |
| `VaultEditorBridge` | openPath / save | 与 V5Editor 对接、脏检查 |
| `PluginHost` / `ThemeHost` | load/unload、权限代理、Safe Mode、主题切换 | 见第三部分 |
| `SyncEngine` | login / bind / pushPull / status | 队列、冲突、重试、配额错误 |
| `AccountClient` | 登录、套餐、支付入口 | 可与 Cloud 共用 SDK |

UI（侧栏树、搜索、设置）只依赖上述接口，不直接打 Sync HTTP；插件只经 `PluginHost` 注入的 `@v5notes/vault-plugin-api` 访问能力。

#### 6.4 Sync 路径分类（`.v5notes/` 包含 / 排除硬表）

**适用范围：** Phase 4 起 SyncEngine 即按本表过滤；**与 PluginHost（Phase 6）是否已实现无关**——配置意图文件在 Phase 4 就可进 Sync。插件章节 §17.3 与本表一致，冲突以本表为准。

| 路径 / 类别 | Sync | 说明 |
|---|---|---|
| 用户 `.md` / 附件（库根下非点目录） | **默认同步开** | 正文真相 |
| `.v5notes/appearance.json` | **默认同步开** | 当前主题 / 色模式意图 |
| `.v5notes/plugins/community-plugins.json` | **默认同步开** | 启用列表与版本钉扎意图 |
| `.v5notes/themes/community-themes.json` | **默认同步开** | 已装主题意图 |
| `.v5notes/plugins/*/data.json`、`.v5notes/themes/*/data.json` | **默认同步开** | 插件/主题设置意图 |
| `.v5notes/plugins/*/main.js`、`styles.css`、主题 `theme.css` 等代码二进制 | **默认同步关** | 各端自装；仅同步启用/选中意图 |
| `.v5notes/sync-state.json` | **永不同步** | 本机 cursor / baseRev / dirty / 设备视角 |
| `.v5notes/index.sqlite`（及 FTS 旁路文件） | **永不同步** | 可重建索引 |
| `.v5notes/vault.json` 中的本地设备字段（`deviceId`、本机路径书签、本地 salt 缓存等） | **永不同步** | 可同步的仅限显式列出的绑定元数据（如 `cloudVaultId`）；实现须字段级白名单，默认拒绝 |
| `.v5notes/trash/**`（本地回收站） | **永不同步** | 与云端 tombstone / 云 trash 分开；他端以 tombstone 为准删文件 |
| 其它未列名的 `.v5notes/**` | **默认永不同步** | 新增路径须先改本表再进 Sync |

误同步 `sync-state` / 索引 / 设备字段会导致跨设备互相踩踏或「幽灵冲突」——视为协议级缺陷，禁止「先传着再说」。

#### 6.5 关键配置 schema

**`.v5notes/vault.json`（示意）：**

```json
{
  "schemaVersion": 1,
  "localVaultId": "ulid-or-uuid",
  "name": "MyVault",
  "createdAt": "2026-11-14T08:00:00.000Z",
  "binding": {
    "server": "https://api.example.com",
    "cloudVaultId": null,
    "deviceId": "ulid",
    "lastCursor": null
  }
}
```

- `localVaultId`：本机生成；「打开已有库」复用文件内值。
- `binding.cloudVaultId`：未绑定为 `null`；绑定后写入。**一本地库 ↔ 一云端库**（首期不做一对多）。
- `deviceId` / `lastCursor` 等设备字段：**永不同步**（§6.4）；可同步的绑定元数据须字段级白名单。

**`sync-state.json`（示意；大库可迁 sqlite）：**

```json
{
  "schemaVersion": 1,
  "files": {
    "工作/周报.md": {
      "fileId": "1938...",
      "identityKey": "工作/周报.md",
      "localHash": "sha256:...",
      "remoteRev": 12,
      "status": "clean",
      "size": 1024,
      "mtimeMs": 1731560000000
    }
  }
}
```

`status`：`clean` | `dirty` | `conflict` | `error`。本文件整体 **永不同步**。

#### 6.6 用户 `syncignore`（硬表之上的追加忽略）

§6.4 是协议硬表（不可被用户关掉「永不同步」项）。此外允许 `.v5notes/syncignore`（gitignore 风格）**追加**忽略用户内容路径，例如大目录、导出缓存。

默认建议写入（可随脚手架生成，用户可改「用户内容」行）：

```
.git/
.DS_Store
Thumbs.db
*~
.*.swp
```

SyncEngine：先应用 §6.4，再应用 `syncignore`；被忽略的用户文件不进 manifest。

#### 6.7 首次启动与多库 UX

1. **欢迎页三选一：** 创建新库（选父目录 + 库名）/ 打开已有库 / 使用应用内默认库。
2. 创建时写入 `.v5notes/` 骨架（含默认 `syncignore`）+ 可选「快速开始」示例笔记。
3. **最近库列表**存应用数据（非库内）；打开失败（权限/移盘）→「重新授权 / 从列表移除」。
4. 切换库：脏检查 → 卸载 PluginHost → 切换根 → 再加载。
5. 文案警告：勿将库放在网盘同步目录后再开官方 Sync。

### 7. Cloud Client：保持现架构

- 继续：`登录 → token → /client/notes` + `/client/notes/dir` + search。
- **不**引入 Vault 文件夹；本地最多以后加「离线缓存」（另一项目）。
- 套餐：限制笔记数、存储、协作等（现有或扩展 `client.account.*`）。

与 Vault 的差异要写进产品文案，避免用户以为「两个 App 是同一份笔记」。

**双产品边界（文案提前，不等 Phase 8）：** 自 Phase 3 起，登录相关 UI / 帮助中须有一句固定说明——同一账号可登录两个客户端，但 **Cloud 笔记与 Vault 同步库默认不是同一份数据**；「我的笔记在哪」指向当前产品（Cloud 在服务端目录树；Vault 在本机文件夹，可选同步）。完整帮助页可后置，**这一句不得缺席**。

### 8. 后端：两套 API

#### 8.1 Cloud Notes API（现有，保留）

前缀示例：`/client/notes`、`/client/notes/dir`、`/client/notes/search`、trash、account…

语义：**服务端权威**；ID 为雪花字符串；目录树在 DB。

#### 8.2 Vault Sync API（新建）

独立 Maven 模块：`note-modules/note-vault-sync`；API 前缀：`/vault/v1/...`（同进程挂载即可，勿并入 `note-notes` 的云端 CRUD 语义）。

##### 核心资源

- **Vault（云端库）：** 用户可有 1..N 个同步库（套餐限 N 与容量）。
- **File：** 库内相对 **展示 path** + **身份键**（§6.2）+ 类型（note/asset/config）。
- **Revision：** 每文件单调 `rev`；全局 **cursor 不透明、单调**（客户端只存字符串，禁止本地解析/回拨）。
- **fileId / rename / tombstone（协议语义 — Phase 0 冻结）：**

| 事件 | 语义 |
|---|---|
| 首次上传某身份键 | 分配新 `fileId`（雪花字符串）；写入本地 `sync-state` |
| 显式 `rename` | **同一 `fileId`**；更新展示 path；历史版本跟 `fileId` |
| tombstone（删除） | 保留 `fileId` + path 身份键一段时间供他端拉取；**tombstone 保留 ≥ 设备最长离线窗口（建议 ≥ 90 天，产品可调）**，过期后可 GC |
| tombstone 后再创建**同身份键** path | **新 `fileId`**（视为新文件）；旧 tombstone 不再复活；版本历史不自动合并 |
| 禁止 | 把「仅大小写不同」的 path 当成两个 `fileId`；把未声明的 delete+create 当成 rename |

##### 推荐接口（增量）

```
POST   /vault/v1/vaults                 # 创建云端库，返回 vaultId
GET    /vault/v1/vaults                 # 列表
POST   /vault/v1/vaults/{id}/bind       # 设备绑定（deviceId, clientInfo）
                                        # 【核实 2026-11】端点存在：VaultSpaceController#bind，
                                        # 内含设备数上限执法（超限拒 bind）

GET    /vault/v1/vaults/{id}/manifest?since=CURSOR
       # 返回变更列表：upsert/delete/rename + fileId + remoteRev + contentHash + size
       # CURSOR 不透明单调；空 cursor = 从初始快照起
       # 【协议修订 2026-11】分页协议冻结，见下「manifest 分页」

PUT    /vault/v1/vaults/{id}/files      # 上传/更新（path, fileId?, baseRev, hash, body或blob）
       # baseRev 冲突 → 409 + 服务端副本元数据

POST   /vault/v1/vaults/{id}/files/batch
DELETE /vault/v1/vaults/{id}/files      # path + baseRev（墓碑）

POST   /vault/v1/vaults/{id}/renames    # from → to + baseRev（保留 fileId）

GET    /vault/v1/vaults/{id}/files/content?path=&rev=
       # 【协议修订 2026-11】rev 与服务端当前 rev 不一致 → 409 vault.conflict.rev，
       # 不得静默返回最新内容（否则客户端把新版本错记为所请求的 rev）

GET    /vault/v1/quota                  # 套餐剩余容量、设备数
```

认证：与现网同一 OAuth2/Sa-Token；`deviceType` 可用 `vault_client`。
**不要**复用 `/client/notes` 的「建笔记就写 note 表当权威」语义给 Vault——否则路径模型与 ID 模型打架。

**Catalog 与 sync 前缀解耦：** 插件/主题目录 API **版本与破坏性变更独立于** `note-vault-sync` 文件协议。Phase 0 二选一冻结：（A）独立前缀如 `/vault/v1/catalog/...` 且文档标明「非文件 sync 资源」；或（B）同进程旁路路由，但仍使用**独立版本协商头/字段**，sync 协议 bump 不得强制 catalog 客户端升级。禁止把 catalog 响应塞进文件 `manifest`。

##### manifest 分页【协议修订 2026-11】

单页变更上限 **`MANIFEST_PAGE_LIMIT = 500`**（后端常量，`VaultSyncServiceImpl`）。

- 响应新增布尔字段 **`hasMore`**：`true` 表示游标之后仍有未返回变更。实现方式：SQL `LIMIT 501` 探测，超过 500 条则截断并置 `hasMore=true`。
- 客户端 pull 循环必须持续以返回的 `cursor` 请求 `manifest?since=`，直到 `hasMore=false`；**只有最后一页**的 cursor 才写入 `vault.json` 的 `binding.lastCursor`。中途任何一页都不得推进持久化游标，否则该页之后的变更被永久跳过。
- 防御：`hasMore=true` 但 `changes` 为空或 cursor 未前进时，客户端终止本次循环（防止病态服务端造成无限翻页）。
- 回归测试：后端 `VaultSyncManifestPaginationTest`（4 例）；客户端 `engine.test.ts`「manifest pagination (§8.2)」（2 例）。

##### 表结构草稿（元数据）

| 表 | 要点 |
|---|---|
| `vault_space` | `id`（雪花字符串）、`user_id`、`name`、`created_at` |
| `vault_device` | `id`、`vault_id`、`device_id`、`client_info`、`last_seen_at` |
| `vault_file` | `id`（=fileId）、`vault_id`、展示 `path`、`identity_key`、`type`、`content_hash`、`size`、`rev`、`deleted`、`updated_at` |
| `vault_file_blob` | `content_hash`、`storage_key`、`size`（内容寻址去重） |
| `vault_change` | `vault_id`、`cursor`、`file_id`、`op`（upsert/delete/rename）、`path`、`from_path`、摘要 |

ID 一律 **字符串**。索引：`(vault_id, identity_key)` 供 manifest；活跃唯一性见下。

##### 活跃身份唯一性【协议修订 2026-11】

数据库层面 `(vault_id, identity_key)` **不能**建成简单 UNIQUE 索引：软删除历史行（tombstone 保留期内）与新活跃行共享身份键，唯一约束会拒绝「删除后重建同名文件」这一合法流程（§8.2 tombstone 语义要求新 `fileId` 而非复活旧行）。实际迁移脚本（V18，MySQL/PG 两版）建立的是**普通**索引 `idx_vault_file_vault_identity`。

并发防护由服务层承担：`putFile` 插入分支在写入前调用 `findLiveByIdentityForUpdate(vaultId, identityKey)` —— 先 `SELECT ... FOR UPDATE` 锁 `vault_space` 行（以库为粒度串行化同库并发写），再复查该身份键是否存在活跃文件；存在则按冲突返回 `409 vault.conflict.rev`（携带既有 `fileId`/rev/hash）。此规则写入协议：**同一 vault 同一 identity_key 至多一个非删除 `vault_file` 行**，由服务端强制，客户端不得假设可通过竞态创建双胞胎。

##### getContent rev 语义【协议修订 2026-11】

`GET .../files/content?path=&rev=`：请求的 `rev` 非空且不等于服务端当前 rev → 抛 `409 vault.conflict.rev`。客户端引擎捕获后跳过该 change（不写盘、不推进 state 中该文件条目），下个同步周期重新经 manifest 对齐。旧实现「rev 不符静默回落最新内容」会把最新正文错记为所请求的 rev，制造假冲突或掩盖真冲突——已废弃。

##### manifest 响应示意

```json
{
  "cursor": "opaque-next",
  "hasMore": false,
  "changes": [
    {
      "op": "upsert",
      "path": "工作/周报.md",
      "fileId": "1938...",
      "remoteRev": 12,
      "contentHash": "sha256:...",
      "size": 1024,
      "type": "note"
    },
    { "op": "delete", "path": "旧笔记.md", "fileId": "1937...", "remoteRev": 3 },
    { "op": "rename", "from": "a.md", "to": "b.md", "fileId": "1936...", "remoteRev": 4 }
  ]
}
```

##### 错误码空间（HTTP + 业务码）

| HTTP | 业务码（示意） | 含义 |
|---|---|---|
| 401 | `auth.unauthorized` | 未登录/过期 |
| 402/403 | `vault.quota.exceeded` | 容量或设备数超额 |
| 404 | `vault.not.found` / `vault.file.not.found` | |
| 409 | `vault.conflict.rev` | `baseRev` 不匹配，或 content 请求 rev 过期；body 带服务端 path/rev/hash/fileId |
| 413 | `vault.file.too.large` | 超单文件上限 |
| 429 | `vault.rate.limited` | |
| 400 | `vault.path.invalid` | 路径/身份键规范化失败 |

客户端须按码分支 UI（冲突副本 / 引导扩容 / 重新登录），勿只 toast 原始报文。

##### 存储

- 元数据：DB（上表）。
- 正文/附件：对象存储（S3/OSS）；小 Markdown 也可先存 DB，但附件必须对象存储。
- 内容寻址：`contentHash`（sha256）去重与完整性校验；Phase 5 可加 `uploadToken` 直传 OSS。

#### 8.3 Account / Billing（可共用）

```
注册 / 登录 / 社交登录
GET  /client/account/plan
POST 购买套餐、Webhook
配额：cloud_notes_* 与 vault_sync_* 分字段
```

| 套餐能力示例 | Cloud Client | Vault Client |
|---|---|---|
| 笔记数量 / 云端目录 | ✓ | — |
| 同步容量 GB | — | ✓ |
| 同步设备数 | — | ✓ |
| 版本历史保留天数 | 可选 | ✓ |
| 第三方登录 | ✓ | ✓（仅账号） |

**售卖形态与超额（Phase 0 必须勾选冻结，见第四部分）：**

| 开放题 | 可选方案（择一写入计费方案） |
|---|---|
| 套餐售卖 | **A)** 两个 SKU（Cloud 笔记套餐 / Vault 同步套餐）可独立购买；**B)** 一账号两配额字段，单一商品内含两桶额度 |
| 同步超额 push | 一律拒绝 push（`402/403` + 可读错误码）；本地编辑不阻断 |
| 同步超额 pull | **冻结建议：仍允许只读 pull**（已有云端变更可拉取；避免「超额后多设备永久分叉」）；产品若改「超额双禁」须显式改本文与 Phase 0 勾选 |
| 设备数超限 | 拒绝新 `bind`；已绑定设备可继续 sync，直到用户踢设备或升级 |

#### 8.4 Vault Client 社交登录回调

与 Cloud Client **分应用标识**，避免 deep link 抢夺：

| | Cloud（client2） | Vault Client |
|---|---|---|
| Deep link | `v5notes://app/social-callback` | `v5notes-vault://app/social-callback` |
| `justauth` 基址 | `justauth.client-address` | 新增 `justauth.vault-client-address`（或同字段分环境） |
| OAuth 应用回调 | 登记 Cloud 回调 | **另登记** Vault 回调（Gitee 等常限单回调 → 常需独立 OAuth 应用或中转页） |
| `sys_client` | 现有 client | `deviceType=vault_client`，grant 含密码/社交 |

落地页可复用 `v5notes-clients/v5notes-oauth-landing/`，按 `app=vault` 唤起对应 scheme。

### 9. SyncEngine 详细流程

#### 9.1 状态机（每文件）

`clean` → 本地编辑 → `dirty` → push 成功 → `clean`
pull 发现新 rev → 若 local dirty → `conflict` → 用户处理 → `clean`

#### 9.2 一次同步循环

1. 应用 §6.4 + `syncignore`；读本地 `sync-state` + 扫盘（或 watcher 队列）。
2. `GET manifest?since=cursor`，**分页循环直至 `hasMore=false`**（§8.2 分页协议）；仅最后一页 cursor 持久化。
3. **合并策略（默认）：**
   - 仅远端变：下载覆盖本地（若 local clean）。
   - 仅本地 dirty：upload（带 `baseRev`）。
   - 两边都变：冲突（见下）。
4. push 阶段先做 **rename/tombstone 传播**（§6.2【协议修订 2026-11】），再推 dirty 正文。
5. 更新 cursor、记失败重试。

#### 9.3 冲突（建议默认，贴近 Obsidian 可理解性）

**原则：** 冲突默认生成冲突副本；**禁止**静默选一边覆盖。UI 可提供对比；3-way merge 为后期可选项。

##### 冲突矩阵（超出「双端改正文」）

| 场景 | 默认处理 |
|---|---|
| 双端都改内容（local dirty ∧ remoteRev > baseRev） | 保留一方为原 path；另一方写成冲突副本；两边内容都不丢 |
| 一端删、一端改 | **改胜于未同步的删意图**：保留有内容的一侧为原 path；删除侧若已推 tombstone 而另一端随后 push 内容 → 409/冲突流程，生成副本或按「复活为新 fileId」策略显式提示，**禁止静默丢掉有内容一侧** |
| 一端 rename、一端改内容 | 应用 rename 到权威 path；内容以冲突副本规则合并（改后的正文落到新 path 或冲突副本，不丢） |
| 双端不同 rename（同 fileId / 同身份键） | 一方赢得目标 path（见下「命名」）；另一方的目标写成冲突副本文件名；两端 rename 意图都可见 |
| 一端 rename、一端 delete | 同「删+改」：有内容/有 rename 目标的一侧优先保留；tombstone 与 rename 冲突走显式冲突副本，禁止静默丢 |

##### 冲突副本命名

- 模板：`{stem} (冲突 {yyyy-mm-dd} {HHmm} {deviceShort}).{ext}`
  例：`周报 (冲突 2026-11-14 1642 mac).md`
- `{deviceShort}` = 本地 deviceId 短码（或主机名截断），避免多设备同日撞名。
- 若目标名已存在：追加 `-2`、`-3`… 直至身份键唯一。
- 冲突副本本身是普通本地文件：标记 dirty，随后按增量上传（新 `fileId`）。

##### 冲突后 cursor / baseRev / dirty

1. 拉取并落地远端权威版本（或本地保留版）到原 path 后：该 path 的 `baseRev = remoteRev`，`dirty = false`（若本地无未合并编辑）。
2. 冲突副本：`baseRev` 空（新文件），`dirty = true`，待 push。
3. 推进全局 `cursor` 至本次 manifest **最后一页**返回值（§8.2 分页协议），**避免**因未 ack 远端 rev 而反复 409。
4. 用户删除冲突副本或手动合并后，按普通编辑/删除进入下一轮 sync。

##### 首次绑定 bootstrap 权威（扫描上传 ≠ 静默整库覆盖）

| 情况 | 规则 |
|---|---|
| 云端库为空，本机首次 bind | 本机扫盘 → **逐文件增量 PUT/batch** 上传；创建云端权威 |
| 云端已有内容，本机空库/新开库后 bind | **云端为准**：pull 全量到本地；**禁止**空本地扫盘把云端抹成空 |
| 云端已有内容，本机也有文件（二次绑定/换机拷贝） | **禁止静默双向覆盖**。默认：**云端为权威基线** pull；本地仅存在于本机、云端无对应身份键的文件再增量上传；两边同身份键且内容 hash 不同 → 走 §9.3 冲突副本（本机副本改名保留），不得 zip 整库替换。**【协议修订 2026-11】细化：** pull 落地时若本地存在**无 sync-state 条目**的同身份键文件：先比较其磁盘内容 hash 与远端 `contentHash`——**相同** → 直接采纳云端基线（不产生副本，本地文件被云端内容覆盖属无损，因为内容一致）；**不同** → 本地内容先写成冲突副本（dirty，等待 push 成新 fileId），云端基线再落原 path。旧实现只要本地有未跟踪文件就无条件覆盖，换机/二次绑定场景会丢本机独有内容——已修复（`applyRemoteUpsert`，回归测试 engine.test.ts「bootstrap merge conflict copies (§9.3)」） |
| 「扫描上传」文案 | 仅指 bootstrap 阶段的增量写入；**不是**整库替换 API（见 §5.3） |

#### 9.4 删除与回收

- 本地删除 → tombstone 同步；他端拉到后删文件（本地可进 `.v5notes/trash`，**该目录永不同步**，见 §6.4）。
- 可选：本地 `.v5notes/trash` 保留 30 天（与云端 trash / tombstone GC 分开配置）。

#### 9.5 附件

- Markdown 内相对链接优先：`附件/xxx.png`。
- 单文件上限（示意 25–100MB，套餐可抬）；超限不同步并角标提示（`413 vault.file.too.large`）。
- Phase 4 可先走同 PUT；Phase 5 改为 OSS 直传。

#### 9.6 加密（分期）

- **一期：** HTTPS + 服务端可读（便于搜索、合规简单）。
- **二期（对标 Obsidian E2E）：** 客户端加密 blob，服务器只存密文；云端全文搜索不可用或仅限本地。

### 10. 搜索

| 客户端 | 策略 |
|---|---|
| Cloud | 现有 `/client/notes/search`（SQL/后续 ES） |
| Vault | **本地 FTS**（sqlite FTS5 / tantivy），对标 Obsidian「秒级」；**不**依赖同步 API 做日常搜索 |

同步与搜索解耦：搜本地盘，不搜云。

### 11. 仓库与工程结构建议

```
v5notes/
  v5notes-clients/
    v5notes-client2/          # Cloud Client（现有）
    v5notes-vault-client/     # 新建 Vault Client（Tauri + Vue）+ PluginHost
    packages/                 # 可选 monorepo
      editor/                 # 共享编辑器
      account-sdk/
      ui-tokens/
      vault-plugin-api/       # @v5notes/vault-plugin-api
      create-vault-plugin/    # 插件脚手架
  v5notes2/
    note-modules/note-notes/          # Cloud API
    note-modules/note-vault-sync/     # 新建 Sync API
```

若暂不 monorepo：Vault 客户端独立仓库，用 npm/git submodule 引用 editor。

**应用标识：** 不同 `productName`、bundle id、deep link（`v5notes://` vs `v5notes-vault://`），避免 OAuth 回调与协议冲突。

### 12. 安全与权限

- Vault Client：目录 ACL、路径穿越禁止（`..`）、符号链接策略（默认不跟随出库，见 §6.2）。
- Sync：所有 path 按 §6.2 规范化后校验；单文件大小上限；速率限制；路径过滤服从 §6.4。
- 套餐超额：**push** 返回 `402/403` + 可读错误码；**pull 默认仍允许**（只读拉取，见 §8.3）；本地编辑不因超额阻断。
- Secret：仅 Account/Sync token；Vault 本地无长期密码存储（与现网一致）。**插件 API / bridge 永不暴露这些 token**（见第三部分 §16.2）。

---

## 第二部分 · 可执行开发计划

**原则：** 先本地可用 → 可选账号/同步 → 插件/主题 → 官方增值；**不**把 Cloud Client 改成 Vault；**不**开放第三方发布。
**约束（全程可见）：** 双产品 / 双 API / 本地文件夹权威 / 文件级增量同步 / 冲突副本 / 第三方无发布 / Catalog ≠ 文件 sync 协议。

### 13. 现状锚点（脚手架必须贴合现实）

| 现状 | 对 Phase 0 的含义 |
|---|---|
| 仓库已有 `v5notes-clients/v5notes-client2/`（Tauri 2 + Vue 3 + Vite）、`v5notes2/note-modules/{note-basics,note-notes,note-system}` | Vault 客户端与 Sync 模块作为**同仓兄弟目录**落地，不另起仓库 |
| **不存在** 顶层 `v5notes-clients/packages/` npm workspace | Phase 0 **默认不强制**一次切成 monorepo；先建独立 App，共享物按需抽出 |
| 编辑器依赖为 `vendor/v5md/*.tgz`（`@v5md/core|view|vue`） | Vault 壳先 **同方式引用**（复制或 symlink vendor）；后续再抽 `@v5notes/editor` 可选 |
| Cloud deep link：`v5notes://`，bundle `xin.v5ai.v5notes.client2`，`deviceType=client` | Vault 必须独立：`v5notes-vault://`、新 identifier、`deviceType=vault_client` |
| 社交登录落地页：`v5notes-clients/v5notes-oauth-landing/` + `justauth.client-address` | Phase 3 前扩展 `app=vault` → `v5notes-vault://`；后端加 `justauth.vault-client-address` |
| Cloud API 在 `note-notes`（`/client/notes*`） | Sync **禁止**并入 note-notes；新建 `note-vault-sync`，前缀 `/vault/v1` |

**工程形态默认（开放题 → 拍板建议）：**

1. 在仓库根创建 `v5notes-clients/v5notes-vault-client/`（镜像 `v5notes-client2` 的 Tauri+Vue 骨架）。
2. **暂不**引入根级 npm/pnpm workspace；共享包到真正有第二消费者时再抽到 `v5notes-clients/packages/`。
3. 后端在 `v5notes2/note-modules/note-vault-sync/` 新建 Maven 模块并挂入 `note-api`/`note-admin` 启动装配。

### 14. 总览：Phase ↔ 里程碑 ↔ 工作流

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

### 15. Phase 0 冻结清单：已有默认 vs 仍需产品拍板

#### 15.1 文档已写死（开发按此执行，勿再议）

| 项 | 默认 |
|---|---|
| 双客户端 / 双 API | Cloud=`v5notes-client2`+`note-notes`；Vault=`v5notes-vault-client`+`note-vault-sync` |
| 本地权威 | 桌面用户自选文件夹；`.md` 真相；`.v5notes/` 可重建 |
| 同步身份 §6.2 | 相对 path + `/` + NFC + **case-fold 身份键** + 展示 path；保留名拒绝；symlink 不跟随出库；rename 保 `fileId`；push 端 rename/tombstone 传播为必做项【协议修订 2026-11】 |
| Sync 硬表 §6.4 | `sync-state` / `index.sqlite` / 设备字段 / 本地 trash **永不同步**；意图配置默认同步；代码二进制默认同步关 |
| 冲突 §9.3 | 冲突副本；禁止静默覆盖；删改/rename 矩阵；副本命名模板；bootstrap 未跟踪文件按 hash 比对决定是否出副本【协议修订 2026-11】 |
| manifest §8.2 | 分页协议：`hasMore` + cursor 续拉至最后一页才推进持久化游标【协议修订 2026-11】 |
| Bootstrap 权威 | 云端空→本机增量上传；云端有内容→云端为基线；禁止静默整库覆盖 |
| 超额 | push 拒；**pull 仍允许只读**；设备超限拒新 bind |
| 插件 P1 承诺 | 权限代理 + Safe Mode + 审核；**不**承诺进程级沙箱；token 对插件不可达 |
| 第三方 | 无 `publish:*` / 无限制 network / `fs:arbitrary` / `sync:control` / `shell` |
| Deep link | Vault = `v5notes-vault://app/social-callback` |

#### 15.2 仍需产品拍板（短清单；未拍板前脚手架可用括号内建议开工）

| # | 开放题 | 建议默认（可改） | 挡住谁 |
|---|---|---|---|
| 1 | 套餐售卖 **A 双 SKU** vs **B 一账号双配额字段** | **B**（实现简单、账号统一；商店文案分桶展示） | Phase 3 套餐 UI / 计费表 |
| 2 | Catalog 前缀 **A** `/vault/v1/catalog/...`（标明非文件 sync）vs **B** 旁路+独立版本头 | **A** | Phase 7；Phase 0 只记入 ADR 即可 |
| 3 | 双产品一句话定稿 | 「同一账号可登录两个客户端；Cloud 笔记与 Vault 库默认不是同一份数据。Cloud 在服务端目录树；Vault 在本机文件夹，可选同步。」 | Phase 3 登录/设置文案 |
| 4 | 商店/安装包显示名与 bundle id 字符串 | `productName=V5Notes Vault`；`identifier=xin.v5ai.v5notes.vault` | Phase 0 脚手架 |
| 5 | tombstone GC 天数 | **≥ 90 天**（文档建议） | Phase 4/5 后端 |
| 6 | 工程：何时抽 `v5notes-clients/packages/` | M1 完成后再抽 `account-sdk` / `vault-plugin-api`；Phase 0 不建 workspace | 仅节奏，不挡开工 |

**Phase 0 Done when：** 上表 15.1 全部写入团队 checklist；15.2 至少勾选 1–4（或书面接受建议默认）；空壳 App 可 `npm run tauri dev` 启动并注册 scheme。

### 16. 分 Phase 工作包（目标 / 交付 / 验收 / 依赖 / 风险 / Done when）

#### Phase 0 — 冻结与工程脚手架

| | |
|---|---|
| **目标** | 命名、协议默认、空壳可跑；团队对强约束无歧义 |
| **交付** | `v5notes-vault-client` 空壳；`note-vault-sync` 空模块；schema/错误码草稿；Phase 0 checklist 勾选记录 |
| **验收** | 两 App 可并存安装（至少不同 identifier/scheme）；§15.1 默认被引用；§15.2 有决策或书面采纳建议 |
| **依赖** | 设计文档补洞（完成） |
| **风险** | 过早上 monorepo 拖慢空壳；OAuth scheme 与 Cloud 撞车 |
| **Done when** | `tauri dev` 空壳绿；后端模块编译绿；冻结纪要入库 |

**建议 PR：** `PR-0a` 客户端空壳；`PR-0b` 后端空模块（可同周并行）；`PR-0c` docs/ADR（可选）。

#### Phase 1 — 本地 Vault MVP（免登录）→ 进 M1

| | |
|---|---|
| **目标** | 打开 App 即可建库写笔记，零网络 |
| **交付** | 欢迎三路径；`.v5notes` 骨架；树 CRUD；V5Editor 读写；路径身份键拦截；本地搜索 MVP |
| **验收** | 创建/打开/默认库均可；重启恢复最近库；非法名/仅大小写冲突被拒；预览↔编辑不丢 undo |
| **依赖** | Phase 0 |
| **风险** | macOS 目录权限续期；Windows 保留名；把业务写进 Vue 组件导致难测 |
| **Done when** | 无账号完整本地闭环；自动化单测覆盖 path 规范化 |

**建议 PR：** `PR-1a` VaultFs+路径；`PR-1b` 欢迎/开库；`PR-1c` 树+编辑器；`PR-1d` 搜索 MVP。

#### Phase 2 — 本地体验打磨 → 完成 M1

| | |
|---|---|
| **目标** | 日常本地不脆；预埋 Theme CSS 变量 |
| **交付** | watcher；原子写/崩溃安全；移盘提示；最近库；本地 trash；设计 token 初版；脏保存守卫；基础快捷键 |
| **验收** | 外部改文件树能刷新；强制杀进程不丢已写入内容；trash 可还原或明确不可；内置外观可切 |
| **依赖** | Phase 1 |
| **风险** | watcher 在大库性能；token 契约事后大改影响 Phase 6 |
| **Done when** | M1 验收表全绿；「外观」设置入口存在（可仅内置） |

**建议 PR：** `PR-2a` 稳健性；`PR-2b` UX（最近库/trash/快捷键）；`PR-2c` design tokens。

#### Phase 3 — Account 接入（可选登录）→ 开 M2

| | |
|---|---|
| **目标** | 能登录看套餐；未登录仍纯本地 |
| **交付** | Account 客户端（可先从 client2 抽薄 SDK 或复制再抽）；设置页账号区；`deviceType=vault_client`；社交回调 `v5notes-vault://`；双产品一句话；同步入口引导但不阻断编辑 |
| **验收** | 登录/登出/401 清 token；不存密码；无套餐仍可编辑；文案含「不是同一份数据」 |
| **依赖** | Phase 2；后端已有账号体系；落地页支持 `app=vault` |
| **风险** | Gitee 等单回调限制 → 需独立 OAuth 应用或中转；与 Cloud token 串用 |
| **Done when** | 可选登录闭环；同步按钮在未登录时只引导 |

**建议 PR：** `PR-3a` account 客户端 + sys_client；`PR-3b` OAuth landing/scheme；`PR-3c` 设置与文案。

#### Phase 4 — `note-vault-sync` + SyncEngine（首版同步）→ M2 核心

| | |
|---|---|
| **目标** | 登录后文件级增量同步；冲突可见 |
| **交付（后端）** | 表 `vault_space/device/file/change`（+ blob 元数据）；vault CRUD；bind；manifest；PUT/batch；DELETE tombstone；rename 保 fileId；409 `vault.conflict.rev`；配额错误码；超额只读 pull |
| **交付（客户端）** | SyncEngine；§6.4+syncignore 过滤；bootstrap 权威；冲突副本；同步状态 UI；意图配置可进 sync（**不**依赖 PluginHost） |
| **验收** | 两设备同库增量一致；冲突出副本不丢内容；空本地绑非空云端 = pull 基线；禁止 zip 整库替换 API |
| **依赖** | Phase 3；对象存储或过渡方案（小 md 可先 DB） |
| **风险** | 身份键跨平台；误同步 sync-state；rename 拆成 delete+create |
| **Done when** | §20 同步用例主路径通过；错误码分支有 UI |

**建议 PR：** `PR-4a` DB+API 读路径；`PR-4b` 写路径+冲突；`PR-4c` SyncEngine；`PR-4d` bootstrap+冲突 UI；`PR-4e` §6.4 过滤单测。

#### Phase 5 — 同步硬化与附件 → 完成 M2

| | |
|---|---|
| **目标** | 多设备可日常用 |
| **交付** | 空闲/后台同步；重试队列；断网恢复；设备列表/踢设备；附件上限；配额文案与 Cloud 区分；（可选）版本历史；（后置）E2E |
| **交付（协议修订实现，2026-11 已完成）** | ① manifest 分页：后端 `MANIFEST_PAGE_LIMIT=500` + `hasMore` 探测（`VaultSyncManifestPaginationTest`），客户端游标循环（engine.test.ts）；② push 端 rename/tombstone 传播（engine.ts，含 409 冲突标记与配额中断）；③ bootstrap 未跟踪文件 hash 比对 + 冲突副本（applyRemoteUpsert）；④ 活跃身份唯一性经 vault_space 行锁 `FOR UPDATE` 强制（findLiveByIdentityForUpdate）；⑤ getContent rev 不符 → 409 |
| **验收** | 弱网可恢复；超容量 push 拒、pull 通；超设备拒 bind；附件超限角标；分页大库不丢变更；换机绑定不丢本机独有内容 |
| **依赖** | Phase 4；OSS 直传可本 Phase 引入 |
| **风险** | 大附件与配额；设备踢出与 cursor |
| **Done when** | M2 验收全绿；无 E2E 也可宣布 M2 |

**建议 PR：** `PR-5a` 队列/重试；`PR-5b` 设备管理；`PR-5c` 附件+OSS；`PR-5d` 配额文案。

#### Phase 6 — PluginHost + Theme API → 开 M3

| | |
|---|---|
| **目标** | 可加载官方/本地功能插件；主题可切换 |
| **交付** | `@v5notes/vault-plugin-api`（可此时建 `v5notes-clients/packages/vault-plugin-api`）；PluginHost；权限代理；Safe Mode；ThemeHost + CSS 校验；`appearance.json`；核心插件：日记、模板；**无**第三方发布；**无** `network:safe` |
| **验收** | 启用/禁用热加载；无权限写入抛错；非法主题回退；Safe Mode 仅核心+内置主题；token 不可被插件枚举 |
| **依赖** | Phase 2 tokens；可与 Phase 5 **部分并行**，但以主设计依赖图为准（建议 Phase 4 完成后再大面积开宿主） |
| **风险** | API 面一次铺太大；同页隔离被误解为沙箱 |
| **Done when** | 官方日记/模板可用；外观可切社区主题包（本地装） |

**建议 PR：** `PR-6a` api 包；`PR-6b` PluginHost P1；`PR-6c` Theme P1b；`PR-6d` 日记/模板。

#### Phase 7 — 插件扩展、安全网络与目录 → 完成 M3

| | |
|---|---|
| **目标** | 社区可装插件/主题；联网仅白名单；catalog 与 sync 版本解耦 |
| **交付** | SettingTab/Ribbon/View/postProcessor/editorExtension；MetadataCache 基础；`network:safe`；本地文件夹安装；Catalog（kind=plugin\|theme，前缀按 Phase 0 决策）；签名校验；拒绝 publishing 标签；反向链接等核心插件 |
| **验收** | 非白名单 host 失败；声称 publish 的包拒载；catalog 变更不逼 sync 客户端升级 |
| **依赖** | Phase 6 |
| **风险** | 网络策略被绕过；市场审核流程未建 |
| **Done when** | M3 验收全绿；文档写明「无第三方发布」 |

**建议 PR：** `PR-7a` API 扩展面；`PR-7b` network:safe；`PR-7c` catalog；`PR-7d` 更多核心插件。

#### Phase 8 — 官方增值与产品收尾 → M4

| | |
|---|---|
| **目标** | 官方能力与双产品叙事完整；第三方仍无发布权 |
| **交付** | 官方 Publish/分享（若做，仅产品通道）；整库 zip **仅备份**；Cloud↔Vault 显式迁移（若需要）；帮助与套餐页全文案 |
| **验收** | 用户能理解两 App 数据关系；备份不作 Sync；社区包仍无发布 API |
| **依赖** | M2 至少稳定；M3 视产品是否强依赖插件 |
| **风险** | 迁移工具被当成「自动合并」 |
| **Done when** | M4 验收；对外帮助页上线 |

**建议 PR：** 按功能拆 `PR-8*`；Cloud 并行轨单独 PR 改文案。

#### 并行轨 — Cloud Client（`v5notes-client2`）

| | |
|---|---|
| **目标** | 不阻塞 Vault Phase 1–2；套餐与叙事区分 |
| **交付** | 继续 `/client/notes*`；套餐展示避开 Vault 同步额度混淆；文档两产品关系；**不**引入 Vault 插件宿主 |
| **Done when** | Cloud 发版说明含双产品一句；无 Vault 插件代码混入 |

### 17. 建议工作流与 PR 边界（汇总）

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

### 18. 前 2–4 周（Phase 0 → Phase 1 启动）极具体清单

#### Week 1 — Phase 0 脚手架（WS-A0）

**目录与仓库动作：**

```
v5notes/
  v5notes-clients/
    v5notes-vault-client/          # NEW：从 create-tauri-app 或复制 client2 骨架后删业务
      package.json                 # name: v5notes-vault-client
      src/                         # Vue 空壳：欢迎占位 + 设置空页
      src-tauri/
        tauri.conf.json            # productName / identifier / deep-link schemes
        capabilities/              # fs/dialog 预留，先最小
      vendor/v5md/                 # 复用 client2 的 tgz
  v5notes2/note-modules/
    note-vault-sync/             # NEW：空 Maven 模块 + 占位 Controller 健康检查
  docs/
    adr/vault-phase0-freeze.md   # 可选：固化 §15 勾选结果
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
- [ ] scheme `v5notes-vault://` 在 macOS/Windows 开发构建上可注册
- [ ] `vault.json` / `sync-state.json` TypeScript 类型 + JSON Schema 草稿（§6.5）
- [ ] 错误码枚举表 TS/Java 各一份草稿（§8.2）
- [ ] 后端空模块 `note-vault-sync` 能被父 POM 编译；`GET /vault/v1/health` 或等价占位
- [ ] README：双产品边界一句 + 「勿把库放进网盘再开官方 Sync」

#### Week 2 — Phase 0 收尾 + Phase 1 骨架

- [ ] 路径工具库：`normalizeDisplayPath` / `toIdentityKey`（NFC + case-fold）+ 非法名单测
- [ ] `VaultWorkspace` 接口桩：open/create/switch
- [ ] 欢迎页 UI 三选一布局
- [ ] 产品拍板纪要：套餐 A/B、Catalog A/B、bundle 字符串、双产品文案

#### Week 3–4 — Phase 1 核心路径（冲 M1 前半）

- [ ] Tauri `dialog` 选目录 + 动态 fs scope / 书签持久化
- [ ] 创建库：写 `.v5notes/vault.json` + 默认 `syncignore` + 可选示例笔记
- [ ] `VaultFs`：listTree / read / write / mkdir / rename / delete（原子写）
- [ ] 侧栏树 + 打开 `.md` → `VaultEditorBridge` + V5Editor（预览/编辑同实例策略对齐 AGENTS）
- [ ] 本地搜索 MVP（先全文扫描可接受）
- [ ] **零网络、零账号、零插件市场**

**四周末目标（软门禁）：** 开发者本机可「创建库 → 写笔记 → 重启再打开 → 搜索命中」；无 Sync。

---

## 第三部分 · 插件系统（仅 `v5notes-vault-client`）

**范围：** 仅 `v5notes-vault-client`（本地 Vault 优先）。`v5notes-client2` 首期不做第三方插件。

**参考：** Obsidian Plugin（`manifest.json` + `main.js`、`Plugin` 生命周期、`App` / `Vault` / `Workspace` / 命令与设置页）。

**命名：**

| 组件 | 名称 |
|---|---|
| 宿主应用 | `v5notes-vault-client` |
| 插件 API 包 | `@v5notes/vault-plugin-api`（含 `ThemeApi`） |
| 宿主运行时 | `PluginHost` + `ThemeHost` |
| 库内功能插件目录 | `.v5notes/plugins/<plugin-id>/` |
| 库内主题目录 | `.v5notes/themes/<theme-id>/` |
| 社区缓存（可选） | 应用数据下 `installed-plugins/`、`installed-themes/` |

### 19. 目标与非目标

#### 19.1 目标

- 用户可在 Vault 内启用/禁用第三方（及官方）插件，扩展命令、侧栏、视图、编辑器能力、文件处理。
- **主题为一等品类**：经稳定 **Theme API** 安装/切换外观（不仅是「随便塞一段 CSS」）。
- 开发者体验贴近 Obsidian：清单 + 打包入口 + `onload` / `onunload`，降低迁移与学习成本。
- **能力分级**：插件默认只能碰公开 API；网络仅开放**安全只读/白名单**类能力；危险能力（任意路径、Shell）默认不开放。
- 插件配置随库走（可同步），与「本机安装的社区包」可分离。

#### 19.2 非目标（首期）

- 不兼容直接加载未改写的 Obsidian 插件（API 同构但非二进制兼容）。
- 不做任意 Node/Electron 原生模块加载。
- 不做云端远程执行插件代码；插件始终在本机宿主内加载。
- **不对第三方开放「发布」类能力**（站点托管、一键发博客/文档站、官方 Publish 等价物）；发布若需要，仅官方产品功能。
- 第三方**不得**实现整库 Sync / 替代 `SyncEngine`。
- 首期不做付费插件商店结算（可后置）；目录与签名可先做只读清单。

### 20. 与 Obsidian 对齐 / 刻意差异

| 维度 | Obsidian | v5notes-vault-client（采用） |
|---|---|---|
| 包结构 | `manifest.json` + `main.js`；主题多为 CSS | 功能插件同左；**主题**另有一等包格式 + Theme API |
| 生命周期 | `onload` / `onunload` | 同左；另加 `onUserEnable`（语义见 §21.2）；主题可无 JS 或仅设置控件 |
| 全局入口 | `this.app` | `this.app`（类型来自 `@v5notes/vault-plugin-api`） |
| 文件系统 | 近乎完整 Node `fs` | **禁止**默认暴露任意 `fs`；经 `app.vault` / 声明的 `permissions` |
| 网络 / 发布 | 社区插件可较自由联网与自建发布流 | **安全网络白名单**；**发布不对第三方开放** |
| 编辑器 | CodeMirror 6 | V5Editor（`@v5md`）抽象扩展点，不直接暴露底层实现细节过多 |
| 运行环境 | Electron 主/渲染混用历史包袱 | **仅渲染进程沙箱脚本** + Tauri 能力命令白名单 |
| 社区源 | Obsidian 官方库 | 自建清单 API 或静态 JSON（可挂 `note-vault-sync` 旁路） |

原则：**心智对齐 Obsidian，安全模型严于 Obsidian；主题一等公民；发布与官方 Sync 留在产品侧。**

### 21. 目录与启用模型

#### 21.1 布局

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

#### 21.2 启用语义

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
- **主题**与功能插件分目录、分清单；同一时间仅 **一个** 社区/自选主题生效（可叠加官方「基础壳」变量）；切换走 `app.theme`（§23.6）。

#### 21.3 同步

**权威总表：** 第一部分的 §6.4 Sync 路径分类（含 `sync-state.json` / `index.sqlite` / 设备私有字段 / 本地 trash **永不同步**）。用户可追加 §6.6 `syncignore` 忽略更多用户内容，但**不能**用它打开硬表中的「永不同步」项。下表仅为插件相关切片；与主表冲突时以 §6.4 为准。本规则在 **Phase 4 SyncEngine** 即生效，**不依赖** Phase 6 `PluginHost`。

| 路径 | 是否进 Vault Sync |
|---|---|
| `plugins/*/data.json`、`community-plugins.json` | **默认同步开**（设置跟库） |
| `appearance.json`、`themes/community-themes.json`、`themes/*/data.json` | **默认同步开**（当前主题意图） |
| `plugins/*/main.js`、`themes/*/theme.css` 等代码 | **默认同步关闭**（各端自装）；仅同步「启用/选中意图」 |
| `sync-state.json`、`index.sqlite`、`vault.json` 设备字段、`.v5notes/trash/**` | **永不同步**（§6.4） |
| 官方核心插件与内置主题 | 随 App 发版，不放库内 |

文档需提示：多设备启用同一社区插件/主题时，各端需自行安装对应版本；仅同步「启用意图」。

### 22. 插件包契约

#### 22.1 `manifest.json`

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
| `permissions` | 能力白名单（见 §24）；主题默认仅 `ui:theme` |
| `main` | 功能插件入口，默认 `main.js`；纯 CSS 主题可省略 |
| `theme` / `themeMeta` | `kind=theme` 时样式与元数据入口 |
| `isDesktopOnly` | 真则移动端跳过 |
| `networkAllowlist` | 仅当申请 `network:safe` 时填写允许的 host 列表（见 §24.4） |

#### 22.2 入口与生命周期

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

#### 22.3 构建

- 官方脚手架：`@v5notes/create-vault-plugin`（esbuild/rollup 打成 IIFE 或 ESM）。
- 依赖：仅允许 `import` `@v5notes/vault-plugin-api`（宿主注入，**不打包进 main.js**）；其它第三方必须打进 bundle。
- 宿主用动态 `import()` / `new Function` 沙箱加载（见 §23 前的 §「加载与隔离」小节），不跑未打包的多文件裸源码。

### 23. 宿主 API 面（深模块）

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

#### 23.1 `VaultAdapter`（对标 Obsidian `Vault`）

| 方法（示意） | 权限 | 说明 |
|---|---|---|
| `adapter.list(path)` | `vault:read` | 相对库根；禁 `..` |
| `adapter.read(path)` | `vault:read` | 文本 |
| `adapter.readBinary(path)` | `vault:read` | 附件 |
| `adapter.write(path, data)` | `vault:write` | 原子写 |
| `adapter.delete(path)` | `vault:write` | 进本地 trash 策略 |
| `adapter.rename(from, to)` | `vault:write` | |
| `on('create'|'modify'|'delete'|'rename')` | `vault:read` | 事件 |

**不提供** 库根之外的绝对路径 API。`fs:arbitrary` **第三方永不可申请、宿主永不发放**；官方核心模块若需库外路径，走产品通道而非插件权限。

#### 23.2 `Workspace`

- 打开/关闭笔记路径、分屏（后期）、Toast/Notice、模态框、侧栏叶子（`registerView`）。
- 获取当前活动文件：`getActiveFile(): TFile | null`。

#### 23.3 `MetadataCache`

- 解析 frontmatter、wikilink/反向链接（若产品支持）、标题大纲。
- 插件可读缓存；写正文仍走 `vault.write`，由宿主重解析。

#### 23.4 编辑器扩展

- `registerEditorExtension(spec)`：对接 V5Editor 公开扩展点（命令、装饰、块菜单、输入规则），**不**保证暴露完整 ProseMirror/TipTap 内部。
- Markdown 渲染后处理：`registerMarkdownPostProcessor`（预览模式 HTML 节点）。

#### 23.5 设置

- `loadData()` / `saveData()` → `.v5notes/plugins/<id>/data.json`（主题可选 `.v5notes/themes/<id>/data.json`）。
- `addSettingTab`：在设置「插件」分区挂 Vue/自定义 DOM 容器（宿主提供 `SettingTab` 挂载点）。

#### 23.6 Theme API（一等品类）

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

#### 23.7 明确不提供给第三方的 API

| 能力 | 政策 |
|---|---|
| 发布到 Web / 静态站 / 文档站托管 | **不开放**；无 `publish:*` 权限，API 面不暴露 |
| 官方 Vault Sync 协议控制面 | **不开放**；同步仅 `SyncEngine` |
| 任意 URL 上传笔记正文批量外发 | **不开放**（即便有网络，也禁止「导出整库到外部发布端点」类桥接） |

官方若做 Publish / 分享，走产品功能或**官方签名核心模块**，不进社区第三方权限模型。

### 24. 加载与隔离

#### 24.1 加载顺序

1. 应用内置主题（fallback）→ 再应用用户选中主题（`appearance.json`）。
2. 内置核心插件（官方，随 App）。
3. 库内已启用社区/本地**功能插件**（按 `id` 字典序；显式 `dependencies` 字段后期再加）。
4. 单个失败：捕获、标记 `failed`、其余继续；主题 CSS 校验失败则回退内置主题并提示。

#### 24.2 隔离策略与威胁模型（诚实边界）

| 阶段 | 策略 | 实际保证 |
|---|---|---|
| **P1** | 同页 JS 模块加载 + **API 代理**按 `permissions` 裁剪；CSS 尽量加前缀作用域 | **不是进程隔离**。恶意/被攻破插件与宿主同渲染页，技术上可尝试原型污染、读同页可达对象。硬门槛是：能力只经代理、最小权限、Safe Mode、审核；「禁止静默全库外传」在 P1 = **政策 + 权限最小化 +（Phase 7）`network:safe`**，**不是**可执行沙箱保证 |
| **P2** | iframe / Worker 跑无 UI 逻辑；UI 仍主文档（复杂度高，按需） | 较强隔离边界另议；未落地前对外不得宣称 |
| **不做** | 任意 native `.node` / 未声明 Shell / 无限制 `network` | — |

**对外/对内文案（Phase 0 冻结）：** 只承诺「权限代理 + Safe Mode + 审核」；**不**承诺进程级沙箱或「插件无法读到同页其它状态」。有 `vault:read` 的插件在获得网络能力后，仍可能分段读库外传——靠 allowlist、payload 策略与审核收敛，而非 P1 隔离神话。

**Account / Sync token：** 插件 API、`createPluginApi` 返回对象、以及可被插件触及的全局/原型上，**不得**挂载或可枚举到 Account/Sync access token。Token 仅存宿主私有闭包 / 安全存储；bridge `invoke` 由宿主代持凭证，插件侧只见业务结果或权限错误。

#### 24.3 API 注入

```ts
// 伪代码
const api = createPluginApi(app, manifest) // 按 permissions 裁剪方法；永不注入 token
const mod = await import(pluginUrl)       // asset 或 blob URL
const PluginClass = mod.default
const instance = new PluginClass(api, manifest)
await instance.onload()
```

`createPluginApi`：未授予的方法直接 `throw` 或返回 `undefined` 并打日志，避免插件探测后提权。注入对象与 `Object.prototype` 污染面需审查：敏感字段不可枚举、不可写到插件可见全局。

### 25. 权限模型

#### 25.1 权限枚举（首期）

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
| `network:safe` | **安全网络**：仅白名单 host + 方法限制（见 §25.4） |
| `clipboard` | 读写剪贴板 |

**不发放（第三方永不可申请）：** `network`（无限制）、`publish:*`、`sync:control`、`fs:arbitrary`、`shell`。

#### 25.2 UX

- 启用插件/主题前展示权限列表；变更 `manifest.permissions` 升级后需重新确认。
- `network:safe`：展示将访问的 host 列表；用户确认后写入信任表。
- 申请了未开放权限（如发布）的包：**拒绝安装/启用**，并提示「发布仅为官方功能」。

#### 25.3 与 Tauri

- 插件 **不** 直接 `invoke` 任意命令。
- 宿主维护 `plugin-bridge` 命令集；仅当权限满足时转发。

#### 25.4 安全网络（`network:safe`）策略

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

### 26. 品类：核心 / 社区功能插件 / 主题

| 类型 | 存放 | 更新 | 示例 |
|---|---|---|---|
| 核心功能插件 | App 内置 | 随客户端发版 | 反向链接、日记、模板、大纲增强 |
| 社区功能插件 | `.v5notes/plugins` | 市场 / 手动安装 | 日历、看板、安全联网工具、编辑增强 |
| **主题（一等）** | `.v5notes/themes` | 市场「主题」分区 / 手动安装 | 色板与排版主题；经 Theme API 切换 |
| 官方发布 / Sync | 产品功能，非社区插件 | 随客户端 / 套餐 | Publish、Vault Sync |

核心功能插件同样走 `Plugin` 基类。主题走 `kind: "theme"` + Theme API。

#### 26.1 社区可做 / 不可做（摘要）

| 可做 | 不可做（第三方） |
|---|---|
| 命令、文件自动化、面板、编辑器/预览增强 | 一键发布站点 / 对外 CMS 发布管线 |
| **主题包**（Theme API） | 无限制任意联网、静默全库外传 |
| `network:safe` 白名单查询类、用户触发的单次辅助 | 接管或旁路官方 Sync |

### 27. 插件 / 主题市场（后期，可挂后端）

**与文件 sync 协议解耦（Phase 0 与 §8.2 对齐）：** Catalog **版本与破坏性变更独立于** `note-vault-sync` 的文件 manifest/rev 协议。可选：（A）独立路由前缀（推荐文档示例仍可用 `/vault/v1/catalog/...`，但标明非文件 sync 资源）；或（B）同进程旁路 + 独立版本协商。**禁止**把 catalog 条目塞进文件 `manifest`；sync 协议 bump 不得强制市场客户端升级。

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

### 28. 工程结构

```
v5notes-clients/v5notes-vault-client/
  src/
    plugin-host/           # PluginHost、加载器、权限代理
    theme-host/            # ThemeApi、CSS 校验、appearance
    ...
v5notes-clients/packages/
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

### 29. 安全与滥用面

- Path：一律相对库根规范化；拒绝 symlink 逃逸（与 §6.2 一致）。
- 资源：限制单插件 CSS/内存；命令注册名强制 `pluginId:` 前缀防撞。
- 主题：CSS 变量契约 + 选择器白名单；校验失败回退内置主题。
- 网络：仅 `network:safe` + allowlist；无发布 API；「禁止静默全库外传」= 政策 + 审核 + 网络策略（P1 非沙箱保证，见 §24.2）。
- Token：Account/Sync 凭证对插件不可达（§24.2）。
- 权限：`fs:arbitrary` / 无限制 `network` / `publish:*` / `sync:control` / `shell` 第三方永不发放。
- 更新：不允许插件自改 `main.js` / `theme.css` 提权绕过（代码目录只读挂载）。
- 审计：设置页一键「安全模式」：仅核心插件 + 内置主题（对标 Obsidian Safe Mode）。

### 30. 插件实施路线（映射到总排期）

**总排期以第二部分 §14/§16 为准**（Phase 6–8 覆盖插件平台）。下表仅映射插件子系统内部切片，避免与总路线重复排期。

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
- **`.v5notes` 意图/配置同步（§6.4）在 Phase 4 生效**，不阻塞、也不等待 PluginHost。
- Catalog 与文件 sync 协议版本解耦（§27）。
- 插件平台不阻塞 Phase 1–2 本地 MVP；可与 Phase 5 同步硬化部分并行，但以总依赖图为准。

---

## 第四部分 · 五项延期能力（优先级决策用）

**用途：** 在 Phase 0–8 垂直切片已落地、M4 产品收尾仍为 stub/局部能力的前提下，分别展开五项延期项，便于拍板「做不做 / 何时做 / 做到哪」。

**全程约束（决策不可突破）：**

| 约束 | 含义 |
|---|---|
| **双产品** | Cloud（`v5notes-client2` + `/client/notes*`）与 Vault（`v5notes-vault-client` + `/vault/v1*`）数据默认**不通**；账号可共用，空间不自动合并 |
| **本地权威** | Vault 真相是本机文件夹里的 `.md`/附件；云端是可选 Sync 镜像，不是第二套笔记 CRUD |
| **增量同步** | 日常 Sync = 文件级 `manifest` + PUT/DELETE/rename；**禁止**把整库 zip 覆盖当 Sync |
| **冲突副本** | 双端冲突默认出冲突副本；禁止静默覆盖 |
| **官方-only 发布** | 站点托管 / Publish 若做，仅**官方产品通道**（`channel=product`） |
| **禁止第三方 `publish:*`** | 社区插件永不获得发布权限；Catalog 拒绝 `publishing`；`network:safe` ≠ 发站管线 |

**工作量刻度：** S ≈ 1 个小垂直切片；M ≈ 1–2 个完整功能 PR 轨；L ≈ 跨客户端+后端+运维/计费的多周产品能力。

**建议对照里程碑：** M1 本地可用 → M2 可同步 → M3 可扩展 → M4 产品完整。下列「建议排期」均假设 **先解除验收阻断**（建库 VN-15、`/vault/v1` 部署）并稳住 M2，再开延期项。

### 31. 完整站点托管（官方 Publish beyond stub）

**是什么：** 用户在 Vault 客户端用**官方「发布 / 分享」**，把选中笔记或整站发布成可公开（或未列出）访问的 Web 站点：有稳定公开 URL、可更新、可下线；外观与权限由官方产品控制，而不是靠社区插件「一键发博客」。

**现状（stub / 缺口）：**

| 已有 | 缺口 |
|---|---|
| 设置页「官方发布 / 分享」；本机 draft（站点标题、可见性 `private|unlisted|public`）写入 `localStorage` | 无公开 URL、无 CDN、无部署流水线 |
| `channel=product`、`status=preview`；文案写明永不对第三方开放 | 无 Publish HTTP API / 无托管后端 |
| 插件宿主 / Catalog **永久拒绝** `publish:*` / `publishing`（正确禁区） | 预览保存 ≠ 上线；验收仅认 stub 文案 PASS |

关键路径：`v5notes-clients/v5notes-vault-client/src/publish/officialPublish.ts`、`SettingsView.vue`；Phase 8 交接明确延期「完整站点托管 / 公开 URL / CDN」。

**目标能力边界 — 做（若立项）：** 官方产品内选笔记/文件夹 → 生成静态站或受控渲染站 → 分配 URL；可见性 private/unlisted/public，可撤销可再发布；与套餐挂钩（站点数、流量、自定义域可选）；全程 `channel=product`，宿主继续拒绝任何第三方 Publish API。

**明确不做：** 第三方插件 `publish:*`、社区「发站/CMS 管线」；用 `network:safe` 绕道批量外传整库当发布；把 Publish 塞进文件 `manifest`；把 Cloud 笔记树静默当 Publish 源。

**关键依赖：** 客户端发布向导（不经 PluginHost）；独立 Publish 服务（勿污染文件 sync 表语义）；新配额字段与 `vault_sync_*` 分列；对象存储 + CDN、证书、垃圾站清理、内容合规。

**风险：** 被误解为「社区也能发站」；发布内容与本地库不一致；公开站泄露未 scrub 的私密路径/附件；运维成本高。

**验收（最小完整）：** ① 官方通道可发布至少一篇笔记得到可访问 HTTPS URL，下线后 404/410；② 社区插件申请 `publish:*` 或 catalog 带 `publishing` 仍拒装/拒载；③ 发布失败不改本地文件；④ 帮助文案区分「官方 Publish」「Vault Sync」「整库 zip 备份」。

**工作量：L。建议排期：M4 增值轨**（M2 稳定且双产品文案落地后）；短期可先做 S/M 的官方单页分享。差异化与变现强，但对核心「本地库 + Sync」非阻塞。

### 32. OSS 直传（附件 / Sync 对象存储）

**是什么：** 大附件同步时客户端**直接上传/下载对象存储**，不再把整文件 base64 塞进 API 与数据库；同步更快更稳，配额按真实对象体积计费。

**现状：**

| 已有 | 缺口 |
|---|---|
| 内容寻址 `vault_file_blob`（`content_hash` + DB `byte[]`） | 无 `uploadToken` / presign / OSS 客户端 |
| `PUT/GET …/files` 支持 `body`（文本）与 `base64Body`（附件） | 大文件经 API 网关，扩展性差 |
| 附件分类、默认 25MB 超限跳过角标；重试队列 | 设计写明「Phase 5 可改 OSS 直传」——**未做** |

关键注释：`src/sync/attachments.ts`（*OSS direct upload remains deferred*）。

**目标能力边界 — 做：** `POST …/upload-token`（校验配额/大小/path → 短时签名 URL）；客户端直传 OSS/S3，完成后用 `contentHash` + 元数据 **commit** 进 `vault_file`/`vault_change`；小 Markdown 可继续走 DB（协议统一用 hash）；下载 presigned GET 或 302，完整性仍 sha256 校验；与增量 Sync、冲突副本、§6.4 过滤兼容。

**明确不做：** 整库 zip 上传当日常 Sync；第三方插件拿裸 OSS 凭证；绕过 `baseRev`/配额的直接覆盖对象。

**关键依赖：** SyncEngine 上传路径改造与 retryQueue 对齐；后端 uploadToken 签发、commit、GC 未引用对象；容量统计改对象存储用量；桶策略、CORS（Tauri 场景）、密钥轮换、生命周期规则。仓库已有 `note-base-file` S3 能力可参考，但 **Vault 语义须独立**。

**风险：** 只传对象未 commit → 幽灵占用；commit 成功对象丢失 → 坏库；CORS/时钟漂移；去重与计费口径；存量 DB blob 迁移窗口。

**验收：** ① ≥ 数 MB 附件直传成功，他端 pull 字节一致且 hash 匹配；② 超额/超单文件 token 拒发或 commit 拒，本地编辑不阻断；③ 断网入重试队列，恢复后可完成 commit；④ 存量小 blob 可读，迁移策略有文档。

**工作量：M。建议排期：M2 硬化后第一优先工程项**（Phase 5 原 `PR-5c` 未完成部分）。同步可扩展性基础设施，建议高于站点托管与迁移向导。

### 33. 完整版本历史（beyond stub）

**是什么：** 对已同步文件可查看**历史版本列表**（时间、设备/大小摘要），预览并**还原**；还原后按增量 Sync 传播。套餐可限制保留天数/版本数。

**现状：**

| 已有 | 缺口 |
|---|---|
| `GET /vault/v1/vaults/{id}/files/versions?path=` | **恒返回 `[]`**（仅 path 校验） |
| `VaultFileVersionVo` 形状；客户端 `listFileVersions`；设置页「接口已预留」文案 | 无版本落库、无按 rev 快照、无还原 UI |
| 同步只保留当前 `contentHash` 去重 blob | `GET …/content?rev=` 未形成产品级历史 |

**目标能力边界 — 做：** 每次成功 PUT（内容变更）归档一版（或按策略采样），绑定 `fileId`+`rev`；rename **保留 fileId** → 历史跟文件走（§8.2）；列表 + 单版下载/预览 + 还原为当前（本地写盘 → dirty → 再 sync，或服务端生成新 rev）；套餐保留窗口（30/90 天）与条数上限，GC 可配。

**明确不做：** 整库 zip 快照冒充按文件版本；delete+create 同 path 自动合并进旧 `fileId` 历史（同身份键重建 = 新 fileId）；首期 OT/CRDT 协同历史；第三方插件读任意用户云端历史 API。

**关键依赖：** 客户端版本面板 + 还原前脏守卫；版本表或对象多版本（与 OSS 直传强相关）；套餐「历史保留」字段执法；存储增长与合规删除。

**风险：** 存储成本陡增；只存 meta 不存 blob → 还原失败；还原与 dirty/冲突副本纠缠；tombstone 后新 fileId 让用户以为历史丢了。

**验收：** ① 同一文件改两次 → versions ≥ 2，可取旧 rev 内容；② rename 后仍按同一 `fileId` 看到改名前内容；③ 还原不静默覆盖未保存本地编辑；④ 超保留窗口 GC 后列表不再出现，配额文案可读。

**工作量：M～L。建议排期：紧接或并行于 OSS 直传。** 可先做「仅 Markdown 文本历史（DB）」的 M 切片，附件历史跟 OSS。

### 34. 加密备份

> **拆开两件不同的事：**（A）**本机备份 zip 加密**；（B）**Sync 端到端加密（E2E）**。决策必须分开勾选。

**是什么：** A：导出整库 zip 时设密码，zip 落盘为密文；仍明确 **备份 ≠ Sync**。B（§9.6 二期）：上传云端的是密文 blob，服务端不可读正文；换设备靠用户密钥/口令恢复；云端全文搜索不可用或仅限本地。

**现状：**

| 已有 | 缺口 |
|---|---|
| 整库 zip（store 格式、无压缩密码）；排除 trash / sync-state / index / tmp | **无 zip 密码/AES**；无增量备份 |
| 文案「备份 ≠ Sync」；设置页导出可用 | Sync E2E：**Phase 4/5 明确不做**；一期仍 HTTPS + 服务端可读 |
| 登录态 `encryptLogin`（传输层） | **与库备份/E2E 无关**，勿当成已交付 |

**目标能力边界 — 做（建议优先 A）：** 导出可选密码（Argon2/PBKDF2 + AES-GCM 或标准加密 zip），密码不落盘、不进 Sync；导入/解压向导校验密码，失败不部分写坏库；可选仅加密「用户笔记+附件」，元数据策略写清。
**做（B，独立立项）：** 客户端加密 blob 后再走 Sync/OSS；密钥由用户口令派生或密钥链保管；服务端只存密文 + 信封元数据；冲突/版本仍按 hash/rev。

**明确不做：** 用加密 zip **替换**日常增量 Sync；把备份密码当账号密码存服务器；未做密钥恢复设计前宣称「E2E 且永不丢数据」；第三方插件接触明文备份口令或 Sync 主密钥。

**风险：** A：密码遗忘无法恢复；假加密实现；大库耗时无进度。B：密钥丢失即云端数据不可用；多设备密钥同步；与合规可读冲突；和版本历史/Publish（需服务端读库）互斥。

**验收：** A：有密码 zip 无法无密码解开；错误密码不破坏源库；帮助写明无法代找回。B：服务端 DB/OSS 抽样不可读明文；两设备同一口令可同步；口令错误 bind 不出明文。

| 子项 | 工作量 | 建议排期 |
|---|---|---|
| A 加密 zip | **S～M** | Phase 8 收尾后随时可插；不挡 M2 |
| B Sync E2E | **L** | **M2 之后很久**；与 OSS、版本历史、官方 Publish 一并做产品取舍 |

### 35. 自动化迁移（Cloud ↔ Vault / 库迁移）

**是什么：** 用户在**明确确认**后运行官方向导：把 Cloud 笔记树导入成本地 Vault 文件夹（或反向），带进度、失败重试与结果报告。默认仍是两套空间；迁移是一次性/可重复的**显式工具**，不是后台静默双向同步。

**现状：**

| 已有 | 缺口 |
|---|---|
| 确认对话框 + 手工步骤文案 | **无**自动读写 `/client/notes*` ↔ 本地 Vault 的导入器 |
| 「不会自动合并两个空间」单测与文案 | 无批量映射、无冲突策略 UI、无迁移报告 |
| `cloudVaultId` = Vault **Sync 绑定**，不是 Cloud 笔记导入 | 无专用迁移 API |

**目标能力边界 — 做（若立项）：** Cloud → Vault：登录后拉 `/client/notes*`（及附件）在本地库生成目录与 `.md`，ID→path 映射可重建或写入报告，完成后**不**自动开启持续双写；Vault → Cloud：扫本地库经 Cloud API 分批创建，失败可续跑；重名/已存在走显式策略（跳过/冲突副本/覆盖——**默认禁止静默覆盖**）；Vault ↔ Vault（换机）仍以「备份 zip / Sync pull」为主，不叫「Cloud 迁移」。

**明确不做：** Cloud 与 Vault 自动持续互通或后台合并；迁移工具当 Sync；把雪花 ID 模型与路径模型合成一套 CRUD；第三方插件触发整库迁出（publish 禁区）。

**关键依赖：** 双端入口与强确认 UI；note-vault-sync 通常不承担 Cloud CRUD；两空间配额分别校验、超额可读失败；大账号限流与审计日志。

**风险：** 用户以为「两个 App 从此是一份笔记」；静默覆盖丢数据；附件/内部链接断裂；雪花 ID 精度（必须字符串）踩坑；中途崩溃留半套树。

**验收：** ① 向导强制确认「不会自动合并 / 不是 Sync」；② 样例账号 Cloud → Vault 后本地可打开且链接/附件可达率达约定阈值；③ 取消或失败不删源数据、目标侧无「半静默成功」；④ 同名冲突走显式策略，默认不覆盖。

**工作量：M（单向）；L（双向+续跑+报告）。建议排期：双产品均有真实用户之后的 M4；** 可先做 Cloud → Vault 单向。**切勿**为赶工做成静默同步。

### 36. 延期项决策一览（供勾选）

| # | 能力 | 现状层级 | 工作量 | 建议相对顺序 | 是否挡核心 Sync |
|---|---|---|---|---|---|
| 32 | OSS 直传 | 工程债（DB blob） | M | **1（M2 后优先）** | 否，但挡规模化 |
| 33 | 完整版本历史 | API 空 stub | M～L | **2（随 OSS/计费）** | 否 |
| 34A | 加密备份 zip | 明文 zip 已可用 | S～M | **可随时插队** | 否 |
| 35 | 自动化迁移 | 文案步骤 only | M～L | **3（有双端用户再做）** | 否 |
| 31 | 完整站点托管 | 本机 draft stub | L | **4（独立增值轨）** | 否 |
| 34B | Sync E2E | 明确未做 | L | **另立项；与 Publish/搜索取舍** | 否 |

**拍板时请各选一行：** `暂缓` / `立项-目标版本` / `降级为更小切片（注明）`。

---

## 第五部分 · 测试与质量门禁

### 37. 测试要点（汇总）

- **本地：** 奇异文件名、大小写身份键冲突、移动库路径、权限撤销、崩溃原子写、欢迎页三路径。
- **同步：** §6.4/`syncignore`、断网队列、冲突矩阵（§9.3）、bootstrap 权威与未跟踪文件冲突副本、manifest 分页游标推进、push 端 rename/tombstone 传播、getContent rev 409、附件超限、错误码分支。
- **配额：** 超容量（push 拒 / pull 通）、超设备（拒 bind）。
- **隔离：** Cloud API 与 Vault API 互不影响；错误码空间分开。
- **插件：** 启用/禁用热加载与泄漏；权限否定；主题校验回退与 Safe Mode；`network:safe` allowlist 与 redirect 逃逸；publish 权限拒载；`minAppVersion` 不满足拒载；token 不可枚举。

### 38. 里程碑最少测试

| 里程碑 | 最少测试 |
|---|---|
| M1 | path 身份键；欢迎三路径；原子写；非法名；编辑器脏守卫 |
| M2 | §6.4/syncignore；冲突矩阵抽样；bootstrap 权威（含未跟踪文件 hash 比对）；manifest 分页；409/402/413 UI；Cloud/Vault API 隔离冒烟 |
| M3 | 权限否定；主题校验回退；Safe Mode；network allowlist；publish 权限拒载 |
| M4 | 备份 zip 不做 sync；迁移显式确认；双产品帮助页 |

### 39. 已落地回归测试（2026-11 协议修订）

| 位置 | 覆盖 |
|---|---|
| `v5notes2/note-modules/note-vault-sync/src/test/java/xin/v5ai/vault/service/VaultSyncManifestPaginationTest.java` | hasMore 探测（499/500/501 条边界）、`LIMIT 501` 探测 SQL、空页不推进游标 |
| `v5notes-clients/v5notes-vault-client/src/sync/engine.test.ts` | 分页续拉与最终 cursor 持久化、病态 hasMore 不死循环、rename/tombstone 传播、删除 409 标冲突、bootstrap 冲突副本与同内容免副本、getContent rev 409 不写盘 |

---

## 第六部分 · 结论摘要与明确不做

### 40. 结论摘要

| 议题 | 结论 |
|---|---|
| 双客户端 | **采用**：`v5notes-client2` 云权威；`v5notes-vault-client` 本地权威 |
| 双 API | **采用**：`note-notes`（`/client/notes*`）vs `note-vault-sync`（`/vault/v1*`） |
| Vault 位置 | **桌面用户自选文件夹**（Obsidian 同款）；沙箱仅作新手默认库 |
| 同步 | **文件级增量**（对标 Obsidian Sync）；整库上传仅作备份/导入导出；manifest 分页 `hasMore`【2026-11】 |
| 冲突 | 冲突副本、禁止静默覆盖；bootstrap 未跟踪文件先比 hash 再决定副本【2026-11】 |
| 唯一性 | 活跃 `(vault_id, identity_key)` 由服务层 vault 行锁强制；DB 层为普通索引（软删历史共存）【2026-11】 |
| bind | `POST /vault/v1/vaults/{id}/bind` 已存在且含设备数执法（评审疑点核实为误报）【2026-11】 |
| 插件 | **仅 Vault Client**；主题一等（Theme API）；网络仅 `network:safe`；发布不对第三方开放 |
| 共享 | 编辑器与账号 SDK；不共享工作区状态机 |
| 数据 | 默认两空间不自动合并；迁移靠显式工具 |

### 41. 明确不做（排期禁区）

- 单客户端双模式合并；Vault CRUD 复用 `/client/notes`
- 日常 Sync = 整库 zip 覆盖
- 首期 OT/CRDT 实时协同；首期 E2E 加密（可后置）
- 第三方发布 / 无限制网络 / 进程级插件沙箱承诺
- `v5notes-client2` 引入同款第三方插件宿主
- Cloud 与 Vault 数据自动互通

### 42. Kickoff 备忘（历史）

Phase 0 kickoff：开 `PR-0a`——创建可启动空壳 `v5notes-clients/v5notes-vault-client/`（Tauri 2 + Vue 3），配置 `identifier=xin.v5ai.v5notes.vault`、`schemes=["v5notes-vault"]`，vendor 复用 `@v5md`；同周并行 `PR-0b` 空 `note-vault-sync` 模块。（该 kickoff 已完成，现处于 Phase 4/5 迭代。）
