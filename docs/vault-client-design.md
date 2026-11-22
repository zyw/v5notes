# v5notes 双客户端设计实现文档

**产品定位：** 同时保留「纯云端笔记客户端」与「本地 Vault 优先、可选云同步」两类产品；后端 API 分两套；套餐与账号体系可共用。

**参考：** Obsidian Vault（用户自选文件夹）+ Obsidian Sync（加密增量同步，非整库 zip 上传）+ Obsidian Plugin（清单与生命周期）。

**插件：** 见本文 [插件系统](#插件系统)（仅 `v5notes-vault-client`）。工程拍板与工作流见 [工程决策与工作流](#工程决策与工作流)；五项延期能力见 [延期能力](#延期能力)。

**命名冻结：**

| 组件 | 名称 |
|---|---|
| Vault 客户端 | `v5notes-vault-client` |
| 后端同步模块 | `note-vault-sync`（API 前缀 `/vault/v1`） |
| 插件 API 包 | `@v5notes/vault-plugin-api` |
| 云端客户端（现有） | `v5notes-client2` |
| 云端笔记 API（现有） | `note-notes`（`/client/notes*`） |


---

## 1. 目标与非目标

### 1.1 目标

| 产品 | 启动 | 数据主存 | 网络 | 变现 |
|---|---|---|---|---|
| **Cloud Client**（现有 `v5notes-client2` 演进） | 需登录（或恢复 token） | 仅云端 | 强依赖 API | 账号 + 笔记套餐 |
| **Vault Client**（新建 `v5notes-vault-client`） | 免登录即可用 | 本地 Vault | 可选登录同步 | 同步配额 / 套餐 |

### 1.2 非目标（首期不做）

- 两个客户端共用同一套「笔记 CRUD」REST（刻意拆开，避免本地语义污染云端）
- 首期跨端实时协同编辑（OT/CRDT）
- 首期把 Cloud Client 改成也落本地缓存（可后置）
- 首期兼容任意第三方 Sync（只做自有云）
- 第三方插件发布站点 / CMS 发文能力（发布若需要，仅官方产品通道；见[插件系统](#插件系统)）
- `v5notes-client2` 首期引入与 Vault 同款第三方插件宿主

---

## 2. 为何拆成两个客户端 + 两套 API

### 2.1 决策

| 维度 | 同一客户端双模式 | **双客户端（采用）** |
|---|---|---|
| 启动路径 | 登录门 vs 直进 Vault，分支多 | 各自一条主路径 |
| 数据模型 | 雪花 ID vs 文件路径易缠在一起 | Cloud 继续 ID；Vault 以路径/本地 ID 为源 |
| 发布节奏 | 绑死 | Vault 可独立发版 |
| 后端 | 一个 API 要吞两种语义 | **Cloud API / Vault Sync API** 边界清晰 |
| 成本 | 短期省仓库 | 中长期省复杂度（你已接受） |

### 2.2 仍建议共享的部分（库，不是 App）

- Markdown 编辑器（V5Editor）
- 设计 token / 部分 UI 原子组件
- 账号登录、支付、套餐查询的 **Account SDK**（薄封装）
- 品牌资源、i18n 词条子集

原则：共享 **深模块**（编辑器、鉴权客户端），不共享「工作区状态机」。

---

## 3. 产品信息架构

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

---

## 4. Vault 落盘：自选文件夹 vs 应用沙箱

### 4.1 Obsidian 怎么做

- **桌面默认：用户自选（或创建）文件夹作为 Vault**  
  笔记是普通 `.md` + 子目录；配置在 Vault 内 `.obsidian/`。
- **移动端：** 受系统沙箱限制，更接近「应用管理的存储」，但仍保持「一个库一个根」的心智。
- 用户可有多个 Vault，切换即换根目录。

### 4.2 方案对比

| | **A. 用户自选文件夹**（贴近 Obsidian） | **B. 应用沙箱目录** |
|---|---|---|
| 用户心智 | 「文件夹就是库」，可用访达/资源管理器、Git、网盘旁路 | 「笔记在 App 里」，路径不可见或难找 |
| 可移植 | 拷文件夹即备份；易迁机 | 依赖 App 导出；迁机靠同步或导出包 |
| 安全风险 | 用户可能把库放进已同步网盘 → **双写冲突**（Obsidian 也警告） | 较少被旁路同步踩踏 |
| 权限 | macOS/Windows 要目录权限（Tauri scope） | 权限简单 |
| 实现 | 书签路径、权限续期、移盘检测 | 路径固定，实现快 |
| 多库 | 自然（多个路径） | 要在沙箱内再模拟多库 |
| Git/外部工具 | 强 | 弱 |

### 4.3 建议（Vault Client）

**桌面：默认 A（用户自选文件夹）；可选提供「使用应用内默认库」作为新手快捷入口（本质仍是沙箱内一个文件夹）。**

实现要点：

1. 首次启动：**创建新库 / 打开已有库**（与 Obsidian 一致）。
2. 库根写入 `vault.json` 或 `.v5notes/vault.json`（配置、同步绑定、设备 id），**笔记正文仍是用户可见的 `.md`**（推荐，便于「像 Obsidian」）。
3. Tauri：`dialog.open` 选目录 + 持久化 path + `fs` scope 动态授权。
4. 文档明确：**不要把 Vault 放在 iCloud/OneDrive/坚果云同步目录里再开官方 Sync**（双同步）。

**移动端（若有）：** 以 B 为主，提供「导出/导入 zip」与桌面互通。

---

## 5. 同步模型：整库上传 vs 按笔记增量

### 5.1 Obsidian Sync（概念层）

- **不是**每次把整个 Vault 打成 zip 上传。
- 更接近：**按文件/笔记变更做增量同步**，带版本历史、可选端到端加密、选择性同步（设置/插件等可关）。
- 冲突时常见策略：生成冲突副本或保留多版本，而不是静默覆盖。

### 5.2 方案对比

| | **整库上传（快照）** | **按笔记/文件增量**（贴近 Obsidian） |
|---|---|---|
| 协议复杂度 | 低：打包 → 上传 → 替换或存快照 | 高：清单、revision、分块、删除墓碑 |
| 流量与时间 | 库一大即不可用 | 可随改随传 |
| 冲突 | 难精细合并，易整库覆盖 | 可按文件冲突 |
| 版本历史 | 靠整包快照，贵 | 按文件版本更自然 |
| 离线多设备 | 弱 | 强 |
| 配额计费 | 按快照体积粗糙 | 按存储量 + 流量/设备数精细 |
| 实现周期 | MVP 快 | 中长期正确做法 |

### 5.3 建议

| 阶段 | 策略 |
|---|---|
| **MVP（可选）** | 「首次绑定：扫描上传」= **仅 bootstrap**：客户端扫盘后**逐文件走增量 `PUT/batch`** 写入；**不是**整库替换 API，也不静默全量覆盖已有云端内容（权威规则见 §9.3） |
| **正式版** | **文件级增量同步**（同步身份键见 §6.2；content hash + rev） |
| **不做** | 每次同步 zip 整库覆盖（只可作「灾难恢复导出」，不作日常 Sync） |

---

## 6. Vault Client：本地领域模型

### 6.1 库内布局（建议）

```
MyVault/                          # 用户自选根
  .v5notes/
    vault.json                    # 见 §6.5；设备字段永不同步（§6.4）
    appearance.json               # 当前主题意图（默认同步）
    syncignore                    # 可选：用户追加忽略规则（§6.6）
    index.sqlite                  # 可重建；永不同步
    sync-state.json               # 见 §6.5；永不同步
    trash/                        # 本地回收；永不同步
    plugins/                      # 见插件设计
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
**插件：** 启用意图与 `data.json` 可随库同步；插件代码默认各端自装；**永不同步**项见 §6.4（详见插件设计 §3.3）。

### 6.2 本地 ID（跨平台同步身份 — Phase 0 冻结）

同步层对每个库内文件使用**稳定身份键**；展示名与磁盘名可保留用户大小写，但身份比较必须跨平台一致。

| 规则 | 冻结值 |
|---|---|
| 路径形态 | Vault 根下的相对路径；段分隔一律 `/`（入库前把 `\` 规范为 `/`） |
| Unicode | 路径段与文件名一律 **NFC** 规范化后再比较 / 哈希 |
| **大小写** | **同步身份键 = NFC + 按段 Unicode case-fold（locale-independent）后的相对 path**；磁盘与 UI 保留用户原始大小写作「展示 path」。云端 `path` 存展示 path；冲突检测与去重一律用身份键。同库内禁止两个仅大小写不同的展示 path 并存（Win/macOS 默认卷上本就会撞；Linux 上客户端在扫盘时拒绝第二者并提示） |
| 禁止名 | 拒绝 Windows 保留基名（`CON`/`PRN`/`AUX`/`NUL`/`COM1`–`COM9`/`LPT1`–`LPT9`，大小写不敏感）及尾部空格/`.`；拒绝控制字符与 `<>:"\|?*` |
| Symlink | **默认不跟随出库**（符号链接指向库外 → 跳过并记警告）；库内 symlink 不作为独立同步实体 |
| 云端键 | `fileId`（雪花**字符串**）在首次成功上传后写入本地 `sync-state`；**用户不可见** |
| 重命名 | 本地 path 变更 → 同步层发显式 `rename`（**保留同一 `fileId`**）；禁止默默拆成无关联的 delete+create（否则丢版本历史）。仅当对端无 rename 能力/迁移脚本时才允许 delete+create（新 `fileId`） |

### 6.3 客户端模块（深模块切分）

| 模块 | 接口职责（小） | 实现内藏 |
|---|---|---|
| `VaultWorkspace` | open/create/switch vault | 权限、书签、最近库列表 |
| `VaultFs` | listTree / read / write / mkdir / rename / delete | 平台 fs、原子写、回收站 |
| `VaultSearch` | search(query) → hits | sqlite FTS / 扫描缓存 |
| `VaultEditorBridge` | openPath / save | 与 V5Editor 对接、脏检查 |
| `PluginHost` / `ThemeHost` | load/unload、权限代理、Safe Mode、主题切换 | 见[插件系统](#插件系统) |
| `SyncEngine` | login / bind / pushPull / status | 队列、冲突、重试、配额错误 |
| `AccountClient` | 登录、套餐、支付入口 | 可与 Cloud 共用 SDK |

UI（侧栏树、搜索、设置）只依赖上述接口，不直接打 Sync HTTP；插件只经 `PluginHost` 注入的 `@v5notes/vault-plugin-api` 访问能力。

### 6.4 Sync 路径分类（`.v5notes/` 包含 / 排除硬表）

**适用范围：** Phase 4 起 SyncEngine 即按本表过滤；**与 PluginHost（Phase 6）是否已实现无关**——配置意图文件在 Phase 4 就可进 Sync。插件文档 §3.3 必须与本表一致，冲突以本表为准。

| 路径 / 类别 | Sync | 说明 |
|---|---|---|
| 用户 `.md` / 附件（库根下非点目录） | **默认同步开** | 正文真相 |
| `.v5notes/appearance.json` | **默认同步开** | 当前主题 / 色模式意图（每库各自） |
| `.v5notes/plugins/*/data.json` | **默认同步开** | 插件**库**设置意图（描述本库笔记） |
| 插件代码、主题包、启用列表 | **不在库内** | 装在应用目录 `extensions/`，天然不进库同步（§插件 3.1） |
| 插件**全局**设置 `extensions/plugins/*/data.json` | **不在库内** | 应用级数据，不属于任何库 |
| `.v5notes/sync-state.json` | **永不同步** | 本机 cursor / baseRev / dirty / 副本视角 |
| `.v5notes/index.sqlite`（及 FTS 旁路文件） | **永不同步** | 可重建索引 |
| `.v5notes/vault.json` 中的本地副本字段（`replicaId`、本机路径书签、本地 salt 缓存等） | **永不同步** | 可同步的仅限显式列出的绑定元数据（如 `cloudVaultId`）；实现须字段级白名单，默认拒绝 |
| 设备 ID（本机身份，存应用级 localStorage，不在任何库内） | **不在库内** | 同一机器上所有库共用一个设备 ID；重装保留应用数据时不变 |
| `.v5notes/trash/**`（本地回收站） | **永不同步** | 与云端 tombstone / 云 trash 分开；他端以 tombstone 为准删文件 |
| 其它未列名的 `.v5notes/**` | **默认永不同步** | 新增路径须先改本表再进 Sync |

误同步 `sync-state` / 索引 / 副本字段会导致跨副本互相踩踏或「幽灵冲突」——视为协议级缺陷，禁止「先传着再说」。

### 6.5 关键配置 schema

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
    "replicaId": "uuid",
    "lastCursor": null
  }
}
```

- `localVaultId`：本机生成；「打开已有库」复用文件内值。
- `binding.cloudVaultId`：未绑定为 `null`；绑定后写入。**一本地库 ↔ 一云端库**（首期不做一对多）。
- `replicaId`：本库目录的**副本 ID**，创建库时以 `crypto.randomUUID()` 生成；同一库复制到别的目录或别的机器沿用原值，复制到同一机器另一目录则是另一副本。
- **设备 ID 不在这里**：它是「这台机器」的身份，首次 bind 时以 UUID 生成并存在应用级 localStorage（随应用数据目录），同一机器上的所有库共用；重装保留应用数据则不变，否则视为新设备。服务端只存不生成。
- `replicaId` / `lastCursor` 等本地字段：**永不同步**（§6.4）；可同步的绑定元数据须字段级白名单。

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

### 6.6 用户 `syncignore`（硬表之上的追加忽略）

§6.4 是协议硬表（不可被用户关掉「永不同步」项）。此外允许 `.v5notes/syncignore`（gitignore 风格）**追加**忽略用户内容路径，例如大目录、导出缓存。

默认建议写入（可随脚手架生成，用户可改「用户内容」行，不可指望靠它同步 `sync-state`）：

```
.git/
.DS_Store
Thumbs.db
*~
.*.swp
```

SyncEngine：先应用 §6.4，再应用 `syncignore`；被忽略的用户文件不进 manifest。

### 6.7 首次启动与多库 UX

1. **欢迎页三选一：** 创建新库（选父目录 + 库名）/ 打开已有库 / 使用应用内默认库。
2. 创建时写入 `.v5notes/` 骨架（含默认 `syncignore`）+ 可选「快速开始」示例笔记。
3. **最近库列表**存应用数据（非库内）；打开失败（权限/移盘）→「重新授权 / 从列表移除」。
4. 切换库：脏检查 → 卸载 PluginHost → 切换根 → 再加载。
5. 文案警告：勿将库放在网盘同步目录后再开官方 Sync。

---

## 7. Cloud Client：保持现架构

- 继续：`登录 → token → /client/notes` + `/client/notes/dir` + search。
- **不**引入 Vault 文件夹；本地最多以后加「离线缓存」（另一项目）。
- 套餐：限制笔记数、存储、协作等（现有或扩展 `client.account.*`）。

与 Vault 的差异要写进产品文案，避免用户以为「两个 App 是同一份笔记」。

**双产品边界（文案提前，不等 Phase 8）：** 自 Phase 3 起，登录相关 UI / 帮助中须有一句固定说明——同一账号可登录两个客户端，但 **Cloud 笔记与 Vault 同步库默认不是同一份数据**；「我的笔记在哪」指向当前产品（Cloud 在服务端目录树；Vault 在本机文件夹，可选同步）。完整帮助页可后置，**这一句不得缺席**。

---

## 8. 后端：两套 API

### 8.1 Cloud Notes API（现有，保留）

前缀示例：`/client/notes`、`/client/notes/dir`、`/client/notes/search`、trash、account…

语义：**服务端权威**；ID 为雪花字符串；目录树在 DB。

### 8.2 Vault Sync API（新建）

独立 Maven 模块：`note-modules/note-vault-sync`；API 前缀：`/vault/v1/...`（同进程挂载即可，勿并入 `note-notes` 的云端 CRUD 语义）。

#### 核心资源

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

#### 推荐接口（增量）

```
POST   /vault/v1/vaults                 # 创建云端库，返回 vaultId
GET    /vault/v1/vaults                 # 列表
POST   /vault/v1/vaults/{id}/bind       # 副本绑定（replicaId, deviceId, clientInfo）

GET    /vault/v1/vaults/{id}/manifest?since=CURSOR
       # 返回变更列表：upsert/delete/rename + fileId + remoteRev + contentHash + size
       # CURSOR 不透明单调；空 cursor = 从初始快照起

PUT    /vault/v1/vaults/{id}/files      # 上传/更新（path, fileId?, baseRev, hash, body或blob）
       # baseRev 冲突 → 409 + 服务端副本元数据

POST   /vault/v1/vaults/{id}/files/batch
DELETE /vault/v1/vaults/{id}/files      # path + baseRev（墓碑）

POST   /vault/v1/vaults/{id}/renames    # from → to + baseRev（保留 fileId）

GET    /vault/v1/vaults/{id}/files/content?path=&rev=

GET    /vault/v1/quota                  # 套餐剩余容量、副本数
```

认证：与现网同一 OAuth2/Sa-Token；`deviceType` 可用 `vault_client`。  
**不要**复用 `/client/notes` 的「建笔记就写 note 表当权威」语义给 Vault——否则路径模型与 ID 模型打架。

**Catalog 与 sync 前缀解耦：** 插件/主题目录 API **版本与破坏性变更独立于** `note-vault-sync` 文件协议。Phase 0 二选一冻结：（A）独立前缀如 `/vault/v1/catalog/...` 且文档标明「非文件 sync 资源」；或（B）同进程旁路路由，但仍使用**独立版本协商头/字段**，sync 协议 bump 不得强制 catalog 客户端升级。禁止把 catalog 响应塞进文件 `manifest`。

#### 表结构草稿（元数据）

| 表 | 要点 |
|---|---|
| `vault_space` | `id`（雪花字符串）、`user_id`、`name`、`created_at` |
| `vault_replica` | `id`、`vault_id`、`replica_id`、`device_id`、`client_info`、`last_seen_at`；唯一键 `(vault_id, replica_id)` |
| `vault_file` | `id`（=fileId）、`vault_id`、展示 `path`、`identity_key`、`type`、`content_hash`、`size`、`rev`、`deleted`、`updated_at` |
| `vault_file_blob` | `content_hash`、`storage_key`、`size`（内容寻址去重） |
| `vault_change` | `vault_id`、`cursor`、`file_id`、`op`（upsert/delete/rename）、`path`、`from_path`、摘要 |

ID 一律 **字符串**。索引：`(vault_id, identity_key)` **非唯一**（软删除历史与活行共用身份键，普通 UNIQUE 会挡住「同键重建 = 新 fileId」）；活跃行唯一靠插入前的库行锁，见下文。`(vault_id, cursor)` 供 manifest。

#### manifest 响应示意

```json
{
  "cursor": "opaque-next",
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
  ],
  "hasMore": false
}
```

#### manifest 分页（已实现）

`GET manifest?since=` **按页返回**，不是一次吐出全部变更。漏页会静默丢掉后续改动，因此这是协议的一部分，不是实现细节。

| 规则 | 冻结值 |
|---|---|
| 页大小 | `MANIFEST_PAGE_LIMIT = 500`（`VaultSyncServiceImpl`） |
| 探测 | 查询 `LIMIT 501`。多出的一行只用来判断还有没有下一页，**不**放进本页 `changes` |
| `hasMore` | `true` 表示本页之后还有变更。客户端必须用返回的 `cursor` 继续请求，直到 `hasMore` 为 false |
| `cursor` | 本页已包含变更的最大 id，序列化成不透明字符串。有下一页时它是**页游标**，不是「本轮已同步完成」 |
| 空页 / 卡住 | `hasMore=true` 但 `changes` 为空（游标无法前进）时客户端**必须停**，不得空转；不得把 cursor 回拨 |
| 提交 | 只有拉完最后一页，才把 `vault.json` 的 `lastCursor` 写成最终 cursor |

#### 活跃身份键唯一（已实现）

软删除历史行与活行**共用** `identity_key`。普通 `UNIQUE (vault_id, identity_key)` 会把「tombstone 后再建同键 = 新 `fileId`」挡死，因此**不用**唯一索引。

已落地的约束：

- 索引保持非唯一：`idx_vault_file_vault_identity (vault_id, identity_key)`。
- 首次上传插入前：`SELECT … FROM vault_space WHERE id = ? FOR UPDATE`（按库串行写者），再查是否已有 `deleted = 0` 的同身份键。
- 并发首次上传同一身份键：后到的一方看到先到的活行，返回 `409 vault.conflict.rev`，不插入第二行。

#### 内容读取的 rev（已实现）

`GET …/files/content?path=&rev=`：请求的 `rev` 不是该文件当前 rev 时返回 **`409 vault.conflict.rev`**，**不得**静默改返回最新正文。客户端本轮跳过该变更，下一轮再拉；不把过期正文写入磁盘。

#### 副本绑定（已存在）

`POST /vault/v1/vaults/{id}/bind` 在 `VaultSpaceController` 上，并执行**副本数**上限：超限拒绝新 bind；已绑定副本可继续 sync（§8.3）。额度按 `vault_replica` 行数计，不做设备去重——同一台机器上的两份库副本各占一个名额。这不是缺口。

#### 错误码空间（HTTP + 业务码）

| HTTP | 业务码（示意） | 含义 |
|---|---|---|
| 401 | `auth.unauthorized` | 未登录/过期 |
| 402/403 | `vault.quota.exceeded` | 容量或副本数超额 |
| 404 | `vault.not.found` / `vault.file.not.found` | |
| 409 | `vault.conflict.rev` | `baseRev` 不匹配，或 `GET content?rev=` 不是当前 rev；body 带服务端 path/rev/hash/fileId。不得改返回最新正文 |
| 413 | `vault.file.too.large` | 超单文件上限 |
| 429 | `vault.rate.limited` | |
| 400 | `vault.path.invalid` | 路径/身份键规范化失败 |

客户端须按码分支 UI（冲突副本 / 引导扩容 / 重新登录），勿只 toast 原始报文。

#### 存储

- 元数据：DB（上表）。
- 正文/附件：对象存储（S3/OSS）；小 Markdown 也可先存 DB，但附件必须对象存储。
- 内容寻址：`contentHash`（sha256）去重与完整性校验；Phase 5 可加 `uploadToken` 直传 OSS。

### 8.3 Account / Billing（可共用）

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
| 同步副本数 | — | ✓ |
| 版本历史保留天数 | 可选 | ✓ |
| 第三方登录 | ✓ | ✓（仅账号） |

**售卖形态与超额（Phase 0 必须勾选冻结，见 §13 Phase 0）：**

| 开放题 | 可选方案（择一写入计费方案） |
|---|---|
| 套餐售卖 | **A)** 两个 SKU（Cloud 笔记套餐 / Vault 同步套餐）可独立购买；**B)** 一账号两配额字段，单一商品内含两桶额度 |
| 同步超额 push | 一律拒绝 push（`402/403` + 可读错误码）；本地编辑不阻断 |
| 同步超额 pull | **冻结建议：仍允许只读 pull**（已有云端变更可拉取；避免「超额后多设备永久分叉」）；产品若改「超额双禁」须显式改本文与 Phase 0 勾选 |
| 副本数超限 | 拒绝新 `bind`；已绑定副本可继续 sync，直到用户停止该副本或升级 |

### 8.4 Vault Client 社交登录回调

与 Cloud Client **分应用标识**，避免 deep link 抢夺：

| | Cloud（client2） | Vault Client |
|---|---|---|
| Deep link | `v5notes://app/social-callback` | `v5notes-vault://app/social-callback` |
| `justauth` 基址 | `justauth.client-address` | 新增 `justauth.vault-client-address`（或同字段分环境） |
| OAuth 应用回调 | 登记 Cloud 回调 | **另登记** Vault 回调（Gitee 等常限单回调 → 常需独立 OAuth 应用或中转页） |
| `sys_client` | 现有 client | `deviceType=vault_client`，grant 含密码/社交 |

落地页可复用 `v5notes-clients/v5notes-oauth-landing/`，按 `app=vault` 唤起对应 scheme。

---

## 9. SyncEngine 详细流程

### 9.1 状态机（每文件）

`clean` → 本地编辑 → `dirty` → push 成功 → `clean`  
pull 发现新 rev → 若 local dirty → `conflict` → 用户处理 → `clean`

### 9.2 一次同步循环

1. 应用 §6.4 + `syncignore`；读本地 `sync-state` + 扫盘（或 watcher 队列）。
2. **拉取分页：** 循环 `GET manifest?since=pullCursor`，按 §8.2 直到 `hasMore` 为 false，或本页没有变更（卡住的 `hasMore` 不得空转）。只有最后一页落地后才把 `lastCursor` 写成最终 cursor。
3. **合并策略（默认）：**
   - 仅远端变：下载覆盖本地（若 local clean）。内容接口返回 `409`（rev 不匹配）时本轮跳过，不写盘。
   - 仅本地 dirty：upload（带 `baseRev`）。
   - 两边都变：冲突（见下）。
4. **推送本地 rename / tombstone**（在 dirty 上传之前）。`sync-state` 里 `status=clean`、已有 `fileId`、但磁盘上已没有该身份键的项：
   - 磁盘上另有同类型、还没有 `fileId`、且本轮尚未被改名认领的新文件 → 显式 `rename`（保留同一 `fileId`）。禁止拆成无关联的 delete + create。
   - 否则 `DELETE` 发 tombstone。
   - 对端 `409`：该项标 `conflict`，**禁止**静默从状态里删掉或假装删除成功。配额耗尽则停止本轮推送；可重试错误进重试队列。
5. 更新失败重试。

### 9.3 冲突（建议默认，贴近 Obsidian 可理解性）

**原则：** 冲突默认生成冲突副本；**禁止**静默选一边覆盖。UI 可提供对比；3-way merge 为后期可选项。

#### 冲突矩阵（超出「双端改正文」）

| 场景 | 默认处理 |
|---|---|
| 双端都改内容（local dirty ∧ remoteRev > baseRev） | 保留一方为原 path；另一方写成冲突副本；两边内容都不丢 |
| 一端删、一端改 | **改胜于未同步的删意图**：保留有内容的一侧为原 path；删除侧若已推 tombstone 而另一端随后 push 内容 → 409/冲突流程，生成副本或按「复活为新 fileId」策略显式提示，**禁止静默丢掉有内容一侧** |
| 一端 rename、一端改内容 | 应用 rename 到权威 path；内容以冲突副本规则合并（改后的正文落到新 path 或冲突副本，不丢） |
| 双端不同 rename（同 fileId / 同身份键） | 一方赢得目标 path（见下「命名」）；另一方的目标写成冲突副本文件名；两端 rename 意图都可见 |
| 一端 rename、一端 delete | 同「删+改」：有内容/有 rename 目标的一侧优先保留；tombstone 与 rename 冲突走显式冲突副本，禁止静默丢 |

#### 冲突副本命名

- 模板：`{stem} (冲突 {yyyy-mm-dd} {HHmm} {deviceShort}).{ext}`  
  例：`周报 (冲突 2026-11-14 1642 mac).md`
- `{replicaShort}` = 本地 `replicaId` 前 6 位小写字母数字（无值时取 `dev`），避免多副本同日撞名。
- 若目标名已存在：追加 `-2`、`-3`… 直至身份键唯一。
- 冲突副本本身是普通本地文件：标记 dirty，随后按增量上传（新 `fileId`）。

#### 冲突后 cursor / baseRev / dirty

1. 拉取并落地远端权威版本（或本地保留版）到原 path 后：该 path 的 `baseRev = remoteRev`，`dirty = false`（若本地无未合并编辑）。
2. 冲突副本：`baseRev` 空（新文件），`dirty = true`，待 push。
3. 推进全局 `cursor` 至本次 manifest 返回值，**避免**因未 ack 远端 rev 而反复 409。
4. 用户删除冲突副本或手动合并后，按普通编辑/删除进入下一轮 sync。

#### 首次绑定 bootstrap 权威（扫描上传 ≠ 静默整库覆盖）

| 情况 | 规则 |
|---|---|
| 云端库为空，本机首次 bind | 本机扫盘 → **逐文件增量 PUT/batch** 上传；创建云端权威 |
| 云端已有内容，本机空库/新开库后 bind | **云端为准**：pull 全量到本地；**禁止**空本地扫盘把云端抹成空 |
| 云端已有内容，本机也有文件（首次绑定 / 换机拷贝，本地尚无 sync-state） | **禁止静默覆盖**。云端为权威基线。对每个远端 upsert：磁盘上有同身份键、但 sync-state 还没有这条时，**先对本地文件做 sha256**（文本或二进制，与上传同一算法）。与远端 `contentHash` **相同**：原地采纳云端基线，**不出**冲突副本。**不同**：把本地字节写到冲突副本路径（dirty，新文件），再把远端正文落到原 path（clean）。冲突副本在同一轮 push 里作为新文件上传，本地版本以副本路径到达云端。不得 zip 整库替换 |
| 「扫描上传」文案 | 仅指 bootstrap 阶段的增量写入；**不是**整库替换 API（见 §5.3） |

### 9.4 删除与回收

- 本地删除 → tombstone 同步；他端拉到后删文件（本地可进 `.v5notes/trash`，**该目录永不同步**，见 §6.4）。
- 可选：本地 `.v5notes/trash` 保留 30 天（与云端 trash / tombstone GC 分开配置）。

### 9.5 附件

- Markdown 内相对链接优先：`附件/xxx.png`。
- 单文件上限（示意 25–100MB，套餐可抬）；超限不同步并角标提示（`413 vault.file.too.large`）。
- Phase 4 可先走同 PUT；Phase 5 改为 OSS 直传。

### 9.6 加密（分期）

- **一期：** HTTPS + 服务端可读（便于搜索、合规简单）。
- **二期（对标 Obsidian E2E）：** 客户端加密 blob，服务器只存密文；云端全文搜索不可用或仅限本地。

---

## 10. 搜索

| 客户端 | 策略 |
|---|---|
| Cloud | 现有 `/client/notes/search`（SQL/后续 ES） |
| Vault | **本地 FTS**（sqlite FTS5 / tantivy），对标 Obsidian「秒级」；**不**依赖同步 API 做日常搜索 |

同步与搜索解耦：搜本地盘，不搜云。

---

## 11. 仓库与工程结构建议

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

---

## 12. 安全与权限

- Vault Client：目录 ACL、路径穿越禁止（`..`）、符号链接策略（默认不跟随出库，见 §6.2）。
- Sync：所有 path 按 §6.2 规范化后校验；单文件大小上限；速率限制；路径过滤服从 §6.4。
- 套餐超额：**push** 返回 `402/403` + 可读错误码；**pull 默认仍允许**（只读拉取，见 §8.3）；本地编辑不因超额阻断。
- Secret：仅 Account/Sync token；Vault 本地无长期密码存储（与现网一致）。**插件 API / bridge 永不暴露这些 token**（见插件设计 §6）。

---

## 13. 实施路线图

原则：**先本地可用 → 再可选账号/同步 → 再扩展（插件/主题）→ 最后分发与官方增值**。  
插件子阶段与 [插件系统 §12](#12-实施路线) 对齐；**以本节为总排期**，插件部分只展开 API 细则。

依赖关系（简图）：

```
Phase 0 脚手架/冻结
    → Phase 1 本地 Vault MVP
        → Phase 2 本地体验打磨（含外观 token 地基）
            → Phase 3 Account（可选登录）
                → Phase 4 note-vault-sync + SyncEngine
                    → Phase 5 同步硬化
            ↘ Phase 6 PluginHost + Theme API（可与 Phase 5 部分并行）
                → Phase 7 插件扩展 + network:safe + catalog
                    → Phase 8 官方增值（含官方 Publish，非第三方）
```

### Phase 0 — 冻结与工程脚手架

**交付：** 可编译的空壳 `v5notes-vault-client` + 文档决策闭合。

- [ ] 命名与边界已冻结（本文「命名冻结」+ 插件/主题/发布政策；**保留**：双客户端/双 API、本地权威、冲突副本、主题一等、第三方无发布）  
- [ ] 仓库：`v5notes-clients/v5notes-vault-client/`（Tauri + Vue）；bundle id / deep link `v5notes-vault://` 与 cloud 区分（§8.4）
- [ ] `vault.json` / `sync-state` schema 与错误码表落地（§6.5 / §8.2）  
- [ ] 工程形态：monorepo **或** 独立仓 + editor / account-sdk 引用方式定稿（影响脚手架，不影响产品语义）  
- [ ] **同步身份：** §6.2 冻结（相对 path + NFC + case-fold 身份键 + 展示 path + 保留名 + symlink 不跟随出库）  
- [ ] **Sync 包含/排除总表：** §6.4 冻结（含 `sync-state` / `index.sqlite` / 设备字段 / 本地 trash **永不同步**）  
- [ ] **fileId / rename / tombstone / 同 path 重建：** §8.2 冻结  
- [ ] **冲突矩阵 + bootstrap 权威：** §9.3 冻结（删改/改名/双 rename；冲突副本命名；cursor/baseRev/dirty；云端已有内容时禁止静默整库覆盖）  
- [ ] 套餐字段：`cloud_*` / `vault_sync_*` 分列；**售卖形态**勾选 §8.3 的 A（双 SKU）或 B（一账号双配额）  
- [ ] **超额 pull 政策：** 勾选「仍允许只读 pull」（默认）或显式改为双禁；副本数超限 = 拒新 bind  
- [ ] **Catalog 前缀：** 独立于文件 sync 协议版本（§8.2 选项 A 或 B）  
- [ ] **双产品一句话：** 登录/帮助最小文案定稿（§7；Cloud 与 Vault 数据默认不通）  
- [ ] 插件 P1 对外承诺级别：权限代理 + Safe Mode，**不**承诺进程级沙箱（见插件设计 §6.2）  
- [ ] 明确：Cloud 与 Vault **数据默认不通**；迁移靠显式工具（后置）  

### Phase 1 — 本地 Vault MVP（免登录）

**交付：** 打开 App 即可建库写笔记，零网络。

- [ ] 欢迎页三选一（§6.7）：创建 / 打开 / 应用内默认库  
- [ ] `.v5notes/vault.json`（§6.5）+ 默认 `syncignore`（§6.6）；笔记真相为库内 `.md`  
- [ ] 路径身份键与非法名拦截（§6.2）  
- [ ] 侧栏树：展开折叠、新建目录/笔记、重命名、删除（本地）  
- [ ] `VaultFs` + `VaultEditorBridge` + V5Editor（预览/编辑切换保留实例策略对齐 AGENTS 精神）  
- [ ] 本地搜索 MVP（标题 + 正文；可先扫描，后换 FTS）  
- [ ] 无账号、无 Sync、无插件市场  

### Phase 2 — 本地体验打磨（仍可离线）

**交付：** 日常本地使用不脆；为 Theme API 预埋 CSS 变量。

- [ ] 文件 watcher、崩溃安全原子写、移盘/权限失效提示  
- [ ] 最近打开的库、本地 trash（如 `.v5notes/trash`）  
- [ ] 应用内设计 token / CSS 变量契约初版（供 Phase 6 主题校验）  
- [ ] 内置 fallback 外观；设置里预留「外观」入口（可先只切内置）  
- [ ] 基础快捷键、脏文档保存守卫  

### Phase 3 — Account 接入（账号可选）

**交付：** 能登录看套餐；未购套餐仍可纯本地用。

- [ ] 接入 Account SDK（登录/注册；社交登录策略与 cloud 客户端对齐或复用后端）  
- [ ] 设置页：账号、套餐状态、退出；token 仅内存/安全存储，不存密码  
- [ ] 同步入口：未登录/无额度 → 引导注册购买；**不阻断**本地编辑  
- [ ] 登录/设置中展示双产品边界一句（§7「我的笔记在哪」）  
- [ ] `deviceType` / clientId：`vault_client`（与 cloud client 区分）  

### Phase 4 — `note-vault-sync` + SyncEngine（首版同步）

**交付：** 登录后可按文件增量同步；冲突可见。

**后端（模块 `note-vault-sync`，前缀 `/vault/v1`）：**

- [ ] 表：`vault_space` / `vault_file` / `vault_change` / `vault_replica`（§8.2）  
- [ ] Vault 创建/列表、副本绑定  
- [ ] `manifest?since=`、单文件 up/down、tombstone、rename（保留 `fileId`）  
- [ ] `baseRev` 冲突 → `409 vault.conflict.rev`；配额与错误码表；超额 pull 政策按 §8.3  

**客户端：**

- [ ] `SyncEngine`：dirty 扫描、push/pull、cursor；路径身份与过滤服从 §6.2 / §6.4  
- [ ] **首次绑定 bootstrap** 仅增量写入（§5.3 / §9.3）；禁止整库替换 API / 静默全量覆盖  
- [ ] 冲突默认生成冲突副本（矩阵见 §9.3；禁止静默覆盖）  
- [ ] 同步状态 UI（进行中/失败/配额不足）  
- [ ] **`.v5notes` 配置/意图同步规则在本 Phase 即生效**（§6.4），**不依赖** Phase 6 `PluginHost`；代码二进制默认同步关 

### Phase 5 — 同步硬化与附件

**交付：** 多设备可日常用。

- [ ] 后台/空闲同步、重试队列、断网恢复  
- [ ] 设备管理（列表、踢设备）  
- [ ] 附件与体积上限；版本历史（按需；完整历史仍见[延期能力](#延期能力)）  
- [ ] 配额与套餐文案与 Cloud 产品区分清楚  
- [ ] （可选后置）E2E 加密  
- [x] **协议补丁：** manifest 分页 `hasMore` + 500 上限，客户端翻页直到耗尽（§8.2）  
- [x] **协议补丁：** 活跃身份键用 vault 行锁 + 插入前复查，并发首次上传 409；不用会挡住 tombstone 的 UNIQUE（§8.2）  
- [x] **协议补丁：** `GET content?rev=` 不匹配返回 409，客户端不写过期正文（§8.2）  
- [x] **协议补丁：** 推送侧本地改名发 rename、本地删除发 tombstone；删除 409 标冲突（§9.2）  
- [x] **协议补丁：** 首次绑定同身份键且 hash 不同才出冲突副本；hash 相同则采纳基线（§9.3）  
- [x] `POST …/bind` 已存在并执行副本数上限（§8.2 / §8.3）

### Phase 6 — 插件宿主 + 一等主题（扩展平台地基）

**交付：** 可加载官方/本地功能插件；主题可切换。细则见[插件系统](#插件系统)。

- [ ] 包：`@v5notes/vault-plugin-api`（含 `ThemeApi`）  
- [ ] `PluginHost`：`manifest` + `onload`/`onunload`；权限代理；Safe Mode  
- [ ] P1 能力：`addCommand`、`loadData`/`saveData`、启用 UI；`vault:read/write`、`ui:commands`  
- [ ] **Theme API（P1b）**：应用目录 `extensions/themes`、`appearance.json`（每库）、`theme.css` 校验与回退、设置「外观」  
- [ ] 官方核心插件起步：日记、模板（吃自己的狗粮）  
- [ ] **不**做第三方发布 API；**不**开放无限制 `network`  

### Phase 7 — 插件扩展、安全网络与目录

**交付：** 社区可装功能插件与主题；联网仅安全白名单。

- [ ] SettingTab、Ribbon/Status、`registerView`、Markdown post processor  
- [ ] `registerEditorExtension`（V5Editor 扩展点）、`MetadataCache` 基础  
- [ ] `network:safe` + `networkAllowlist`（禁止静默全库外传、禁止发布管线）  
- [ ] 本地「从文件夹安装」插件/主题  
- [ ] Catalog（`kind=plugin|theme`；前缀/版本独立于文件 sync，见 §8.2）；审核/标签拒绝 publishing；签名校验（官方源）  
- [ ] 更多核心插件：反向链接等  
- [ ] 启用意图与外观意图随库同步已在 Phase 4 按 §6.4 落地；本 Phase 仅补齐宿主加载与各端自装二进制体验  

### Phase 8 — 官方增值与产品收尾（可选）

**交付：** 官方能力与双产品叙事完整；第三方仍无发布权。

- [ ] 若做发布/分享：仅 **官方产品通道**（非社区插件权限）  
- [ ] 导出/备份工具（整库 zip 仅作备份，不作日常 Sync）  
- [ ] Cloud ↔ Vault 显式迁移工具（若需要）  
- [ ] 帮助文档、双客户端关系说明、套餐页文案  

### 并行轨 — Cloud Client（`v5notes-client2`）

与 Vault 排期并行，互不阻塞 Phase 1–2：

- [ ] 继续云端笔记与现有 `/client/notes*`  
- [ ] 套餐展示与 Vault 同步额度文案区分  
- [ ] 文档：两产品关系；首期 **不** 引入 Vault 同款第三方插件宿主  

### 建议里程碑（验收口径）

| 里程碑 | 完成 Phase | 用户可感知结果 |
|---|---|---|
| M1 本地可用 | 1–2 | 免登录，本地库读写搜索稳定 |
| M2 可同步 | 3–5 | 登录后多设备增量同步，冲突可读 |
| M3 可扩展 | 6–7 | 主题一等 + 插件（含安全联网），无第三方发布 |
| M4 产品完整 | 8 + Cloud 文案 | 官方增值与双产品边界清晰 |

---

## 14. 测试要点

- **本地：** 奇异文件名、大小写身份键冲突、移动库路径、权限撤销、崩溃原子写、欢迎页三路径。  
- **同步：** §6.4/`syncignore`、断网队列、冲突矩阵（§9.3）、bootstrap 权威、附件超限、错误码分支。  
- **配额：** 超容量、超设备。  
- **隔离：** Cloud API 与 Vault API 互不影响；错误码空间分开。  
- **插件：** 见[插件系统 §13](#13-测试要点)。

---

## 15. 结论摘要

| 议题 | 结论 |
|---|---|
| 双客户端 | **采用**：`v5notes-client2` 云权威；`v5notes-vault-client` 本地权威 |
| 双 API | **采用**：`note-notes`（`/client/notes*`）vs `note-vault-sync`（`/vault/v1*`） |
| Vault 位置 | **桌面用户自选文件夹**（Obsidian 同款）；沙箱仅作新手默认库 |
| 同步 | **文件级增量**（对标 Obsidian Sync）；整库上传仅作备份/导入导出 |
| 插件 | **仅 Vault Client**；主题一等（Theme API）；网络仅 `network:safe`；发布不对第三方开放；详见[插件系统](#插件系统) |
| 共享 | 编辑器与账号 SDK；不共享工作区状态机 |
| 数据 | 默认两空间不自动合并；迁移靠显式工具 |

---

# 工程决策与工作流

本节并入原 `vault-client-dev-plan.md` 里**仍然有效、且前部没有写过**的工程拍板。Phase 0–8 的交付清单以本文 §13 为准，这里不再复述。按周拆的开工清单和「书面接受前不写业务代码」已过时：垂直切片已经落地，协议补丁见 §8.2 / §9.2 / §9.3。

## 工程 · 仓库锚点

| 现状 | 含义 |
|---|---|
| `v5notes-clients/v5notes-client2/`（Tauri 2 + Vue 3）与 `v5notes2/note-modules/{note-basics,note-notes,note-system}` 已在同仓 | Vault 客户端与 Sync 模块是同仓兄弟目录，不另起仓库 |
| 共享包在真正有第二消费者时再抽到 `v5notes-clients/packages/` | 不把 monorepo 当 Phase 0 门禁 |
| 编辑器依赖 `@v5md/core\|view\|vue` | Vault 壳与 Cloud 同一方式引用 |
| Cloud：`v5notes://`，bundle `xin.v5ai.v5notes.client2`，`deviceType=client` | Vault：`v5notes-vault://`、`xin.v5ai.v5notes.vault`、`deviceType=vault_client` |
| 落地页 `v5notes-clients/v5notes-oauth-landing/` | `app=vault` → `v5notes-vault://`；后端 `justauth.vault-client-address` |
| Cloud API 在 `note-notes`（`/client/notes*`） | Sync 禁止并入 note-notes；模块 `note-vault-sync`，前缀 `/vault/v1` |

## 工程 · 已采纳的产品默认

前部标成开放题的项，按下列默认执行，除非另有书面改选：

| 项 | 采纳 |
|---|---|
| 套餐售卖 | **B**：一账号两配额字段（`cloud_*` / `vault_sync_*`），商店文案分桶展示 |
| Catalog | **A**：`/vault/v1/catalog/...`，标明不是文件 sync 资源；版本独立于 manifest |
| 双产品一句 | 「同一账号可登录两个客户端；Cloud 笔记与 Vault 库默认不是同一份数据。Cloud 在服务端目录树；Vault 在本机文件夹，可选同步。」 |
| 安装包名 / bundle | `productName=V5Notes Vault`；`identifier=xin.v5ai.v5notes.vault` |
| tombstone GC | ≥ 90 天 |
| 超额 pull | 仍允许只读 pull；副本数超限拒绝新 bind |

## 工程 · 工作流

| 工作流 | 范围 | 主要 Phase |
|---|---|---|
| WS-A 客户端本地 | vault-client UI / Fs / Editor | 0–2 |
| WS-B 账号 | Account、OAuth、`sys_client` | 3 |
| WS-C 后端 Sync | `note-vault-sync` | 4–5 |
| WS-D SyncEngine | 客户端同步状态机 | 4–5 |
| WS-E 插件平台 | api / host / catalog | 6–7 |
| WS-F 产品收尾 | 官方增值、帮助、迁移 | 8 |
| WS-G Cloud 并行 | client2 文案 / 套餐 | 全程 |

协议或表结构变更与 UI 大改分开提交。§6.4 过滤变更必须带单测。禁止在 Vault 改动里改变 `/client/notes` 语义。

## 工程 · 质量门禁

| 里程碑 | 最少测试 |
|---|---|
| M1 | path 身份键；欢迎三路径；原子写；非法名；编辑器脏守卫 |
| M2 | §6.4 / syncignore；冲突矩阵抽样；bootstrap 权威（含 hash 相同不出副本）；409 / 402 / 413 UI；manifest 分页；Cloud / Vault API 隔离冒烟 |
| M3 | 权限否定；主题校验回退；Safe Mode；network allowlist；publish 权限拒载 |
| M4 | 备份 zip 不做 sync；迁移显式确认；双产品帮助页 |

## 工程 · 明确不做

- 单客户端双模式合并；Vault CRUD 复用 `/client/notes`
- 日常 Sync = 整库 zip 覆盖
- 首期 OT/CRDT；首期 Sync E2E（见[延期能力](#延期能力)）
- 第三方发布 / 无限制网络 / 把进程级沙箱写成对外承诺
- `v5notes-client2` 引入同款第三方插件宿主
- Cloud 与 Vault 数据自动互通

---

# 插件系统

**范围：** 仅 `v5notes-vault-client`（本地 Vault 优先）。`v5notes-client2` 首期不做第三方插件。

**参考：** Obsidian Plugin（`manifest.json` + `main.js`、`Plugin` 生命周期、`App` / `Vault` / `Workspace` / 命令与设置页）。

**关联：** 本文前部（双客户端、§6.4、§8.2、§13）。本节由原 `vault-client-plugin-design.md` 并入。

**命名：**

| 组件 | 名称 |
|---|---|
| 宿主应用 | `v5notes-vault-client` |
| 插件 API 包 | `@v5notes/vault-plugin-api`（含 `ThemeApi`） |
| 宿主运行时 | `PluginHost` + `ThemeHost` |
| 全局功能插件目录 | 应用配置目录 `extensions/plugins/<plugin-id>/` |
| 全局主题目录 | 应用配置目录 `extensions/themes/<theme-id>/` |
| 启用列表（全局） | 应用配置目录 `extensions/community-plugins.json` |
| 库级插件设置 | `.v5notes/plugins/<plugin-id>/data.json` |

---

## 插件 1. 目标与非目标

### 1.1 目标

- 用户可在 Vault 内启用/禁用第三方（及官方）插件，扩展命令、侧栏、视图、编辑器能力、文件处理。
- **主题为一等品类**：经稳定 **Theme API** 安装/切换外观（不仅是「随便塞一段 CSS」）。
- 开发者体验贴近 Obsidian：清单 + 打包入口 + `onload` / `onunload`，降低迁移与学习成本。
- **能力分级**：插件默认只能碰公开 API；网络仅开放**安全只读/白名单**类能力；危险能力（任意路径、Shell）默认不开放。
- **插件是全局的**：装一次，所有库通用；启用状态也全机一份。插件设置分两层——全局设置跟随应用，库设置跟随库（见 §3）。

### 1.2 非目标（首期）

- 不兼容直接加载未改写的 Obsidian 插件（API 同构但非二进制兼容）。
- 不做任意 Node/Electron 原生模块加载。
- 不做云端远程执行插件代码；插件始终在本机宿主内加载。
- **不对第三方开放「发布」类能力**（站点托管、一键发博客/文档站、官方 Publish 等价物）；发布若需要，仅官方产品功能。
- 第三方**不得**实现整库 Sync / 替代 `SyncEngine`。
- 首期不做付费插件商店结算（可后置）；目录与签名可先做只读清单。

---

## 插件 2. 与 Obsidian 对齐 / 刻意差异

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

## 插件 3. 目录与启用模型

### 3.1 布局

**插件与主题装在应用层**，不放在库里。库只保留属于它自己的那一层设置。

```
~/Library/Application Support/xin.v5ai.v5notes.vault/     # 应用配置目录
  extensions/
    community-plugins.json      # 启用列表（全局一份）
    plugins/
      hello-world/
        manifest.json           # kind: "plugin"（默认）
        main.js
        styles.css              # 可选：插件局部样式
        data.json               # 插件「全局」设置
    themes/
      forest-ink/
        manifest.json           # kind: "theme"
        theme.css               # 必需：仅写约定 CSS 变量 / 允许选择器
        theme.json              # 可选：色板、亮暗变体元数据
  recent-vaults.json
  vault-registry.json
```

```
MyVault/                        # 库，只装内容与库级偏好
  .v5notes/
    vault.json
    appearance.json             # 当前 themeId、色模式偏好（每库各自，可同步）
    plugins/
      hello-world/
        data.json               # 插件「库」设置：描述本库笔记的配置
    index.sqlite
    sync-state.json
  工作/
    ...
```

**为什么插件全局：** 插件是产品的一部分，不是某个库的附属物；按库存放会让「换台机器打开同一个同步库 → 启用记录在、代码不在」成为常态。库色（立春/寒露）与当前主题选择仍按库保留，因为它们描述的是「我怎么看这个库」。

### 3.2 启用语义

- **安装** ≠ **启用**：拷到 `extensions/plugins/<id>` 后，仍需在「插件与安全」设置中打开。
- `community-plugins.json`（全局一份）示例：

```json
{
  "enabled": ["hello-world", "daily-notes"],
  "versions": {
    "hello-world": "1.2.0"
  }
}
```

- **启动时**（不必先打开库）：`PluginHost` 读启用列表 → 校验 `manifest` → 按 id 字典序加载 → 失败则标记 `failed` 并记录错误，不影响其余插件与启动。
- **切换库**：宿主不重启，只把 `vault` 适配器指向新库；插件已注册的命令、视图、编辑器保持不变。
- **主题**与功能插件分目录、分清单；同一时间仅 **一个** 社区/自选主题生效（可叠加官方「基础壳」变量）；切换走 `app.theme`（§5.6）。装了哪些主题是全局的，当前选哪个是每库各自的（`appearance.json`）。

### 3.3 同步

**权威总表：** 本文 §6.4（含 `sync-state.json` / `index.sqlite` / 设备私有字段 / 本地 trash **永不同步**）。用户可追加本文 §6.6 `syncignore` 忽略更多用户内容，但**不能**用它打开硬表中的「永不同步」项。下表仅为插件相关切片；与 §6.4 冲突时以 §6.4 为准。本规则在 **Phase 4 SyncEngine** 即生效，**不依赖** Phase 6 `PluginHost`。

| 路径 | 是否进 Vault Sync |
|---|---|
| `.v5notes/plugins/*/data.json`（插件**库**设置） | **默认同步开**（描述本库笔记的配置） |
| `.v5notes/appearance.json`（当前主题、色模式） | **默认同步开**（当前主题意图） |
| `.v5notes/plugins/*/main.js`、`manifest.json`、`community-plugins.json` | **不在库内**——插件装在应用目录，天然不进库同步 |
| `sync-state.json`、`index.sqlite`、`vault.json` 设备字段、`.v5notes/trash/**` | **永不同步**（见主设计 §6.4） |
| 官方核心插件与内置主题 | 随 App 发版，不放库内 |

**插件全局设置**（`extensions/plugins/<id>/data.json`）在应用目录，不属于任何库，**不参与库同步**。

文档需提示：插件代码是全局的、不随库同步；多设备需各自安装插件，但同一库的插件库设置会随库同步。

---

## 插件 4. 插件包契约

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
4. **`onUserEnable`（可选）：** 用户在设置中**首次**将该插件从关闭打到开启时调用一次（**全机**每个 `plugin id` 至多一次，不按库区分，直到卸载/清除启用记录）。用于迁移旧数据、展示权限说明、一次性引导。**不是**每次启动的钩子——每次启动仍走 `onload`；关闭走 `onunload`。未实现该方法则跳过。主题包若带 `main.js`，对等可选用，语义相同。

### 4.3 构建

- 官方脚手架（均已落地）：
  - `@v5notes/create-vault-plugin` — [`v5notes-clients/packages/create-vault-plugin/`](../v5notes-clients/packages/create-vault-plugin/)：生成 + esbuild 构建 + 安装到应用目录；产物改写为宿主要求的 CJS 导出形状。
  - `@v5notes/create-vault-theme` — [`v5notes-clients/packages/create-vault-theme/`](../v5notes-clients/packages/create-vault-theme/)：按主色生成三段式受限 `theme.css`（浅色 / 深色 / 明暗安全网），校验 + 安装。
- 依赖：仅允许 `import` `@v5notes/vault-plugin-api`（宿主注入，**不打包进 main.js**）；其它第三方必须打进 bundle。
- 宿主用动态 `import()` / `new Function` 沙箱加载（见 §6），不跑未打包的多文件裸源码。

---

## 插件 5. 宿主 API 面（深模块）

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

### 5.4 编辑器扩展与可替换编辑器

- `registerEditorExtension(spec)`：对接当前编辑器的公开扩展点（命令、装饰、块菜单、输入规则），**不**保证暴露完整 ProseMirror/TipTap 内部。
- Markdown 渲染后处理：`registerMarkdownPostProcessor`（预览模式 HTML 节点）。
- **编辑器本身是插件**（不引入 Cordis）。`registerEditorProvider` 需要 `editor:provide`。宿主同一时间只挂一个 provider，画布是空容器，由 provider `mount()` 填入。
- 核心插件 `v5-editor`（V5 编辑器）**始终加载、不可禁用**。可选核心插件 `plain-text`（纯文本）启用后可在设置里切换。第三方插件同样可注册 provider。
- 预览/编辑切换只调用 `EditorSession.setEditable`，**不得卸载再挂载**，以便保留撤销历史。换笔记可以 `setMarkdown`，换 provider 才销毁旧会话。
- 安全模式仍加载核心编辑器；若当前选中的社区编辑器被跳过，回退到 `v5-editor`。

### 5.5 设置（两层）

插件设置按归属分两层，用 `scope` 显式选择：

| scope | 位置 | 语义 |
|---|---|---|
| `'vault'`（**默认**） | `<库>/.v5notes/plugins/<id>/data.json` | 描述本库笔记的配置：上次打开的笔记、本库模板目录、本库统计缓存 |
| `'global'` | `<应用配置目录>/extensions/plugins/<id>/data.json` | 跟库无关的配置：界面密度、面板折叠、用户自配接口 |

```ts
const vaultPrefs = await this.loadData()               // 默认 'vault'
await this.saveData({ templateDir: '模板' })           // 默认 'vault'
const appPrefs = await this.loadData('global')
await this.saveData({ density: 'compact' }, 'global')
```

- 默认 `'vault'`：插件设置多数与库内容绑定，默认落库层更安全；要跨库共享必须显式声明。
- **没有库时**：`loadData()` 返回 `null`，`saveData()` 抛「打开库后可保存库内设置」；全局层任何时候可读写。
- `PluginHost` 需保证两层互不串：写进全局层的数据从库层读出来必须是 `null`。
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

## 插件 6. 加载与隔离

### 6.1 加载顺序

1. 应用内置主题（fallback）→ 再应用当前库选中的主题（`appearance.json`，无库时用默认）。
2. 内置核心插件（官方，随 App）。
3. 应用目录下已启用的社区/本地**功能插件**（按 `id` 字典序；显式 `dependencies` 字段后期再加）。
4. 单个失败：捕获、标记 `failed`、其余继续；主题 CSS 校验失败则回退内置主题并提示。

宿主在应用启动/打开设置时即可加载，**不要求先打开库**；没有库时 `vault` 适配器返回空列表、读写抛「打开库后可读写笔记」。

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

## 插件 7. 权限模型

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
| `editor:provide` | 注册一个可切换的笔记编辑器 |
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

## 插件 8. 品类：核心 / 社区功能插件 / 主题

| 类型 | 存放 | 更新 | 示例 |
|---|---|---|---|
| 核心功能插件 | App 内置 | 随客户端发版 | 反向链接、日记、模板、大纲增强 |
| 社区功能插件 | 应用目录 `extensions/plugins` | 市场 / 手动安装 | 日历、看板、安全联网工具、编辑增强 |
| **主题（一等）** | 应用目录 `extensions/themes` | 市场「主题」分区 / 手动安装 | 色板与排版主题；经 Theme API 切换 |
| 官方发布 / Sync | 产品功能，非社区插件 | 随客户端 / 套餐 | Publish、Vault Sync |

除核心插件外均为**全局安装**；库只影响「当前选中的主题」与插件的库级设置。

核心功能插件同样走 `Plugin` 基类。主题走 `kind: "theme"` + Theme API。

### 8.1 社区可做 / 不可做（摘要）

| 可做 | 不可做（第三方） |
|---|---|
| 命令、文件自动化、面板、编辑器/预览增强 | 一键发布站点 / 对外 CMS 发布管线 |
| **主题包**（Theme API） | 无限制任意联网、静默全库外传 |
| `network:safe` 白名单查询类、用户触发的单次辅助 | 接管或旁路官方 Sync |

---

## 插件 9. 插件 / 主题市场（后期，可挂后端）

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

## 插件 10. 工程结构

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

---

## 插件 11. 安全与滥用面

- Path：一律相对库根规范化；拒绝 symlink 逃逸（与 Vault 主设计 §6.2 一致）。
- 资源：限制单插件 CSS/内存；命令注册名强制 `pluginId:` 前缀防撞。
- 主题：CSS 变量契约 + 选择器白名单；校验失败回退内置主题。
- 网络：仅 `network:safe` + allowlist；无发布 API；「禁止静默全库外传」= 政策 + 审核 + 网络策略（P1 非沙箱保证，见 §6.2）。
- Token：Account/Sync 凭证对插件不可达（§6.2）。
- 权限：`fs:arbitrary` / 无限制 `network` / `publish:*` / `sync:control` / `shell` 第三方永不发放。
- 更新：不允许插件自改 `main.js` / `theme.css` 提权绕过（代码目录只读挂载）。
- 审计：设置页一键「安全模式」：仅核心插件 + 内置主题（对标 Obsidian Safe Mode）。

---

<a id="12-实施路线"></a>
## 插件 12. 实施路线

**总排期以本文 §13 为准**（Phase 6–8 覆盖插件平台）。下表仅映射插件子系统内部切片，避免与总路线重复排期。

| 插件切片 | 对应主设计 | 内容 |
|---|---|---|
| P0 API 草案 | Phase 0 / 6 启动前 | `@v5notes/vault-plugin-api`（含 ThemeApi）、CSS 变量契约、权限表、示例文档 |
| P1 宿主最小闭环 | **Phase 6** | `PluginHost`、命令/`data.json`、权限代理、Safe Mode |
| P1b Theme 一等 | **Phase 6** | `extensions/themes`、`appearance.json`、校验与回退、外观设置 |
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

<a id="13-测试要点"></a>
## 插件 13. 测试要点

- 启用/禁用热加载与泄漏（事件、DOM、命令是否卸净）。  
- 权限否定：无 `vault:write` 时写入抛错。  
- 主题：非法 CSS、切换、Safe Mode 回退；功能插件无 `ui:theme` 时不能改 `:root` 核心变量。  
- 网络：非白名单 host 失败；redirect 逃逸失败；声称发布类权限的包拒绝加载。  
- 路径逃逸、超大 `main.js`、损坏 manifest。  
- Safe Mode 下社区插件全跳过、主题回退内置。  
- API 版本：`minAppVersion` 不满足时拒绝加载并提示升级。  

---

## 插件 14. 结论摘要

| 议题 | 结论 |
|---|---|
| 是否做插件 | **做**，且仅 Vault Client |
| 形态 | Obsidian 同款包结构与生命周期；API 包 `@v5notes/vault-plugin-api` |
| 主题 | **一等品类** + **Theme API**（`kind: theme`，独立目录与市场分区） |
| 网络 | 仅 **`network:safe`**（白名单）；禁止无限制联网与静默全库外传 |
| 发布 | **不对第三方开放**；官方产品能力另做 |
| 安全 | **权限声明 + 宿主代理**（P1 非进程隔离）；无任意 fs/shell/publish；token 不对插件暴露 |
| 归属 | 插件代码、主题包、启用状态为**全局**（应用目录）；插件设置分**全局**与**库**两层，库层随库同步（§3.3、§5.5） |
| 市场 | catalog 分插件/主题；**协议版本独立于**文件 sync；可同进程旁路或 CDN |
| 与云端客户端 | `v5notes-client2` 首期不引入同一套第三方插件 |

---

# 延期能力

**受众：** Yanwei Zhu  
**用途：** 在 Phase 0–8 垂直切片已落地、M4 产品收尾仍为 stub/局部能力的前提下，分别展开五项延期项，便于拍板「做不做 / 何时做 / 做到哪」。  
**依据：** 本文前部、[插件系统](#插件系统)、`docs/vault-acceptance-report.md`（若仍在仓内）；交接 `internal/phase4|5|8-*-handoff.md`。本节由原 `vault-deferred-features.md` 并入。协议补丁（分页、推送侧 rename/tombstone、首绑按 hash 出副本、活跃身份行锁）已落地，不在本延期清单里。  
**总判：** 五项均未交付完整产品能力；现有多为设置页文案、本机草稿、空 API 或局部本地工具。

---

## 全程约束（决策不可突破）

| 约束 | 含义 |
|---|---|
| **双产品** | Cloud（`v5notes-client2` + `/client/notes*`）与 Vault（`v5notes-vault-client` + `/vault/v1*`）数据默认**不通**；账号可共用，空间不自动合并 |
| **本地权威** | Vault 真相是本机文件夹里的 `.md`/附件；云端是可选 Sync 镜像，不是第二套笔记 CRUD |
| **增量同步** | 日常 Sync = 文件级 `manifest` + PUT/DELETE/rename；**禁止**把整库 zip 覆盖当 Sync |
| **冲突副本** | 双端冲突默认出冲突副本；禁止静默覆盖 |
| **官方-only 发布** | 站点托管 / Publish 若做，仅**官方产品通道**（`channel=product`） |
| **禁止第三方 `publish:*`** | 社区插件永不获得发布权限；Catalog 拒绝 `publishing`；`network:safe` ≠ 发站管线 |

**工作量刻度：** S ≈ 1 个小垂直切片；M ≈ 1–2 个完整功能 PR 轨；L ≈ 跨客户端+后端+运维/计费的多周产品能力。

**建议对照里程碑：** M1 本地可用 → M2 可同步 → M3 可扩展 → M4 产品完整（见开发计划）。下列「建议排期」均假设 **先解除验收阻断**（建库 VN-15、`/vault/v1` 部署）并稳住 M2，再开延期项。

---

## 延期 1. 完整站点托管（官方 Publish beyond stub）

### 是什么（用户能感知到什么）

用户在 Vault 客户端用**官方「发布 / 分享」**，把选中笔记或整站发布成可公开（或未列出）访问的 Web 站点：有稳定公开 URL、可更新、可下线；外观与权限由官方产品控制，而不是靠社区插件「一键发博客」。

### 现状（代码里已有 stub / 缺口）

| 已有 | 缺口 |
|---|---|
| 设置页「官方发布 / 分享」；本机 draft（站点标题、可见性 `private\|unlisted\|public`）写入 `localStorage` | 无公开 URL、无 CDN、无部署流水线 |
| `channel=product`、`status=preview`；文案写明永不对第三方开放 | 无 Publish HTTP API / 无托管后端 |
| 插件宿主 / Catalog **永久拒绝** `publish:*` / `publishing`（正确禁区） | 预览保存 ≠ 上线；验收报告 #12 仅认 stub 文案 PASS |

关键路径：`v5notes-clients/v5notes-vault-client/src/publish/officialPublish.ts`、`SettingsView.vue`；Phase 8 交接明确延期「完整站点托管 / 公开 URL / CDN」。

### 目标能力边界

**做（若立项）：**

- 官方产品内：选笔记/文件夹 → 生成静态站或受控渲染站 → 分配 `*.v5notes…`（或自有域名）URL
- 可见性：private / unlisted / public；可撤销、可再发布
- 与套餐挂钩（站点数、流量、自定义域可选）
- 全程 `channel=product`；宿主继续拒绝任何第三方 Publish API

**明确不做：**

- 第三方插件 `publish:*`、社区「发站 / CMS 管线」
- 用 `network:safe` 白名单绕道批量外传整库当发布
- 把 Publish 塞进文件 `manifest` / 与 Sync 协议绑死版本
- 把 Cloud Client 笔记树静默当成 Publish 源（若要支持 Cloud，须独立产品入口，不混 Vault Sync）

### 关键依赖

| 层 | 依赖 |
|---|---|
| 客户端 | Vault 设置/发布向导；只读选文件；发布状态 UI；**不**经 PluginHost 发能力 |
| note-vault-sync | **可选旁路**：独立 Publish 服务更合适；勿污染文件 sync 表语义 |
| 账号计费 | 新配额字段（站点数 / 带宽 / 自定义域）；与 `vault_sync_*` 分列展示 |
| 运维 | 对象存储 + CDN、证书、垃圾站清理、滥用举报；内容合规 |

### 主要风险与验收标准

**风险：** 被误解为「社区也能发站」；发布内容与本地 Vault / Sync 副本不一致引发「改了库网站没变」客诉；公开站泄露未 scrub 的私密路径/附件；运维成本高于同步本身。

**验收（最小完整）：**

1. 官方通道可发布至少一篇笔记并得到可访问 HTTPS URL；下线后 404/410。  
2. 社区插件申请 `publish:*` 或 catalog 带 `publishing` 仍拒装/拒载。  
3. 发布失败不改本地 Vault 文件；取消发布不删本地正文。  
4. 帮助文案区分「官方 Publish」与「Vault Sync」与「整库 zip 备份」。

### 粗粒度工作量与建议排期

- **工作量：L**（产品 + 托管后端 + CDN/运维 + 计费文案）  
- **建议排期：** M2 稳定且双产品文案落地之后的 **M4 增值轨**；不阻塞同步硬化。若短期只需「分享只读链接」，可先做 **S/M 的官方单页分享**，再演进完整站点托管。  
- **优先级提示：** 差异化与变现强，但对核心「本地库 + Sync」非阻塞；适合作为明确付费卖点单独排期。

---

## 延期 2. OSS 直传（附件 / Sync 对象存储）

### 是什么（用户能感知到什么）

大附件（图、PDF、音视频）同步时，客户端**直接上传/下载对象存储**，不再把整文件 base64 塞进 API 与数据库；同步更快、更稳，配额按真实对象体积计费更准。用户侧主要感到：大文件不再卡、少失败，超限提示仍清晰。

### 现状（代码里已有 stub / 缺口）

| 已有 | 缺口 |
|---|---|
| 内容寻址 `vault_file_blob`（`content_hash` + DB `byte[]`） | 无 `uploadToken` / presign / OSS 客户端 |
| `PUT/GET …/files` 支持 `body`（文本）与 `base64Body`（附件） | 大文件经 API 网关，扩展性差 |
| 附件分类、默认 25MB 超限跳过角标；重试队列 | 设计写明「Phase 5 可改 OSS 直传」——**未做** |

关键注释：`v5notes-clients/v5notes-vault-client/src/sync/attachments.ts`（*OSS direct upload remains deferred*）；Phase 4/5 交接均列延期。

### 目标能力边界

**做：**

- `POST …/upload-token`（或等价）：校验配额/大小/path → 短时签名 URL  
- 客户端直传 OSS/S3；完成后用 `contentHash` + 元数据 **commit** 进 `vault_file` / `vault_change`  
- 小 Markdown 可继续走 DB 或同样走对象存储（实现择一，协议统一用 hash）  
- 下载：presigned GET 或经 API 302；完整性仍用 `sha256` 校验  
- 与现有增量 Sync、冲突副本、§6.4 过滤兼容

**明确不做：**

- 整库 zip 上传到 OSS 当日常 Sync  
- 第三方插件拿到裸 OSS 凭证或任意写桶权限  
- 绕过 `baseRev`/配额的「直接覆盖对象」

### 关键依赖

| 层 | 依赖 |
|---|---|
| 客户端 | SyncEngine 上传路径改造；进度/失败重试与现有 `retryQueue` 对齐 |
| note-vault-sync | uploadToken 签发、commit、GC 未引用对象；表字段指向 object key |
| 账号计费 | `vault_sync` 容量统计改为对象存储用量（含去重策略是否计入） |
| 运维 | 桶策略、CORS（桌面 Tauri 场景）、密钥轮换、生命周期规则 |

仓库已有 `note-base-file` S3 能力可参考，但 **Vault 语义须独立**，勿并入 Cloud `/client/notes` 附件模型。

### 主要风险与验收标准

**风险：** 只传对象未 commit → 幽灵占用；commit 成功对象丢失 → 同步坏库；CORS/签名时钟漂移；去重与计费口径纠纷；迁移存量 DB blob 的窗口期。

**验收：**

1. ≥ 数 MB 附件：直传成功，他端 pull 字节一致且 hash 匹配。  
2. 超额 / 超单文件：token 拒发或 commit 拒；本地编辑不阻断。  
3. 断网：入重试队列，恢复后可完成 commit。  
4. 存量小 blob 可读；迁移策略有文档（双读或一次性搬迁）。

### 粗粒度工作量与建议排期

- **工作量：M**（协议 + 后端签发 + 客户端路径 + 存量迁移脚本；运维配桶另计）  
- **建议排期：** **M2 硬化后续第一优先工程项**（Phase 5 原计划 `PR-5c` 未完成部分）。不依赖 Publish / 插件。  
- **优先级提示：** 同步可扩展性的基础设施；附件一多就会被迫做。建议高于站点托管与迁移向导。

---

## 延期 3. 完整版本历史（beyond stub）

### 是什么（用户能感知到什么）

对某个已同步文件，用户可查看**历史版本列表**（时间、设备/大小摘要），预览并**还原**到某一版；还原后按增量 Sync 传播到其他设备。套餐可限制「保留天数 / 版本数」。

### 现状（代码里已有 stub / 缺口）

| 已有 | 缺口 |
|---|---|
| `GET /vault/v1/vaults/{id}/files/versions?path=` | **恒返回 `[]`**（仅 path 校验） |
| `VaultFileVersionVo` 形状；客户端 `listFileVersions`；设置页「接口已预留」文案 | 无版本落库、无按 rev 快照、无还原 UI |
| 同步只保留当前 `contentHash` 去重 blob | `GET …/content?rev=` 未形成产品级历史 |

Phase 5 交接：*完整版本历史落库与还原 UI*。计费表已预留「版本历史保留天数」能力行，但未兑现。

### 目标能力边界

**做：**

- 每次成功 PUT（内容变更）归档一版（或按策略采样）；绑定 `fileId` + `rev`  
- rename **保留 fileId** → 历史跟文件走（与设计 §8.2 一致）  
- 列表 + 单版下载/预览 + 「还原为当前」（本地写盘 → dirty → 再 sync；或服务端生成新 rev）  
- 套餐：保留窗口（如 30/90 天）与条数上限；GC 可配

**明确不做：**

- 用整库 zip 快照冒充按文件版本（贵且违背增量模型）  
- 把 delete+create 同 path 自动合并进旧 `fileId` 历史（设计：同身份键重建 = **新 fileId**）  
- 首期 OT/CRDT 实时协同历史  
- 第三方插件读取任意用户云端历史 API（若开放只读，须另议权限；默认不进社区插件）

### 关键依赖

| 层 | 依赖 |
|---|---|
| 客户端 | 版本面板（笔记菜单/设置）；还原前脏文档守卫；冲突副本场景文案 |
| note-vault-sync | 版本表或对象多版本；与 OSS 直传强相关（历史对象存桶） |
| 账号计费 | `vault_sync` 套餐「历史保留」字段真正执法 |
| 运维 | 存储增长、GC 任务、合规删除 |

### 主要风险与验收标准

**风险：** 存储成本陡增；只存 meta 不存 blob → 还原失败；还原与本地 dirty/冲突副本纠缠；tombstone 后新 fileId 用户以为「历史丢了」。

**验收：**

1. 同一文件改两次 → versions ≥ 2；可取旧 rev 内容。  
2. rename 后仍能按同一 `fileId` 看到改名前内容。  
3. 还原不静默覆盖未保存本地编辑（对齐脏守卫 / 冲突副本精神）。  
4. 超保留窗口 GC 后列表不再出现；配额文案可读。

### 粗粒度工作量与建议排期

- **工作量：M～L**（无 OSS 时 M 偏难；有对象存储后更自然，偏 M；含计费执法与 UI 则近 L）  
- **建议排期：** **紧接或并行于 OSS 直传**；作为 Vault 同步套餐卖点。可先做「仅 Markdown 文本历史（DB）」的 M 切片，附件历史跟 OSS。  
- **优先级提示：** 用户可感知的同步增值；依赖存储策略，不宜早于直传设计拍板。

---

## 延期 4. 加密备份

> **拆开两件不同的事：**（A）**本机备份 zip 加密**；（B）**Sync 端到端加密（E2E）**。设计与交接里常被一并提起，决策必须分开勾选。

### 是什么（用户能感知到什么）

- **A. 加密备份：** 「导出整库 zip」时设置密码；zip 落盘为密文；迁机/归档时需密码解开。仍明确 **备份 ≠ Sync**。  
- **B. Sync E2E（设计 §9.6 二期）：** 上传云端的是密文 blob，服务端不可读正文；换设备靠用户密钥/口令恢复。云端全文搜索不可用或仅限本地。

### 现状（代码里已有 stub / 缺口）

| 已有 | 缺口 |
|---|---|
| 整库 zip（store 格式、无压缩密码）；排除 trash / sync-state / index / tmp | **无 zip 密码/AES**；无增量备份 |
| 文案「备份 ≠ Sync」；设置页导出可用（开库后） | Sync E2E：**Phase 4/5 明确不做**；一期仍为 HTTPS + 服务端可读 |
| 登录态 `encryptLogin`（传输层） | **与库备份/E2E 无关**，勿当成已交付 |

Phase 8 延期：*备份 zip 加密、增量备份*。

### 目标能力边界

**做（建议优先 A）：**

- 导出时可选密码（Argon2/PBKDF2 + AES-GCM 或标准加密 zip）；密码不落盘、不进 Sync  
- 导入/解压向导校验密码；失败不部分写坏库  
- 可选：仅加密「用户笔记+附件」，元数据策略写清  

**做（B，独立立项）：**

- 客户端加密 blob 后再走 Sync/OSS；密钥由用户口令派生或密钥链保管  
- 服务端只存密文 + 必要信封元数据；冲突/版本仍按 hash/rev，但内容不可服务端渲染  

**明确不做：**

- 用加密 zip **替换**日常增量 Sync  
- 把备份密码当账号密码存服务器  
- 在未做密钥恢复设计前宣称「E2E 且永不丢数据」  
- 第三方插件接触明文备份口令或 Sync 主密钥

### 关键依赖

| 层 | A 加密 zip | B Sync E2E |
|---|---|---|
| 客户端 | 备份模块加密码 UX | SyncEngine + 密钥管理 + 设备解锁 |
| note-vault-sync | 无（纯本地） | 协议与存储均改；服务端搜索放弃 |
| 账号计费 | 可作 Vault 套餐附加 | 常为高阶 SKU |
| 运维 | 无 | 密钥丢失客服政策、合规说明 |

### 主要风险与验收标准

**风险（A）：** 密码遗忘无法恢复；错误实现假加密；大库加密耗时无进度。  
**风险（B）：** 密钥丢失即云端数据不可用；多设备密钥同步；与「服务端可读以便合规」冲突；和版本历史/Publish（服务端渲染）互斥或强约束。

**验收（A）：** 有密码 zip 无法无密码解开；错误密码不破坏源库；帮助写明无法代找回。  
**验收（B）：** 服务端 DB/OSS 抽样不可读明文；两设备用同一口令可同步；口令错误无法 bind 出明文。

### 粗粒度工作量与建议排期

| 子项 | 工作量 | 建议排期 |
|---|---|---|
| A 加密 zip | **S～M** | Phase 8 收尾后随时可插；不挡 M2 |
| B Sync E2E | **L** | **M2 之后很久**；与 OSS、版本历史、官方 Publish（需服务端读库）一并做产品取舍 |

- **优先级提示：** 若只为「迁机安心」，做 **A** 即可；**B** 是安全叙事级投入，勿与 A 打包估期。

---

## 延期 5. 自动化迁移（Cloud ↔ Vault / 库迁移）

### 是什么（用户能感知到什么）

用户在**明确确认**后，运行官方向导：把 Cloud 笔记树导入成本地 Vault 文件夹（或反向把 Vault 笔记导入 Cloud 目录树），带进度、失败重试与结果报告。默认仍是两套空间；迁移是一次性/可重复的**显式工具**，不是后台静默双向同步。

### 现状（代码里已有 stub / 缺口）

| 已有 | 缺口 |
|---|---|
| 确认对话框 + 手工步骤文案（Cloud 导出 MD 后手动放入 Vault；Vault zip 解压后经 Cloud 导入/粘贴） | **无**自动读写 `/client/notes*` ↔ 本地 Vault 的导入器 |
| 「不会自动合并两个空间」单测与文案 | 无批量映射、无冲突策略 UI、无迁移报告 |
| `cloudVaultId` = Vault **Sync 绑定**，不是 Cloud 笔记导入 | 无专用迁移 API |

Phase 8：*自动化导入工具（本 PR 仅显式说明）*；下一步曾写「迁移向导」。

### 目标能力边界

**做（若立项）：**

- **Cloud → Vault：** 登录后拉 `/client/notes*`（及附件），在用户选定的本地库生成目录与 `.md`；ID→path 映射表可重建或写入报告；完成后**不**自动开启与 Cloud 的持续双写  
- **Vault → Cloud：** 扫本地库，经 Cloud API 创建笔记/目录；大库分批；失败可续跑  
- 重名/已存在：显式策略（跳过 / 冲突副本 / 覆盖——**默认禁止静默覆盖**）  
- 可选：Vault ↔ Vault（换机）继续以「备份 zip / Sync pull」为主，不叫「Cloud 迁移」

**明确不做：**

- Cloud 与 Vault **自动持续互通**或后台合并  
- 用迁移工具当 Sync（整库覆盖云端权威）  
- 把 Cloud 雪花 ID 模型与 Vault 路径模型合成一套 CRUD  
- 第三方插件触发整库迁出到外部 CMS（仍属 publish 禁区）

### 关键依赖

| 层 | 依赖 |
|---|---|
| 客户端 | 双端都要有入口（或仅 Vault 内向导调 Cloud API）；强确认 UI；进度与回滚说明 |
| note-vault-sync | 通常**不**承担 Cloud CRUD；最多协助「迁移后引导 bind Sync」 |
| note-notes（Cloud API） | 导出/批量创建是否够用；附件与目录语义 |
| 账号计费 | 两空间配额分别校验；迁移中超额要可读失败 |
| 运维 | 大账号限流；审计日志（谁在何时迁了多少） |

### 主要风险与验收标准

**风险：** 用户以为「两个 App 从此是一份笔记」；静默覆盖丢数据；附件与内部链接断裂；雪花 ID 精度（必须字符串）踩坑；迁移中途崩溃留下半套树。

**验收：**

1. 向导文案强制确认「不会自动合并 / 不是 Sync」。  
2. 样例账号 Cloud → Vault 后本地可打开且链接/附件可达率达约定阈值；反向同理。  
3. 取消或失败：不删除源空间数据；目标侧无「半静默成功」。  
4. 同名冲突走显式策略，默认不覆盖。

### 粗粒度工作量与建议排期

- **工作量：M**（单向向导）；**L**（双向 + 附件健壮 + 续跑 + 报告）  
- **建议排期：** **双产品均有真实用户之后的 M4**；至少 Cloud 与 Vault 本地/同步主路径稳定。可先做 **Cloud → Vault 单向（M）**，因 Vault「文件夹真相」更利于落盘。  
- **优先级提示：** 降低双产品心智成本；不做则继续靠手工说明。**切勿**为赶工做成静默同步。

---

## 延期 · 决策一览

| # | 能力 | 现状层级 | 工作量 | 建议相对顺序 | 是否挡核心 Sync |
|---|---|---|---|---|---|
| 2 | OSS 直传 | 工程债（DB blob） | M | **1（M2 后优先）** | 否，但挡规模化 |
| 3 | 完整版本历史 | API 空 stub | M～L | **2（随 OSS/计费）** | 否 |
| 4A | 加密备份 zip | 明文 zip 已可用 | S～M | **可随时插队** | 否 |
| 5 | 自动化迁移 | 文案步骤 only | M～L | **3（有双端用户再做）** | 否 |
| 1 | 完整站点托管 | 本机 draft stub | L | **4（独立增值轨）** | 否 |
| 4B | Sync E2E | 明确未做 | L | **另立项；与 Publish/搜索取舍** | 否 |

**拍板时请各选一行：** `暂缓` / `立项-目标版本` / `降级为更小切片（注明）`。

---

## 延期 · 文档与代码索引

| 材料 | 路径 |
|---|---|
| 设计、插件、工程拍板、本延期清单 | 本文 |
| 验收报告 | `docs/vault-acceptance-report.md` |
| Phase 4/5/8 交接 | `internal/phase4-vault-sync-handoff.md` 等 |
|  stub 审计（内部） | `internal/deferred-vault-features-audit.md` |
| Publish stub | `v5notes-clients/v5notes-vault-client/src/publish/` |
| 备份/迁移文案 | `v5notes-clients/v5notes-vault-client/src/backup/` |
| 附件/Sync | `v5notes-clients/v5notes-vault-client/src/sync/` |
| 版本 stub API | `note-vault-sync` → `VaultFileController#versions` |
