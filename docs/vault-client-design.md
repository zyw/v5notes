# v5notes 双客户端设计实现文档

**产品定位：** 同时保留「纯云端笔记客户端」与「本地 Vault 优先、可选云同步」两类产品；后端 API 分两套；套餐与账号体系可共用。

**参考：** Obsidian Vault（用户自选文件夹）+ Obsidian Sync（加密增量同步，非整库 zip 上传）+ Obsidian Plugin（清单与生命周期）。

**插件：** 详见 [Vault 客户端插件系统](vault-client-plugin-design.md)（仅 `v5notes-vault-client`）。

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
- 第三方插件发布站点 / CMS 发文能力（发布若需要，仅官方产品通道；见[插件设计](vault-client-plugin-design.md)）
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
| **MVP（可选）** | 「首次绑定：扫描上传」+ 之后仍走增量接口（避免养成整库替换习惯） |
| **正式版** | **文件级增量同步**（path 为键，content hash + rev） |
| **不做** | 每次同步 zip 整库覆盖（只可作「灾难恢复导出」，不作日常 Sync） |

---

## 6. Vault Client：本地领域模型

### 6.1 库内布局（建议）

```
MyVault/                          # 用户自选根
  .v5notes/
    vault.json                    # 见 §6.4
    appearance.json               # 当前主题（见插件设计）
    syncignore                    # 不同步路径规则（见 §6.5）
    index.sqlite                  # 可选：搜索索引（可重建）
    sync-state.json               # 见 §6.4；亦可并入 sqlite
    trash/                        # 本地回收（可选，默认同步忽略）
    plugins/                      # 见插件设计
    themes/
  工作/
    周报.md
    项目A/
      需求.md
  附件/
    xxx.png
```

**笔记真相：** 文件系统中的 `.md`（及附件）。  
**索引/同步状态：** `.v5notes/` 元数据可重建；丢了最多全量重扫，不应丢正文。  
**插件：** 启用意图与 `data.json` 可随库同步；插件代码默认各端自装（详见插件设计 §3.3）。

### 6.2 本地 ID 与路径规范

- **稳定键：** Vault 相对路径，如 `工作/周报.md`。
- **规范化（全端必须一致，否则 Sync 会双份）：**
  - Unicode：**NFC**；分隔符统一 `/`；去掉首尾 `/`；禁止 `..` 段。
  - 空段、`.` 段拒绝；Windows 保留名（`CON` 等）创建时拦截。
  - **大小写：** 云端 path 大小写敏感；本地若在大小写不敏感卷上，打开库时检测冲突 path 并提示用户改名，禁止静默合并。
- **云端键：** `fileId`（雪花**字符串**）写入 `sync-state`，用户不可见。
- 重命名 = 本地 path 变更 + 同步层显式 `rename`（优先于 delete+create，保历史）。

### 6.3 客户端模块（深模块切分）

| 模块 | 接口职责（小） | 实现内藏 |
|---|---|---|
| `VaultWorkspace` | open/create/switch vault | 权限、书签、最近库列表 |
| `VaultFs` | listTree / read / write / mkdir / rename / delete | 平台 fs、原子写、回收站 |
| `VaultSearch` | search(query) → hits | sqlite FTS / 扫描缓存 |
| `VaultEditorBridge` | openPath / save | 与 V5Editor 对接、脏检查 |
| `PluginHost` / `ThemeHost` | load/unload、权限代理、Safe Mode、主题切换 | 见[插件设计](vault-client-plugin-design.md) |
| `SyncEngine` | login / bind / pushPull / status | 队列、冲突、重试、配额错误 |
| `AccountClient` | 登录、套餐、支付入口 | 可与 Cloud 共用 SDK |

UI（侧栏树、搜索、设置）只依赖上述接口，不直接打 Sync HTTP；插件只经 `PluginHost` 注入的 `@v5notes/vault-plugin-api` 访问能力。

### 6.4 关键配置 schema

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

- `localVaultId`：本机生成，不随文件夹拷贝冲突时由「打开已有库」复用文件内值。
- `binding`：未登录或未绑定时 `cloudVaultId` 为 `null`；绑定后写入，**一本地库 ↔ 一云端库**（首期不做一对多）。

**`sync-state.json`（示意；大库可迁 sqlite）：**

```json
{
  "schemaVersion": 1,
  "files": {
    "工作/周报.md": {
      "fileId": "1938...",
      "localHash": "sha256:...",
      "remoteRev": 12,
      "status": "clean",
      "size": 1024,
      "mtimeMs": 1731560000000
    }
  }
}
```

`status`：`clean` | `dirty` | `conflict` | `error`。

### 6.5 同步范围与 `.v5notes/syncignore`

**默认同步：**

- 用户可见的 `.md`、常见附件（图/音视频/PDF 等，受单文件大小上限约束）。
- `.v5notes/appearance.json`、`plugins/community-plugins.json`、`plugins/*/data.json`、`themes/community-themes.json`（意图与设置）。

**默认忽略：**

- `.v5notes/index.sqlite`、`sync-state.json`、`trash/**`
- `plugins/*/main.js`、`themes/*/theme.css` 等**代码/主题二进制**（各端自装）
- `.git/**`、`.DS_Store`、`Thumbs.db`、编辑器临时文件 `*~`、`.*.swp`

用户可在 `.v5notes/syncignore` 追加 gitignore 风格规则。SyncEngine 在扫盘与 push 前应用；忽略文件不进 manifest。

### 6.6 首次启动与多库 UX

1. **欢迎页三选一：** 创建新库（选父目录 + 库名）/ 打开已有库 / 使用应用内默认库。  
2. 创建时写入 `.v5notes/` 骨架 + 可选「快速开始」示例笔记。  
3. **最近库列表**存应用数据（非库内）；打开失败（权限/移盘）给出「重新授权 / 从列表移除」。  
4. 切换库：先脏检查当前库 → 卸载 PluginHost → 切换根 → 再加载。  
5. 文案警告：勿将库放在网盘同步目录后再开官方 Sync。

---

## 7. Cloud Client：保持现架构

- 继续：`登录 → token → /client/notes` + `/client/notes/dir` + search。
- **不**引入 Vault 文件夹；本地最多以后加「离线缓存」（另一项目）。
- 套餐：限制笔记数、存储、协作等（现有或扩展 `client.account.*`）。

与 Vault 的差异要写进产品文案，避免用户以为「两个 App 是同一份笔记」。

---

## 8. 后端：两套 API

### 8.1 Cloud Notes API（现有，保留）

前缀示例：`/client/notes`、`/client/notes/dir`、`/client/notes/search`、trash、account…

语义：**服务端权威**；ID 为雪花字符串；目录树在 DB。

### 8.2 Vault Sync API（新建）

独立 Maven 模块：`note-modules/note-vault-sync`；API 前缀：`/vault/v1/...`（同进程挂载即可，勿并入 `note-notes` 的云端 CRUD 语义）。

#### 核心资源

- **Vault（云端库）：** 用户可有 1..N 个同步库（套餐限 N 与容量）。
- **File：** 库内相对 path + 类型（`note` / `asset` / `config`）。
- **Revision：** 每文件单调 `rev`（int64）+ 库级 `cursor`（opaque 字符串，用于 manifest 增量）。

#### 表结构草稿（元数据）

| 表 | 要点 |
|---|---|
| `vault_space` | `id`（雪花字符串）、`user_id`、`name`、`created_at` |
| `vault_device` | `id`、`vault_id`、`device_id`、`client_info`、`last_seen_at` |
| `vault_file` | `id`、`vault_id`、`path`、`type`、`content_hash`、`size`、`rev`、`deleted`（墓碑）、`updated_at` |
| `vault_file_blob` | `content_hash`、`storage_key`、`size`（内容寻址去重） |
| `vault_change` | `vault_id`、`cursor`、`file_id`、`op`（upsert/delete/rename）、`path`、`from_path`、payload 摘要 |

ID 一律 **字符串**传递（与 AGENTS 雪花 ID 约定一致）。  
索引：`(vault_id, path)` 唯一（含墓碑策略：活跃 path 唯一）；`(vault_id, cursor)` 供 manifest。

#### 推荐接口（增量）

```
POST   /vault/v1/vaults                 # 创建云端库，返回 vaultId
GET    /vault/v1/vaults                 # 列表
POST   /vault/v1/vaults/{id}/bind       # 设备绑定（deviceId, clientInfo）
DELETE /vault/v1/vaults/{id}/devices/{deviceId}

GET    /vault/v1/vaults/{id}/manifest?since=CURSOR
PUT    /vault/v1/vaults/{id}/files      # path, baseRev, hash, body|uploadToken
POST   /vault/v1/vaults/{id}/files/batch
DELETE /vault/v1/vaults/{id}/files      # path + baseRev
POST   /vault/v1/vaults/{id}/renames    # from, to, baseRev
GET    /vault/v1/vaults/{id}/files/content?path=&rev=
GET    /vault/v1/quota
```

**manifest 响应示意：**

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
    { "op": "delete", "path": "旧笔记.md", "remoteRev": 3 },
    { "op": "rename", "from": "a.md", "to": "b.md", "remoteRev": 4 }
  ]
}
```

认证：与现网同一 Sa-Token；新建 `sys_client`：`deviceType=vault_client`，`grant_type` 含密码/社交（与笔记客户端策略对齐）。  
**不要**复用 `/client/notes` 行模型当 Vault 权威。

#### 错误码空间（HTTP + 业务码）

| HTTP | 业务码（示意） | 含义 |
|---|---|---|
| 401 | `auth.unauthorized` | 未登录/过期 |
| 402/403 | `vault.quota.exceeded` | 容量或设备数超额 |
| 404 | `vault.not.found` / `vault.file.not.found` | |
| 409 | `vault.conflict.rev` | `baseRev` 不匹配；body 带服务端 path/rev/hash |
| 413 | `vault.file.too.large` | 超单文件上限 |
| 429 | `vault.rate.limited` | |
| 400 | `vault.path.invalid` | 路径规范化失败 |

客户端须按码分支 UI（冲突副本 / 引导扩容 / 重新登录），勿只 toast 原始英文。

#### 存储

- 元数据：DB（上表）。
- 正文/附件：对象存储（S3/OSS）；小 Markdown 可先存 DB，附件必须对象存储。
- `contentHash`（sha256）去重与完整性校验；上传可先申请 `uploadToken` 直传 OSS（Phase 5 优化）。

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
| 同步设备数 | — | ✓ |
| 版本历史保留天数 | 可选 | ✓ |
| 第三方登录 | ✓ | ✓（仅账号） |

### 8.4 Vault Client 社交登录回调

与 Cloud Client **分应用标识**，避免 deep link 抢夺：

| | Cloud（client2） | Vault Client |
|---|---|---|
| Deep link | `v5notes://app/social-callback` | `v5notes-vault://app/social-callback` |
| `justauth` 基址 | `justauth.client-address` | 新增 `justauth.vault-client-address`（或同字段分环境） |
| OAuth 应用回调 | 登记 Cloud 回调 | **另登记** Vault 回调（Gitee 等常限单回调 → 常需独立 OAuth 应用或中转页） |

落地页可复用 `v5notes-oauth-landing/` 模式，按 `source`/`app=vault` 唤起对应 scheme。中转页与权限模型见现有社交登录部署说明；**发布类插件仍不开放**。

---

## 9. SyncEngine 详细流程

### 9.1 状态机（每文件）

`clean` → 本地编辑 → `dirty` → push 成功 → `clean`  
pull 发现新 rev → 若 local dirty → `conflict` → 用户处理 → `clean`

### 9.2 一次同步循环

1. 应用 `syncignore`；读本地 `sync-state` + 扫盘（或 watcher 队列）。
2. `GET manifest?since=cursor`（首次 `since` 空 = 全量变更或分页拉齐）。
3. **合并策略（默认）：**
   - 仅远端变：下载覆盖本地（若 local `clean`）。
   - 仅本地 `dirty`：upload（带 `baseRev` = 本地已知 `remoteRev`）。
   - 两边都变：冲突（见下）。
4. 成功则更新 cursor 与 per-file 状态；失败入重试队列（指数退避，上限通知用户）。

**绑定首次：** 创建/选择云端 `vaultId` → `bind` device → 扫描上传（仍走增量 PUT，不做 zip 整库替换）。

### 9.3 冲突（建议默认，贴近 Obsidian 可理解性）

- 自动生成：保留本地继续编辑；远端内容写入  
  `原名 (冲突 YYYY-MM-DD HH-mm).md`（本地化文件名由 i18n 模板生成）。
- 状态标 `conflict`；UI 提供对比；**禁止**默默覆盖。
- 用户选定后：胜出版本 push，冲突副本可删或留作笔记；清 `conflict`。
- 可选高级：3-way merge（Phase 8+）。

### 9.4 删除与回收

- 本地删除 → 进 `.v5notes/trash`（可恢复）→ 同步 tombstone；他端拉到后删工作区文件（可按其本地 trash 策略）。
- 本地 trash 默认 **不同步**（避免回收站风暴）；保留 30 天可配。

### 9.5 附件

- Markdown 内相对链接优先：`附件/xxx.png`。
- 单文件上限（示意 25–100MB，套餐可抬）；超限不同步并角标提示。
- Phase 4 可先内联/小附件走同 PUT；Phase 5 改为直传 OSS。

### 9.6 加密（分期）

- **一期：** HTTPS + 服务端可读（便于运维与合规简单）。
- **二期（对标 Obsidian E2E）：** 客户端加密 blob，服务器只存密文；云端无法代搜正文。

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

- Vault Client：目录 ACL、路径穿越禁止（`..`）、符号链接策略（默认不跟随出库）。
- Sync：所有 path 规范化后校验；单文件大小上限；速率限制。
- 套餐超额：push 返回 `402/403` + 可读错误码；客户端只读拉仍可允许（产品定）。
- Secret：仅 Account/Sync token；Vault 本地无长期密码存储（与现网一致）。

---

## 13. 实施路线图

原则：**先本地可用 → 再可选账号/同步 → 再扩展（插件/主题）→ 最后分发与官方增值**。  
插件子阶段与 [插件设计 §12](vault-client-plugin-design.md#12-实施路线) 对齐；**以本节为总排期**，插件文档只展开 API 细则。

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

- [ ] 命名与边界已冻结（本文「命名冻结」+ 插件/主题/发布政策）  
- [ ] 仓库：`v5notes-vault-client/`（Tauri + Vue）；bundle id / deep link `v5notes-vault://` 与 cloud 区分（§8.4）  
- [ ] 可选 monorepo：`packages/editor`、`account-sdk`、`ui-tokens` 接线方式定稿  
- [ ] 套餐字段方案：`cloud_*` / `vault_sync_*` 分列（实现可晚于 Phase 3，方案先定）  
- [ ] `sys_client`：`vault_client` 占位与 grant_type 方案  
- [ ] 明确：Cloud 与 Vault **数据默认不通**；迁移靠显式工具（后置）  

### Phase 1 — 本地 Vault MVP（免登录）

**交付：** 打开 App 即可建库写笔记，零网络。

- [ ] 欢迎页三选一（§6.6）：创建 / 打开 / 应用内默认库  
- [ ] `.v5notes/vault.json`（§6.4）+ 默认 `syncignore`（§6.5）；笔记真相为库内 `.md`  
- [ ] 路径规范化与非法名拦截（§6.2）  
- [ ] 侧栏树：展开折叠、新建目录/笔记、重命名、删除（本地）  
- [ ] `VaultFs` + `VaultEditorBridge` + V5Editor（预览/编辑切换保留实例）  
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
- [ ] `deviceType` / clientId：`vault_client`（与 cloud client 区分）  

### Phase 4 — `note-vault-sync` + SyncEngine（首版同步）

**交付：** 登录后可按文件增量同步；冲突可见。

**后端（模块 `note-vault-sync`，前缀 `/vault/v1`）：**

- [ ] 表：`vault_space` / `vault_file` / `vault_change` / `vault_device`（§8.2）  
- [ ] Vault 创建/列表、设备绑定  
- [ ] `manifest?since=`、单文件 up/down、tombstone、rename  
- [ ] `baseRev` 冲突 → `409 vault.conflict.rev`；配额查询与错误码表  

**客户端：**

- [ ] `SyncEngine`：`syncignore` + dirty 扫描、push/pull、cursor（§9）  
- [ ] 冲突默认生成冲突副本（禁止静默覆盖）  
- [ ] 同步状态 UI（进行中/失败/配额不足，按业务码分支）  
- [ ] 意图文件默认同步、代码/主题二进制默认忽略（§6.5 + 插件设计）  

### Phase 5 — 同步硬化与附件

**交付：** 多设备可日常用。

- [ ] 后台/空闲同步、重试队列、断网恢复  
- [ ] 设备管理（列表、踢设备）  
- [ ] 附件与体积上限；版本历史（按需）  
- [ ] 配额与套餐文案与 Cloud 产品区分清楚  
- [ ] （可选后置）E2E 加密  

### Phase 6 — 插件宿主 + 一等主题（扩展平台地基）

**交付：** 可加载官方/本地功能插件；主题可切换。细则见[插件设计](vault-client-plugin-design.md)。

- [ ] 包：`@v5notes/vault-plugin-api`（含 `ThemeApi`）  
- [ ] `PluginHost`：`manifest` + `onload`/`onunload`；权限代理；Safe Mode  
- [ ] P1 能力：`addCommand`、`loadData`/`saveData`、启用 UI；`vault:read/write`、`ui:commands`  
- [ ] **Theme API（P1b）**：`.v5notes/themes`、`appearance.json`、`theme.css` 校验与回退、设置「外观」  
- [ ] 官方核心插件起步：日记、模板（吃自己的狗粮）  
- [ ] **不**做第三方发布 API；**不**开放无限制 `network`  

### Phase 7 — 插件扩展、安全网络与目录

**交付：** 社区可装功能插件与主题；联网仅安全白名单。

- [ ] SettingTab、Ribbon/Status、`registerView`、Markdown post processor  
- [ ] `registerEditorExtension`（V5Editor 扩展点）、`MetadataCache` 基础  
- [ ] `network:safe` + `networkAllowlist`（禁止静默全库外传、禁止发布管线）  
- [ ] 本地「从文件夹安装」插件/主题  
- [ ] Catalog（`kind=plugin|theme`）；审核/标签拒绝 publishing；签名校验（官方源）  
- [ ] 更多核心插件：反向链接等  
- [ ] 启用意图与外观意图随库同步（二进制仍各端自装）  

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

- **本地：** 奇异文件名、NFC/大小写冲突、移动库路径、权限撤销、崩溃原子写、欢迎页三路径。  
- **同步：** `syncignore`、断网队列、baseRev 冲突副本、双端同时改、重命名环、删除再创建同 path、附件超限。  
- **配额 / 错误码：** 超容量、超设备；401/409/413 分支正确。  
- **隔离：** Cloud API 与 Vault API 互不影响；OAuth scheme 不串（§8.4）。  
- **插件：** 见[插件设计 §13](vault-client-plugin-design.md#13-测试要点)。  

---

## 15. 结论摘要

| 议题 | 结论 |
|---|---|
| 双客户端 | **采用**：`v5notes-client2` 云权威；`v5notes-vault-client` 本地权威 |
| 双 API | **采用**：`note-notes`（`/client/notes*`）vs `note-vault-sync`（`/vault/v1*`） |
| Vault 位置 | **桌面用户自选文件夹**；沙箱仅作新手默认库；一本地库绑一云端库 |
| 路径 | NFC + `/` 规范化；大小写冲突显式处理 |
| 同步 | **文件级增量** + `syncignore`；冲突副本；整库 zip 仅备份 |
| 插件 | **仅 Vault Client**；主题一等；`network:safe`；发布不对第三方开放 |
| 共享 | 编辑器与账号 SDK；不共享工作区状态机 |
| 数据 | 默认两空间不自动合并；迁移靠显式工具 |
