# v5notes-admin2 对 Vault 客户端（v5notes-vault-client）管理功能设计文档

- **状态**：草案 v1（待评审）
- **范围**：`v5notes-admin2`（管理端前端）+ `v5notes2/note-modules/note-vault-sync`（管理端后端 API 与数据表）
- **关联文档**：[vault-client-design.md](./vault-client-design.md)、[vault-attachment-file-api-design.md](../v5notes-clients/docs/vault-attachment-file-api-design.md)、[AGENTS.md](../AGENTS.md)

---

## 1. 背景与设计原则

`v5notes-vault-client` 是本地优先的 Vault 桌面客户端，其后端同步模块 `note-vault-sync`（`/vault/v1/*`）已完成库管理、副本绑定、文件增量同步、附件对象存储与扩展目录等核心链路，但 `v5notes-admin2` 目前仅覆盖「云笔记（`v5notes-client2` / `note-notes`）」，缺少对 Vault 同步生态的运维、治理与配置能力。

管理端设计须严格遵守以下四条边界：

| 原则 | 说明 |
|---|---|
| **双产品隔离** | 管理端一级菜单中「Vault 同步」与现有「云笔记」并列，不混入云笔记目录树；后端管理接口统一前缀 `/vault/admin/*`，与客户端同步协议 `/vault/v1/*` 和云笔记 `/notes/*` 物理隔离。 |
| **尊重本地权威** | Vault 真相在用户本机文件夹，服务端仅为同步镜像。管理端**不提供在线编辑用户笔记正文**的能力；合规删除必须走同步协议墓碑（`deleted=1`、`rev+1`、追加 `vault_change`），避免破坏客户端 `manifest` 状态机。 |
| **安全与隐私最小化** | 查看非加密文本正文需独立细粒度权限 `vault:file:content` 并强制落操作日志（`@Log`）；扩展目录上架强制在服务端校验并拦截 `publishing` 标签与禁用权限（`publish:*`、`fs:arbitrary`、`shell`、`sync:control`、无限制 `network`）。 |
| **遵循前端设计规则** | 严格按 `AGENTS.md` 执行：不堆砌标语/副标题/常驻说明文字；用状态控件与层级抽屉表达结构；危险操作明确对象名与后果；所有雪花 ID（`vaultId`、`fileId`、`assetId`、`userId`）在前端一律按 `string` 处理。 |

---

## 2. 信息架构与菜单规划

在 `v5notes-admin2` 侧边栏新增一级目录菜单 **`Vault 同步`**（`path: 'vault'`，排在「云笔记」之后），下设 5 个页面：

```
Vault 同步 (/vault)
├── 同步概览 (/vault/overview)          # 指标、趋势、存储后端状态、用户占用 Top
├── 云端库管理 (/vault/spaces)          # 库列表 + 详情抽屉（副本 / 文件 / 附件 / 变更日志）
├── 副本管理 (/vault/replicas)          # 跨库副本全局检索与强制解绑
├── 配额与策略 (/vault/quota)           # 全局默认策略 + 用户级配额覆盖 + 维护任务
└── 扩展市场 (/vault/catalog)           # 官方插件与主题目录的上传、校验与上下架
```

> **交互组织**：不把「文件」「附件」「变更日志」拆成 3 个孤立的大表格平铺在左侧菜单，而是以**云端库**为核心入口，点击某库后在右侧抽屉通过 Tab 下钻查看（`副本` / `文件` / `附件` / `变更日志`），同时保留跨库高频运维入口「副本管理」。

---

## 3. 核心功能模块设计

### 3.1 同步概览（`/vault/overview`）

面向管理员快速掌握 Vault 同步全局运行态势，复用现有首页的图表/卡片体系：

- **核心指标卡**：
  - 云端库总数（含活跃库数）
  - 已绑定副本数 / 独立设备数（按 `vault_replica.device_id` 去重）
  - 活跃同步文件总数（按 `note` / `asset` / `config` 分项）
  - 同步存储总占用（文本正文估算 + 附件引用去重占用）
  - 超额用户数（当前已用 ≥ 配额）
- **同步活跃趋势**：支持 `7 / 30 / 90` 天切换，按 `vault_change.create_time` 统计每日 `upsert` / `delete` / `rename` 变更量。
- **附件存储后端状态条**：实时读取 `VaultAssetStorage.capability()`，显示当前 `purpose=VAULT_ASSET` 配置的后端类型（`s3` / `ftp` / `local` / `sftp` / `db`）、下载模式（`direct` / `proxy`）、单文件上限；并提供直达「基础服务 → 文件配置」的跳转按钮。
- **用户同步占用 Top N**：按用户聚合其名下所有 `vault_space.used_bytes`，支持点击跳转到「云端库管理」按该用户筛选。

---

### 3.2 云端库管理（`/vault/spaces`）

#### 3.2.1 列表页
- **筛选条件**：用户（账号/昵称关键字）、库名、状态（全部 / 正常 / 已超额 / 已删除）、创建时间范围。
- **表格列**：库 ID（字符串，可一键复制）、库名、所属用户（昵称 + 账号）、活跃文件数、已用空间（进度条呈现已用/配额，超额标红）、绑定副本数（`used / limit`）、最近同步时间、创建时间、操作（`详情`、`清理/删除`）。

#### 3.2.2 库详情抽屉（4 个 Tab）

| Tab | 展示内容 | 允许操作 |
|---|---|---|
| **绑定副本** | `replicaId`、`deviceId`、`clientInfo`、绑定时间、`lastSeenAt` | **强制解绑（踢除副本）**：需二次确认（展示副本名称与库名）；删除 `vault_replica` 行，记 `@Log`。 |
| **文件清单** | 路径（`path`）、类型（`note`/`asset`/`config`）、大小、`rev`、状态（活跃/墓碑）、更新时间；支持按路径关键字、类型、是否含墓碑筛选 | 1. **只读查看**：`note`/`config` 需 `vault:file:content` 权限方可拉取 `vault_file.content` 并在只读弹窗预览（若未来开启 E2E 加密则显示密文占位）；`asset` 展示 SHA-256、MIME、`storage_key`、`config_id`、后端类型，支持受控下载。<br>2. **协议级删除（下发墓碑）**：仅针对活跃文件；弹窗确认后按同步协议置 `deleted=1`、`rev+1`、清空 `content`、释放附件引用计数、扣减 `used_bytes` 并追加 `vault_change(delete)`，让客户端在下次 `pull` 时同步收敛。 |
| **附件引用** | `assetId`、`sha256`、`sizeBytes`、`mimeType`、`configId`、`backend`、`storageKey`、引用该对象的活跃文件数 | 只读排查与受控下载；便于核对切换 `VAULT_ASSET` 存储后端后历史附件的 `configId` 分布。 |
| **变更日志** | `cursor`（`vault_change.id`）、`op`（`upsert`/`delete`/`rename`）、`path`、`fromPath`、`fileId`、`remoteRev`、`sizeBytes`、时间；支持按 `op` 和路径关键字筛选 | 只读审计，辅助排查同步冲突、误删、改名链路问题。 |

#### 3.2.3 强制删除云端库
- 二次确认弹窗要求输入库名，明确提示后果：**“删除后将解除该库全部副本绑定、清理云端元数据并释放无引用的附件存储，不影响用户本机已有文件，但客户端将无法再向该库同步。”**
- 后端事务内软删 `vault_space`（`del_flag='2'`）、删除关联 `vault_replica`、标记活跃 `vault_file` 墓碑并按事务提交后回调释放归零的附件对象。

---

### 3.3 副本管理（`/vault/replicas`）

提供跨库的全局副本运维视图，便于排查某台异常设备或快速释放用户副本名额：
- **筛选条件**：用户关键字、库名 / `vaultId`、`deviceId`、`replicaId`、`clientInfo`、活跃状态（如 30 天未同步）。
- **表格列**：所属用户、所属云端库、`clientInfo`、`replicaId`、`deviceId`、绑定时间、最近同步时间、操作（`查看所属库`、`强制解绑`）。
- **批量解绑**：支持勾选多条过期副本批量解绑，操作前需确认数量与后果。

---

### 3.4 配额与策略（`/vault/quota`）

解决当前 `VaultQuotaRules` 全部写死常量（`1GB` / `3 副本` / `25MB`）的问题，采用**全局默认 + 用户级覆盖**两层模型，并与 Cloud 笔记配额完全独立：

#### 3.4.1 全局默认策略（Tab 1）
存入 `sys_config`（参数键统一前缀 `vault.sync.*`），由 `VaultQuotaService` 读取并带短缓存：

| 配置键 | 含义 | 默认值 | 约束 |
|---|---|---|---|
| `vault.sync.defaultQuotaBytes` | 默认单用户同步总容量 | `1073741824`（1 GB） | ≥ 10 MB |
| `vault.sync.defaultReplicaLimit` | 默认单库最大绑定副本数 | `3` | 1 ~ 50 |
| `vault.sync.defaultMaxFileBytes` | 默认单文件大小上限 | `26214400`（25 MB） | 不得超过服务端 `multipart` 上限，保存时后端校验并提示 |
| `vault.sync.tombstoneRetentionDays` | 墓碑记录保留天数（设计 §8.2） | `90` | ≥ 30 天 |
| `vault.sync.orphanAssetGraceDays` | 孤儿附件清理宽限天数（附件设计 §8.2） | `7` | ≥ 1 天 |

#### 3.4.2 用户级配额覆盖（Tab 2）
- 列表展示所有已配置自定义配额的用户（可按用户搜索、支持「新增覆盖」「编辑」「恢复默认」）。
- 字段：用户、`quotaBytes`（同步容量）、`replicaLimit`（单库副本上限）、`maxFileBytes`（单文件上限）、`expireTime`（为空表示长期有效；过期自动回落到全局默认）、`remark`。
- `VaultSyncServiceImpl` 与 `VaultAssetServiceImpl` 改造为通过 `IVaultQuotaService.resolveForUser(userId)` 获取生效配额，替代直接读取 `VaultQuotaRules` 静态常量。

#### 3.4.3 存储维护（Tab 3）
- 展示当前 `VAULT_ASSET` 存储配置摘要（复用 `VaultAssetStorage.capability()`）。
- **孤儿附件清理**：统计超过 `orphanAssetGraceDays` 且无 `vault_asset_ref` 引用的 `vault/*` 对象数量与体积，支持管理员点击「立即清理」（异步执行并返回清理结果，后续可接入 SnailJob 定时触发）。
- **过期墓碑清理**：统计超过 `tombstoneRetentionDays` 的已删 `vault_file` 数量，支持受控清理（保留最近游标完整性）。

---

### 3.5 扩展市场管理（`/vault/catalog`）

将当前硬编码在 `VaultCatalogService` 中的 2 条示例条目（`safe-fetch-demo`、`catalog-moss`）升级为**数据库驱动的官方扩展目录**，同时严格守住插件安全边界：

- **列表筛选**：类型（`plugin` / `theme`）、状态（草稿 `0` / 已上架 `1` / 已下架 `2`）、关键字（ID / 名称 / 作者）。
- **新增 / 编辑扩展**：
  - 支持两种方式：**上传标准扩展 `.zip` 包自动解析**（与客户端 `read_extension_zip` 同款平铺单段文件校验，防 Zip Slip、仅 UTF-8 文本、单文件 ≤ 1MB、总包 ≤ 4MB），或直接编辑表单与包内文件（`manifest.json`、`main.js` / `theme.css`、`theme.json`、`styles.css`）。
  - 展示解析出的元数据：`id`、`name`、`kind`、`version`、`minAppVersion`、`author`、`permissions`、`networkAllowlist`、`tags`、包内文件列表（只读代码预览）。
- **服务端强安全门禁（保存与上架均强制执行）**：
  1. 校验 `id` 格式 `[a-z0-9-]+`、`version` 为合法 semver、`manifest.json` 必填字段完整。
  2. **永久拒绝** `tags` 含 `publishing` / `publish` / `publisher`。
  3. **永久拒绝** `permissions` 含 `publish` / `publish:*` / `network` / `sync:control` / `fs:arbitrary` / `shell`。
  4. 若申请 `network:safe`，必须提供非空合法的 `networkAllowlist`。
  5. 若 `kind = theme`，仅允许 `ui:theme` 权限，且必须包含 `theme.css`（拒绝包含危险全局覆盖或越权 `main.js`）。
- **上下架控制**：点击开关切换上架/下架；仅「已上架」条目对外暴露在 `/vault/v1/catalog/plugins`。
- **存量兼容**：Flyway 初始化脚本将现有的 `safe-fetch-demo` 和 `catalog-moss` 作为初始种子数据写入数据库，保证客户端零感知平滑过渡。

---

## 4. 数据库表设计

新增 Flyway 迁移脚本（`mysql` 与 `postgresql` 双套同步维护）：

### 4.1 `V24__vault_admin_tables.sql`

#### 1) `vault_user_quota`（用户级同步配额覆盖）
```sql
CREATE TABLE IF NOT EXISTS vault_user_quota
(
    user_id       bigint(20)   NOT NULL COMMENT '所属用户 ID（主键）',
    quota_bytes   bigint(20)            DEFAULT NULL COMMENT '同步容量上限（字节，NULL 继承全局默认）',
    replica_limit int                   DEFAULT NULL COMMENT '单库副本数上限（NULL 继承全局默认）',
    max_file_bytes bigint(20)           DEFAULT NULL COMMENT '单文件上限（字节，NULL 继承全局默认）',
    plan_name     varchar(64)           DEFAULT NULL COMMENT '展示用套餐标识（如 vault-pro）',
    expire_time   datetime              DEFAULT NULL COMMENT '生效截止时间（NULL 长期有效）',
    remark        varchar(255)          DEFAULT NULL COMMENT '备注',
    create_by     bigint(20)            DEFAULT NULL,
    create_time   datetime              DEFAULT CURRENT_TIMESTAMP,
    update_by     bigint(20)            DEFAULT NULL,
    update_time   datetime              DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    KEY idx_vault_user_quota_expire (expire_time)
) ENGINE = InnoDB COMMENT = 'Vault 用户级同步配额覆盖';
```

#### 2) `vault_catalog_item`（扩展市场目录表）
```sql
CREATE TABLE IF NOT EXISTS vault_catalog_item
(
    id                varchar(64)  NOT NULL COMMENT '扩展稳定 ID（[a-z0-9-]+）',
    name              varchar(100) NOT NULL COMMENT '展示名称',
    kind              varchar(16)  NOT NULL COMMENT 'plugin / theme',
    version           varchar(32)  NOT NULL COMMENT 'semver 版本号',
    min_app_version   varchar(32)           DEFAULT '0.1.0' COMMENT '最低客户端版本',
    description       varchar(500)          DEFAULT NULL COMMENT '简介',
    author            varchar(100)          DEFAULT NULL COMMENT '作者',
    author_url        varchar(255)          DEFAULT NULL COMMENT '作者链接',
    permissions_json  text         NOT NULL COMMENT 'JSON 字符串数组',
    allowlist_json    text                  DEFAULT NULL COMMENT 'networkAllowlist JSON 数组',
    tags_json         text                  DEFAULT NULL COMMENT 'tags JSON 数组',
    files_json        longtext     NOT NULL COMMENT '包内平铺文件映射 JSON（文件名 -> UTF-8 文本）',
    status            char(1)      NOT NULL DEFAULT '0' COMMENT '0草稿 1已上架 2已下架',
    sort_order        int          NOT NULL DEFAULT 0 COMMENT '排序（升序）',
    create_by         bigint(20)            DEFAULT NULL,
    create_time       datetime              DEFAULT CURRENT_TIMESTAMP,
    update_by         bigint(20)            DEFAULT NULL,
    update_time       datetime              DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_vault_catalog_kind_status (kind, status, sort_order)
) ENGINE = InnoDB COMMENT = 'Vault 官方扩展与主题目录';
```

### 4.2 `common/V25__vault_admin_menus.sql`
- 幂等写入 `sys_menu` 与 `sys_role_menu`（默认授予超级管理员 `role_id = 1`），同时写入 `sys_config` 的 5 条 `vault.sync.*` 默认参数。

---

## 5. 后端 API 设计（`note-vault-sync`）

新建包 `xin.v5ai.vault.controller.admin`，所有接口统一前缀 `/vault/admin`，使用 `@SaCheckPermission` 鉴权，写操作统一加 `@Log` 与 `@RepeatSubmit`。

### 5.1 概览与统计（`VaultAdminOverviewController`）

| 方法与路径 | 权限点 | 说明 |
|---|---|---|
| `GET /vault/admin/overview?range=30` | `vault:overview:query` | 聚合指标卡 + `range` 天同步变更趋势 + 附件存储能力位 |
| `GET /vault/admin/overview/storage-top?limit=10` | `vault:overview:query` | 用户 Vault 同步空间占用排行 |

### 5.2 云端库、文件、附件与变更日志（`VaultAdminSpaceController`）

| 方法与路径 | 权限点 | 说明 |
|---|---|---|
| `GET /vault/admin/spaces/list` | `vault:space:list` | 分页查询云端库（含用户信息、文件数、副本数、容量占比、最近同步时间） |
| `GET /vault/admin/spaces/{vaultId}` | `vault:space:query` | 单库详情摘要 |
| `DELETE /vault/admin/spaces/{vaultId}` | `vault:space:remove` | 强制软删云端库、解绑副本并释放无引用附件 |
| `GET /vault/admin/spaces/{vaultId}/files` | `vault:file:list` | 分页查询库内 `vault_file`（**不查 `content` 列**） |
| `GET /vault/admin/spaces/{vaultId}/files/{fileId}/content` | `vault:file:content` | 只读查看文本正文或返回附件元数据与下载流入口（强制 `@Log`） |
| `GET /vault/admin/spaces/{vaultId}/assets/{assetId}/content` | `vault:file:content` | 管理员受控流式下载附件（按 `config_id` 读取，不暴露 `/basics/base/file/**`） |
| `DELETE /vault/admin/spaces/{vaultId}/files/{fileId}` | `vault:file:remove` | 协议级墓碑删除（`deleted=1`、`rev+1`、写 `vault_change(delete)`） |
| `GET /vault/admin/spaces/{vaultId}/assets` | `vault:file:list` | 分页查询库内 `vault_asset_ref` 及引用计数 |
| `GET /vault/admin/spaces/{vaultId}/changes` | `vault:space:query` | 分页倒序查询 `vault_change` 变更审计日志 |

### 5.3 副本管理（`VaultAdminReplicaController`）

| 方法与路径 | 权限点 | 说明 |
|---|---|---|
| `GET /vault/admin/replicas/list` | `vault:replica:list` | 跨库分页查询已绑定副本（支持按 `vaultId` 过滤，库详情抽屉直接复用此接口） |
| `DELETE /vault/admin/replicas/{id}` | `vault:replica:remove` | 强制解绑单个副本 |
| `DELETE /vault/admin/replicas/batch/{ids}` | `vault:replica:remove` | 批量解绑过期/异常副本 |

### 5.4 配额、策略与维护（`VaultAdminQuotaController`）

| 方法与路径 | 权限点 | 说明 |
|---|---|---|
| `GET /vault/admin/quota/policy` | `vault:quota:list` | 获取全局默认配额策略 + `multipart` 上限参考 |
| `PUT /vault/admin/quota/policy` | `vault:quota:edit` | 更新全局默认配额策略 |
| `GET /vault/admin/quota/users` | `vault:quota:list` | 分页查询用户级配额覆盖列表（含实时 `usedBytes`） |
| `PUT /vault/admin/quota/users/{userId}` | `vault:quota:edit` | 新增或修改用户级配额覆盖 |
| `DELETE /vault/admin/quota/users/{userId}` | `vault:quota:edit` | 删除用户级覆盖（恢复全局默认） |
| `GET /vault/admin/maintenance/stats` | `vault:maintenance:run` | 统计可清理的孤儿附件与过期墓碑数量 |
| `POST /vault/admin/maintenance/cleanup-orphan-assets` | `vault:maintenance:run` | 手动触发孤儿附件回收 |
| `POST /vault/admin/maintenance/cleanup-tombstones` | `vault:maintenance:run` | 手动触发过期墓碑清理 |

### 5.5 扩展市场管理（`VaultAdminCatalogController`）

| 方法与路径 | 权限点 | 说明 |
|---|---|---|
| `GET /vault/admin/catalog/list` | `vault:catalog:list` | 分页查询所有状态扩展包（含草稿/下架） |
| `GET /vault/admin/catalog/{id}` | `vault:catalog:query` | 获取扩展详情与包内文件 |
| `POST /vault/admin/catalog/parse-zip` | `vault:catalog:add` | 上传 `.zip` 扩展包，服务端安全解压并校验 manifest，返回解析预览 |
| `POST /vault/admin/catalog` | `vault:catalog:add` | 新增扩展（强制安全门禁校验） |
| `PUT /vault/admin/catalog/{id}` | `vault:catalog:edit` | 更新扩展版本/元数据/文件（强制安全门禁校验） |
| `PUT /vault/admin/catalog/{id}/status` | `vault:catalog:publish` | 上架 / 下架切换 |
| `DELETE /vault/admin/catalog/{id}` | `vault:catalog:remove` | 删除扩展（仅允许草稿或已下架状态） |

---

## 6. 前端工程结构（`v5notes-admin2`）

沿用 `v5notes-admin2` 现有的目录约定、Element Plus + UnoCSS 样式体系、`ErrorState` / `TableSkeleton` / `Pagination` / `RightToolbar` 公共组件与三语 i18n（`zh_CN` / `zh_TW` / `en_US`）：

```
v5notes-admin2/src/
├── api/vault/
│   ├── overview/   (index.ts, types.ts)
│   ├── spaces/     (index.ts, types.ts)
│   ├── replicas/   (index.ts, types.ts)
│   ├── quota/      (index.ts, types.ts)
│   └── catalog/    (index.ts, types.ts)
├── views/vault/
│   ├── overview/index.vue
│   ├── spaces/
│   │   ├── index.vue                  # 云端库列表
│   │   ├── space-detail-drawer.vue    # 抽屉容器（副本 / 文件 / 附件 / 变更日志 4 Tab）
│   │   └── file-preview-dialog.vue    # 只读正文 / 附件详情预览
│   ├── replicas/index.vue
│   ├── quota/
│   │   ├── index.vue                  # 全局策略 + 用户覆盖 + 维护任务
│   │   └── user-quota-dialog.vue      # 用户配额编辑弹窗
│   └── catalog/
│       ├── index.vue                  # 扩展目录列表
│       └── catalog-form-dialog.vue    # Zip 上传解析 + 表单维护 + 文件只读预览
└── lang/packs/                        # 新增 vault 模块三语词条
```

---

## 7. 分期实施建议

建议按依赖关系分为 3 个可独立验收的阶段落地：

| 阶段 | 范围 | 交付价值 |
|---|---|---|
| **P1：基础可观测与运维闭环** | 菜单 SQL + 同步概览 + 云端库管理（含 4 Tab 详情抽屉）+ 跨库副本管理 + 协议级墓碑删除与强制解绑 | 管理员立即可见所有 Vault 同步库、副本、文件、附件与变更日志，具备排障与合规处置能力。 |
| **P2：配额策略与存储维护** | `vault_user_quota` 表 + `IVaultQuotaService` 接入 `VaultSyncServiceImpl` + 全局策略与用户覆盖页 + 孤儿附件/过期墓碑维护 | 解除 `VaultQuotaRules` 硬编码限制，支持差异化配额与存储回收。 |
| **P3：扩展市场目录化** | `vault_catalog_item` 表 + `VaultCatalogService` 切 DB + 扩展 Zip 安全解析与上下架管理页 | 官方插件/主题可动态发版与下架，不再需要修改 Java 代码重启服务。 |

---

## 8. 待确认事项

在进入开发前，建议先确认以下几点：

1. **正文只读预览策略**：管理端是否需要支持「只读查看用户非加密笔记正文」（带独立权限 `vault:file:content` 和审计日志），还是仅允许查看元数据（路径、大小、哈希、版本）以更严格保护隐私？
2. **配额生效粒度**：用户级配额中的 `quotaBytes` 目前按「用户下所有云端库总占用」计量、`replicaLimit` 按「单库副本数」计量（与现有 `VaultSyncServiceImpl` 逻辑一致），是否保持该口径？
3. **实施优先级**：是否按上述 `P1 → P2 → P3` 顺序分批推进，还是希望优先落地其中某一个模块（例如先做「配额与策略」或「扩展市场」）？
