# Vault 附件改走基础文件接口（S3 优先 / FTP·本地兜底）设计

- 状态：草案 v2（待评审）
- 日期：2026-11-22
- 范围：`v5notes-vault-client`（客户端同步引擎）+ `v5notes2/note-modules/note-vault-sync`、`note-basics/note-base-file`（服务端）
- 关联：[vault-client-design.md](../../docs/vault-client-design.md) §8.2 / §9.5、延期 2「OSS 直传」
- 相对 v1 的变化：**删除「附件直连桶下载」，改为按后端能力分级的「直连 or 流式代理」**；新增 FTP/本地后端的并发、流式、寻址三项约束。
- v2.1 已定稿决策：FTP 连接池上限 **8**；附件使用 **独立 `file_config`**；生产**先上 proxy、后切 S3**（切换语义见 §7.5）。

---

## 0. 一句话结论

附件字节从 `vault_file_blob`（MySQL mediumblob）**整体删除**，改存**基础文件模块的存储栈**：有 S3/OSS 时走直连下载，没有时走 **Vault 端点的流式代理**。客户端只认 `mode: "direct" | "proxy"`，其余逻辑（sha256 校验、断点、重试）完全相同。`vault_file` / `vault_change` / Markdown 相对链接均不变。

---

## 1. 背景与问题

### 1.1 现状

```
PUT /vault/v1/vaults/{vaultId}/files
{ path: "attachments/a.png", type: "asset", hash: "<sha256>", base64Body: "<...>" }
   ↓
vault_file (元数据)  +  vault_file_blob (mediumblob 字节本体)
```

| # | 问题 |
|---|---|
| P1 | 附件字节存 MySQL mediumblob，业务库膨胀、备份变慢 |
| P2 | 全量 Base64 塞 JSON，体积 +33%，大图/PDF 卡顿、网关超时 |
| P3 | 单文件上限双轨：`VaultQuotaRules` 25MB vs `spring.servlet.multipart` 10MB |
| P4 | 与图片库/头像重复存储 |
| P5 | 无法利用已有的「本地 / FTP / S3」可切换存储栈 |

### 1.2 已确认的部署前提（v2 新增）

| 项 | 结论 | 设计影响 |
|---|---|---|
| 开发环境存储 | 本地文件（`LocalFileClient`） | 无直连 URL，走 proxy |
| 生产环境存储 | FTP（挂共享 NAS） | 无直连 URL，走 proxy；且需解决并发安全 |
| 后端实例数 | **单实例** | FTP 单连接的竞态风险**可控但不为零**（同实例内多线程），多实例时才会升级为致命 |
| 是否可单独配 S3/OSS | **可以** | 因此「S3 优先」是目标态，FTP 是兜底 |
| 单文件上限 | **25MB** | multipart 需上调，见 §6 |

### 1.3 已定稿的决策（v2.1）

| # | 决策 | 落点 |
|---|---|---|
| D1 | FTP 连接池上限 = **8** | §5.1 |
| D2 | 附件使用**独立 `file_config`**，与图片库/头像隔离 | §4.5 |
| D3 | 生产**先上 proxy**（FTP），验证稳定后再**切 S3** 走 direct | §7.5 |
| D4 | **`vault_file_blob` 直接删除**，不做历史数据迁移（开发阶段，无历史包袱） | §4.2 / §8.3 |
| D5 | **`base64Body` 传输通道直接删除**，不保留兼容分支 | §7.1 / §7.2 |

三条决策的相互影响：D3 意味着第一版上线时 `mode` 恒为 `proxy`，**direct 分支必须写但不能是唯一路径**；D2 意味着切换到 S3 时只需新建一个 `file_config` 并切换用途指针，**已有附件仍按各自 `basics_file.config_id` 读**；D1 的 8 是当前 `maxTotal`，需在压测中观察 NAS 侧连接计数。

---

## 2. 基础文件模块的真实能力（v2 关键调研）

这一点决定了整个方案能否「只换存储、不换契约」。五类客户端的实际行为：

| 客户端 | `upload` 返回的 `url` | 读取路径 | 内容寻址 | 流式 |
|---|---|---|---|---|
| `S3FileClient` | **真实桶 URL** | 可直连 | 可换 key | 有 API |
| `FTPFileClient` | `{domain}/basics/base/file/{configId}/get/{path}` | **必须回源** | 无（uuid 命名） | ❌ 全量 `byte[]` |
| `LocalFileClient` | 同上 | **必须回源** | 无 | ❌ 全量 `byte[]` |
| `DBFileClient` | 同上 | 必须回源 | 无 | ❌ 全量 `byte[]` |
| `SFTPFileClient` | 同上 | 必须回源 | 无 | ❌ 全量 `byte[]` |

```java
// AbstractFileClient —— local / ftp / db / sftp 共用
protected String formatFileUrl(String domain, String path) {
    return StrUtil.format("{}/basics/base/file/{}/get/{}", domain, getId(), path);
}
```

**结论：存储后端的差异必须被 Vault 层吸收掉，不能让客户端感知。** 这是 §4.3 设计 `download.mode` 的直接原因。

### 2.1 FTP 后端的三个硬约束

```java
// FTPFileClient：整个 FileClient 共享一个 FTPClient，靠 CWD 定位文件
private FTPClient client;

public FileUploadResult upload(byte[] content, String path, String type) {
    reconnectIfNeeded();
    String pwd = client.printWorkingDirectory();   // 全局工作目录
    ensureDirectory(dir);                          // 多次 CWD
    changeWorkingDirectory(dir);                   // 改全局工作目录 ← 竞态点
    client.storeFile(fileName, in);
    finally { changeWorkingDirectory(pwd); }
}
```

| 约束 | 后果 | 单实例下是否致命 |
|---|---|---|
| 单连接 + CWD 切换 | 并发上传互相切目录 → 文件写错目录 / 550 | **仍会复现**（同步是多线程推送） |
| `reconnectIfNeeded()` 在传输中 `disconnect` | 一个线程重连会掐断别人的传输 | 会 |
| `getContent` 全量 `ByteArrayOutputStream` | 25MB × 并发 → 堆压力 | 会 |

**所以：即使单实例，FTP 客户端也必须先加连接池（§5.1）。** 这不是可选优化。

### 2.2 并发来源

同步引擎当前是**顺序 push**（`pushPull` 里 for 循环），但：

- 客户端其他地方（插件、缩略图、预览）可能并发调用同一 `FileClient`
- 后续为提速会引入附件并发上传（§6.1 允许 2～3 并发）
- Spring MVC 对同一请求是单线程，但**不同用户并发上传附件**必然同时打到同一个 FTP 单例

→ 连接池是必须的。

---

## 3. Vault 侧暴露给客户端的形态（v2 核心变化）

### 3.1 为什么不能直接透传底层的 url

`basics_file.url` 在 FTP 下是 `.../basics/base/file/{configId}/get/{path}`，而该端点：

- 标了 `@SaIgnore`（免登录）
- 不校验 `vault_id` / `user_id` 归属
- 路径直接拼在 controller

若 Vault 把 `basics_file.url` 原样返回给客户端，等于**把整个文件库的免鉴权直出通道暴露给同步客户端**——任何拿到 configId + path 的人都能读别人的附件。

**所以 Vault 必须提供自己的受控读取端点。**

### 3.2 新增：受控的附件流式下载

```
GET /vault/v1/vaults/{vaultId}/assets/{assetId}/content
Authorization: Bearer ...
Range: bytes=0-1048575            (可选，断点续传)
→ 206 Partial Content / 200 OK
  Content-Length / Content-Range / Content-Type
  X-Content-Hash: sha256:...
```

实现要点：

```java
@SaCheckLogin
@GetMapping("/{vaultId}/assets/{assetId}/content")
public void content(@PathVariable String vaultId, @PathVariable String assetId,
                    @RequestHeader(value = "Range", required = false) String range,
                    HttpServletResponse resp) throws Exception {
    VaultAssetRef ref = assetService.requireOwned(LoginHelper.getUserId(), Long.parseLong(vaultId), assetId);
    assetService.streamTo(ref, range, resp.getOutputStream());   // 不回内存
}
```

- **必须校验 `vault_id + user_id + asset_id` 三者归属**，不像 `/basics/base/file/**` 那样裸奔
- **必须流式**：禁止 `byte[]`，见 §5.2
- 支持 `Range`：断点续传依赖它

### 3.3 `GET /files/content` 返回下载描述（不再是固定 `downloadUrl`）

```json
{
  "fileId": "1839...",
  "path": "attachments/a.png",
  "remoteRev": 3,
  "contentHash": "sha256:ab12...",
  "size": 204800,
  "type": "asset",
  "assetId": "1839...",
  "download": {
    "mode": "direct",                                   // "direct" | "proxy"
    "url": "https://oss.xxx/vault/12/ab/ab12...",        // direct: 预签名, proxy: Vault 端点
    "expiresIn": 300,
    "supportsRange": true
  }
}
```

| `mode` | 触发后端 | `url` 形态 | 客户端行为 |
|---|---|---|---|
| `direct` | S3 / OSS | 预签名直链，TTL 300s | 直接 `fetch(url)`，不经业务服务器 |
| `proxy` | FTP / 本地 / DB / SFTP | `/vault/v1/vaults/{id}/assets/{assetId}/content` | `fetch(url, {headers: Authorization})`，走业务服务器流式转发 |

客户端代码**只有一处分支**：`proxy` 时带上 Authorization 头。其余（sha256 校验、`.tmp` 落盘、断点、重试）完全共享。

---

## 4. 总体设计

### 4.1 数据流

```
客户端同步一轮
  ├─ 笔记 / config : pushOne() → PUT /vault/v1/vaults/{id}/files        (不变，body 文本)
  └─ 附件          : uploadAsset() → POST /vault/v1/vaults/{id}/assets  (multipart, 新增)
                         ↓
                    服务端: stream 计算 sha256 → 去重(vault_asset_ref)
                         ├─ 命中: 直接返回 {assetId, contentHash, deduped:true}
                         └─ 未命中: VaultAssetStorage.store()
                                   → 有 S3: 走 S3FileClient(对象 key = sha256)
                                   → 无  : 走 FTPFileClient(LocalFileClient)
                                    并写 basics_file
                         ↓
                    PUT /vault/v1/vaults/{id}/files
                    { path, hash, type:"asset",
                      asset:{assetId,sizeBytes,mimeType}, baseRev }
                         ↓
                    vault_file(path, hash, file_type='asset')
                    vault_asset_ref(file_id ↔ asset_id)
                    vault_change(upsert, 仅记 path/hash/size/rev)
```

> **实现修正**：原设计打算在 `vault_change` 上追加 `assetId` / `sizeBytes` / `mimeType`，让客户端不发请求就能判断「本端已有」。实施时**没有采用** —— 客户端拉取前已经比对 `sync-state.localHash == change.contentHash`，命中就跳过 `getContent`；`contentHash` 本来就在 manifest 里，追加字段不会减少任何一次请求，只会让变更表多三列。`VaultChangeVo` 保持原样。

### 4.2 表结构

新增 `vault_asset_ref`：

```sql
CREATE TABLE IF NOT EXISTS vault_asset_ref
(
    file_id     bigint(20)  NOT NULL COMMENT 'vault_file.id',
    asset_id    bigint(20)  NOT NULL COMMENT 'basics_file.id',
    vault_id    bigint(20)  NOT NULL COMMENT '云端库 ID（冗余，便于按库清理与去重）',
    sha256      varchar(80) NOT NULL COMMENT '内容哈希（= vault_file.content_hash）',
    size_bytes  bigint(20)  NOT NULL DEFAULT 0,
    mime_type   varchar(128)         DEFAULT NULL,
    storage_key varchar(512)         DEFAULT NULL COMMENT '底层对象 key；S3 下 = vault/{vaultId}/{sha256}',
    backend     varchar(16) NOT NULL DEFAULT 'proxy' COMMENT 'direct(S3) / proxy(FTP,local,db)',
    create_time datetime             DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (file_id),
    KEY idx_vault_asset_ref_asset (asset_id),
    KEY idx_vault_asset_ref_vault (vault_id),
    UNIQUE KEY uk_vault_asset_ref_hash (vault_id, sha256)
) ENGINE = InnoDB COMMENT = 'Vault 附件对象引用';
```

新增迁移 `V20__vault_sync_v2.sql`（`db/migration/mysql/`、`db/migration/postgresql/` 各一份），内容为**加列 + 建新表 + 删旧表**：

```sql
-- 1) 笔记/config 正文落列（D6，必须先于删表）
ALTER TABLE vault_file ADD COLUMN content mediumtext NULL
    COMMENT 'note/config 正文（asset 为 NULL）';

-- 2) 建 vault_asset_ref（如上）

-- 3) 删除内容寻址 blob 表（D4：开发阶段无历史数据，直接删）
DROP TABLE IF EXISTS vault_file_blob;
```

三条语句执行顺序即依赖顺序：**先有 `content` 列接住文本正文，才能删掉 blob 表**。

**D4：`vault_file_blob` 直接删除**，需要一并移除的代码：

| 位置 | 动作 |
|---|---|
| `V18__vault_sync_tables.sql`（mysql/postgresql） | 删除建表语句（新库不再建） |
| `script/sql/notes2.sql` | 删除建表语句 |
| `domain/VaultFileBlob.java` + `mapper/VaultFileBlobMapper.java` | **删除文件** |
| `VaultSyncServiceImpl` | 删字段 `blobMapper`、`ensureBlob()`、`getContent()` 的 blob 分支 |
| `VaultSyncServiceImpl.decodeBody()` | `base64Body` 分支整个删除（D5），只保留 `body` |
| `VaultSyncPutBatchTest` / `VaultSyncManifestPaginationTest` | 移除 `blobMapper` mock，删 `blobReuseDoesNotInsert` 用例 |
| 构造器注入签名 | `VaultSyncServiceImpl(space, replica, file, blob, change)` → 去掉 blob 参数 |

#### 4.2.1 文本笔记的正文去哪（删表后的连带问题）

现状 `putFileInternal` 对**所有类型**都调 `ensureBlob(hash, bytes)` —— 文本笔记的正文也存在 `vault_file_blob` 里。删表后文本没有地方放正文，必须给出替代。

**结论：笔记/config 的正文不进 `VaultAssetStorage`，只有 `type=asset` 才走附件存储。**

| 类型 | 正文存放 | 读取 |
|---|---|---|
| `note` / `config` | `PUT /files` 的 `body` 字段 → **原样存回 `vault_file`**（新增 `content` 列）或独立的 `vault_file_text` | `GET /files/content` **内联返回 `body`**，契约不变 |
| `asset` | `POST /assets` → `VaultAssetStorage` → 存储栈 | `GET /files/content` 返回 `download` 描述 |

理由：

1. **附件是字节问题，笔记是内容问题**。把 `.md` 塞进 FTP/S3 会让「拉一篇笔记」多一次对象存储往返，而笔记恰恰是最高频、最小的读。
2. **文本走 `body` 内联**，客户端的 `pushOne` / `applyRemoteUpsert` 文本分支一行都不用改，改动面最小。
3. 避免"为了删一张表，把整个笔记通道也推倒重来"。

**落库形态已定（D6）：`vault_file` 加列。**

```sql
ALTER TABLE vault_file
    ADD COLUMN content mediumtext NULL COMMENT 'note/config 正文（asset 为 NULL）';
```

| 读写点 | 行为 |
|---|---|
| `putFileInternal` | `type=note\|config` → `file.setContent(body)`；`type=asset` → `content = NULL` |
| `getContent` | `type=note\|config` → 直接 `vo.setBody(file.getContent())`，**不碰存储栈** |
| `manifest` / 列表 | 不查询 `content` 列（`LambdaQueryWrapper` 显式 `select` 白名单，避免把正文带进列表响应） |
| 配额 | `vault_file.size_bytes` 已是压缩后字节长度，维持原口径；`content` 不计二次开销 |
| 删除 | 随行墓碑，无额外清理 |

文本类资产（`.svg/.json/.csv` 等 `prefersTextBody` 命中的附件）仍按 `asset` 处理 —— 它们是附件，只是恰好是文本，仍走存储栈。

### 4.3 存储抽象：`VaultAssetStorage` SPI

`note-vault-sync` **不依赖** `note-base-file`（当前仓库也确实没有这条依赖），因此定义 SPI 隔离：

```java
// note-vault-sync
public interface VaultAssetStorage {
    /** 存对象；key 由调用方给出（sha256 寻址），返回后端类型。 */
    StoredObject store(Long userId, String objectKey, String mimeType, long sizeBytes,
                       InputStream content) throws Exception;

    /** direct 模式：生成预签名直链；proxy 后端返回 Optional.empty()。 */
    Optional<PresignedUrl> presign(Long configId, String objectKey, int ttlSeconds);

    /** proxy 模式：流式吐出对象内容，支持 Range。按调用方指定的 configId 读。 */
    void streamTo(Long configId, String objectKey, ByteRange range, OutputStream out) throws Exception;

    /** 引用计数归零后删除对象。 */
    void delete(Long configId, String objectKey) throws Exception;

    /** 当前"附件用途"配置的能力位。 */
    Capability capability();

    /** 上传目标配置 ID（落库到 `basics_file.config_id`，读取时凭此回原后端）。 */
    Long targetConfigId();
}

record Capability(String backend, boolean directDownload, long maxFileBytes) {}
```

实现类放在 **`note-admin-file`**（该模块已依赖 `note-base-file` 与 admin 侧配置）：

```java
@Component
public class BasicsFileVaultAssetStorage implements VaultAssetStorage {
    private final IFileInfoService fileInfoService;
    private final IFileConfigService fileConfigService;

    /** 上传永远写"附件用途"的配置（D2）。 */
    @Override public Long targetConfigId() {
        return fileConfigService.getByPurpose(FileConfigPurpose.VAULT_ASSET).getId();
    }

    /** 读取按传入的 configId（来自 basics_file.config_id），绝不读"当前主配置"。 */
    @Override public Optional<PresignedUrl> presign(Long configId, String key, int ttl) {
        FileClient c = fileConfigService.getFileClient(configId);
        if (c instanceof S3FileClient s3 && s3.getAccessPolicy() == AccessPolicy.PRIVATE) {
            return Optional.of(new PresignedUrl(s3.getPrivateUrl(key, ttl), ttl));
        }
        return Optional.empty();      // FTP / 本地 → proxy
    }
    // streamTo / delete 同理：按 configId 取客户端
}
```

`note-vault-sync` 侧用 `ObjectProvider<VaultAssetStorage>` 注入，缺失时降级为 inline（§7）。

### 4.4 `basics_file` 的补充

现有 `basics_file` 无 hash 列、`path` 无唯一约束。**Vault 附件不复用它的 path 规则**，而是：

- 存储 key 由 Vault 拼：`vault/{vaultId}/{sha256前2位}/{sha256}`（**无扩展名**，规避 FTP 中文/特殊字符问题）
- `basics_file.name` 存原文件名（仅供管理端展示与下载时还原）
- `basics_file.type` 存 MIME
- DB 层的去重由 `vault_asset_ref.uk_vault_asset_ref_hash` 保证

> 如需在 `basics_file` 层面也去重（图片库共用同一张图），可加 `content_hash` 列 + 索引，**列为 P2，不阻塞本次**。

### 4.5 独立 `file_config`（D2）

`basics_file_config` 现在只有 `master` 一个用途标记，"谁用哪条配置"靠全局主配置决定。新增用途维度：

```sql
ALTER TABLE basics_file_config
    ADD COLUMN purpose varchar(32) NOT NULL DEFAULT 'GENERIC'
        COMMENT '用途：GENERIC(图片库/头像) / VAULT_ASSET(同步附件)',
    ADD KEY idx_basics_file_config_purpose (purpose);
```

- `enum FileConfigPurpose { GENERIC, VAULT_ASSET }`
- `IFileConfigService.getByPurpose(FileConfigPurpose)`：按用途取唯一启用配置，**不读 `master`**
- 约束：同一 `purpose` 只能有一条启用记录；切换时在服务端互斥更新
- 管理端「文件配置」页增加用途列与筛选（前端规则：状态呈现在控件上，不加说明文案）

**为什么隔离**：

| 好处 | 说明 |
|---|---|
| 切 S3 零影响 | 图片库继续留 FTP，只把 `VAULT_ASSET` 用途切到 S3 |
| 目录/桶独立 | FTP 下用独立子目录（如 `/共享目录/v5notes_vault_asset/`），不混进图片库目录 |
| 计费清晰 | 同步附件存储成本可单独核算 |
| 隔离风险 | 附件用坏/配额打满不影响图片库；回退时只切这一条配置 |

**上线动作**：新建一条 `purpose=VAULT_ASSET` 的 `file_config`，指向 FTP 独立子目录 —— 这就是生产 v1 的 proxy 后端（D3 第一阶段）。

---

## 5. 必须补齐的三件事

### 5.1 FTP 客户端连接池（P0，不修会出错）

**问题**：单实例共享一个 `FTPClient`，同步多线程并发 CWD/STOR/RETR 会互相干扰。

**改法 A（推荐）**：每请求独立连接 + 池化

```java
public class FTPFileClient extends AbstractFileClient<FTPFileClientConfig> {
    private GenericObjectPool<FTPClient> pool;   // commons-pool2

    protected void doInit() {
        pool = new GenericObjectPool<>(new FTPClientFactory(config), poolConfig());
    }

    public FileUploadResult upload(byte[] content, String path, String type) throws Exception {
        FTPClient c = pool.borrowObject();
        try { /* 原逻辑，但用局部 c 而非字段 */ }
        finally { pool.returnObject(c); }   // 归还前 PWD 复位或直接 discard
    }
}
```

- **`maxTotal = 8`（D1 已定）**，`maxIdle = 4`，`maxWaitMillis = 5000`，`testOnBorrow = false`，`minEvictableIdleTimeMillis = 30000`
- 8 是上限而非目标并发：客户端 proxy 模式最多 2 路在途（§5.5），留 6 个给管理端预览、插件等其他调用方
- 压测时在 NAS 侧观察 `netstat | grep :21` 的连接计数，确认未触发每账号限制
- 归还时若连接非 2xx 状态 → `invalidateObject`，下一次 borrow 重建
- 去掉 `reconnectIfNeeded()`（由池负责生命周期）
- **`doInit` 的目录校验前置到工厂工厂方法里**（每连接一次）

**改法 B（更省事）**：`FileClient` 层加 `ReentrantLock` 串行化所有操作。正确但吞吐极差（附件同步全部串行），**不推荐**。

> 风险提示：`FTPFileClient` 目前没有单元测试覆盖并发。改造必须补一个 "N 线程并发上传不同目录" 的测试，否则回归不可见。

### 5.2 流式转发，禁止 `byte[]`

**服务端**：

```java
// 上传：不 IoUtil.readBytes(file.getInputStream())
vaultAssetService.store(..., file.getInputStream(), file.getSize());

// 下载：不 getContent() 的 byte[]
assetService.streamTo(ref, range, resp.getOutputStream());
```

需要给 `FileClient` 增加两个 default 方法（**不破坏现有实现**）：

```java
default FileUploadResult uploadStream(InputStream in, long size, String path, String type) {
    return upload(IoUtil.readBytes(in), path, type);      // 兜底
}

default void getContentStream(String path, long offset, long length, OutputStream out) {
    out.write(getContent(path));                          // 兜底
}
```

- `FTPFileClient` 覆写：`storeFile(fileName, in, FTP.BINARY_FILE_TYPE)` / `retrieveFile(fileName, out)`（offset 用 `setRestartOffset`）
- `LocalFileClient` 覆写：`Files.copy(InputStream, Path)` / `RandomAccessFile.seek`
- `S3FileClient` 覆写：`client.upload(path, InputStream)` / `client.download(key, out)`（已支持）

### 5.3 能力位暴露

`GET /vault/v1/quota` 增加：

```json
{
  "assetTransportSupported": true,
  "assetStorage": {
    "backend": "proxy",          // "direct" | "proxy"
    "directDownload": false,
    "maxFileBytes": 26214400,
    "maxConcurrentUploads": 2    // proxy 给 2，direct 给 4
  }
}
```

客户端据此：
- `maxConcurrentUploads` → 控制附件推送并发
- `maxFileBytes` → 超限角标显示真实值（不再是写死的 25MB）

> **`assetTransportSupported` 在 D5 之后恒为 `true`**（inline 通道已不存在，无回落）。字段保留只为兼容旧客户端读取，服务端不再返回 `false`。若附件存储不可用，返回 503 让客户端进重试队列，而不是降级成一个大 JSON 请求。

### 5.4 客户端断点续传（proxy 模式收益最大）

```
下载:
  1. GET content → download{mode,url,supportsRange}
  2. fetch(url) → 写 attachments/x.png.part
  3. 中断后恢复: Range: bytes={已下载}-   (仅 supportsRange=true)
  4. 完成后 sha256 校验 → 原子 rename
  5. 校验失败: 删除 .part, 重试 2 次, 仍失败进重试队列
```

proxy 模式下断点续传尤其重要：25MB 附件经业务服务器回源，网络抖动概率远高于直连桶。

### 5.5 并发限流

- **客户端**：附件上传/下载并发按能力位限制（proxy=2，direct=4），笔记推送保持顺序
- **服务端**：FTP 连接池上限 8 天然限流；对 `/vault/.../assets/*/content` 加每用户并发上限（如 4），避免单用户打满

---

## 6. 配额与体积

| 项 | 现状 | 改后 |
|---|---|---|
| 单文件上限 | Vault 25MB / multipart 10MB | **统一 25MB**；`spring.servlet.multipart.max-file-size: 25MB`、`max-request-size: 30MB` |
| 去重计量 | `used_bytes` 按字节累加 | 命中 `sha256` 不重复计；删除最后一个引用时扣减 |
| 用户总配额 | `ClientStorageGuard`（无实现） | 在 `VaultAssetServiceImpl.store` 调用，挂点已有 |

> 若线上值仍是 10MB，用户会在 10MB 处收到 Spring 的 `MaxUploadSizeExceededException`，页面必须映射为 `413 vault.file.too.large`，否则表现为「莫名失败」。

---

## 7. 发布与切换（无兼容层）

| # | 项 | 做法 |
|---|---|---|
| 7.1 | **无 inline 兼容**（D5） | `base64Body` 在服务端与客户端**同时删除**，不保留过渡分支。旧版客户端不再受支持，见下 |
| 7.2 | **无能力位回落** | 删除 `sync.assetTransport` 开关；附件只有一条路径 —— 存储栈。失败即进重试队列 |
| 7.3 | 无混合库 | 无历史数据，不存在「有 ref / 无 ref」共存；`GET /files/content` 只有一种分支 |
| 7.4 | 后端切换读取 | **已存在的附件按各自 `basics_file.config_id` 在原后端读取**，新附件写当前 `VAULT_ASSET` 配置。否则切 S3 当天历史附件全 404 |
| 7.5 | 生产切换路线 | 见下（D3） |

### 7.5 生产切换路线（D3）

```
阶段 0  建 file_config(purpose=VAULT_ASSET, storage=102 FTP) → 独立子目录 /v5notes_vault_asset/
        能力位: backend=proxy, directDownload=false, maxConcurrentUploads=2
        ↓  上线，观察 2~4 周（重点盯 FTP 连接池与 550 错误率）
阶段 1  新建 file_config(purpose=VAULT_ASSET, storage=104 S3)，切换用途指针，旧配置置为停用
        能力位: backend=direct, directDownload=true, maxConcurrentUploads=4
        历史附件仍读 FTP（basics_file.config_id 指向旧配置）→ 依赖 §7.4 的按 configId 读取
        新附件写 S3
        ↓
阶段 2（可选）后台批量迁移历史附件到 S3，回收 FTP 子目录
```

**切换当天的三条检查**：

1. 老附件可读：抽 10 个 `config_id = 旧配置` 的附件走完 `getContent` → `download.mode=proxy` → 正常下载
2. 新附件可写：上传后 `basics_file.config_id = 新配置`，`vault_asset_ref.backend = direct`
3. 客户端能力位刷新：客户端下次 `getStatus` 拿到新的 `directDownload`，并发从 2 升到 4

> 阶段 1 **不需要客户端发版** —— 这正是 v2 引入 `download.mode` 的目的。客户端读能力位自动切换。

### 7.6 无存量客户端（D5 的前提成立）

**Vault 同步尚未发布，不存在旧客户端**，因此删除 `base64Body` 没有兼容负担：

1. 客户端与服务端**同批发版**，不需要灰度、不需要版本探测、不需要「请升级客户端」的提示文案。
2. 因为不存在旧版本，即使配置了灰度开关也**永远只会走一条路径**——开关本身就是死代码，不引入。
3. 契约保持干净：`type=asset` 必须带 `asset`，否则 `400 vault.asset.required`（语义正确的参数校验，不是版本降级判决）。

> 唯一需要在客户端保留的是**不可重试错误分类**：`vault.asset.required` 与 `vault.hash.mismatch` 同级，进队列只会刷重复项，应直接失败并在附件行上呈现。

---

## 8. 生命周期与清理

### 8.1 引用计数删除

```
DELETE /vault/v1/vaults/{vaultId}/files
  → vault_file 置墓碑
  → 删 vault_asset_ref(file_id)
  → count(asset_id) == 0 时 VaultAssetStorage.delete(storage_key)
```

顺序不可逆：**绝不先删存储再删行**。

### 8.2 孤儿回收

- 场景：`uploadAsset` 成功但 `putFile` 永久失败
- 处理：每日任务扫 `storage_key LIKE 'vault/%'` 且 `create_time < now-7d` 且无 ref 引用的对象 → 删除
- 7 天宽限覆盖跨天重试

### 8.3 历史数据迁移 —— 不做（D4）

**开发阶段无历史数据，不写迁移脚本、不留读回退。** `V20__vault_sync_v2.sql` 里直接 `DROP TABLE IF EXISTS vault_file_blob`。

如果不放心，上生产前的一条自检即可确认：

```sql
-- 若返回 0，说明确实没有历史附件，可以安全删表
SELECT COUNT(*) FROM vault_file WHERE file_type = 'asset' AND deleted = 0;
```

> 这条查询现在是**可选的前置检查**，不是迁移步骤。未来如果真出现带历史数据的环境，再补 §8.3 原本的一次性脚本（分批 200、可断点续跑、失败告警）。

---

## 9. 测试计划

### 9.1 服务端

| 用例 | 断言 |
|---|---|
| 首次上传附件（FTP 后端） | `basics_file` 1 行、`vault_asset_ref` 1 行、blob 0 行 |
| 同内容二次上传 | `deduped=true`、`basics_file` 仍 1 行 |
| sha256 不一致 | 409 `vault.hash.mismatch`，零写入 |
| `type=asset` 但无 `asset` 字段 | 400 `vault.asset.required`（§7.6） |
| `type=asset` 且带 `base64Body` | 400（字段已不存在，Jackson 忽略后落空 → 同样 `vault.asset.required`） |
| `type=note` 带 `body` | `vault_file.content` 落库，`vault_asset_ref` 0 行 |
| `type=note` 读取 | 返回 `body`，不调用 `VaultAssetStorage` |
| `type=asset` 读取 | `vault_file.content` 为 NULL，返回 `download` 描述 |
| manifest / 列表 | 响应不含 `content` 字段（SQL 未 select） |
| 表已删除 | `vault_file_blob` 在 V20 后不存在（Flyway 全新库跑通） |
| `getContent`（FTP） | `download.mode == "proxy"`，url 指向 Vault 端点 |
| `getContent`（S3） | `download.mode == "direct"`，url 为预签名 |
| `GET /assets/{id}/content` | 跨用户 403；流式不 OOM（注入 25MB 流，断言堆峰值） |
| Range 请求 | 返回 206 + 正确 `Content-Range` |
| **FTP 并发**（P0） | 8 线程并发上传不同目录，全部落到正确目录 |
| 删除最后一个引用 | 底层对象删除 |
| 切换 `file_config` 后读旧附件 | 仍可读（按 `storage_key` + 原 `config_id`） |

### 9.2 客户端

| 用例 | 断言 |
|---|---|
| `pushOne` asset | 顺序 uploadAsset → putFile；putFile 无 base64Body |
| proxy 模式下载 | 请求带 Authorization 头 |
| 下载中断恢复 | 从 `.part` 大小发出 Range，内容 sha256 一致 |
| 下载校验失败 | 删除 `.part`，重试 2 次 |
| 收到 `vault.asset.required` | 不可重试，提示升级客户端 |
| 并发上限 | 同时最多 2 个附件请求在途 |

### 9.3 端到端

- 25MB PDF 在 FTP 后端上传 + 另一设备拉取，字节一致
- 断网 30s 恢复：不丢、不重复上传（幂等）
- 两设备同时改同一附件：冲突副本产生且都能打开

---

## 10. 风险

| 风险 | 缓解 |
|---|---|
| FTP 并发竞态 | 连接池（§5.1）+ 并发测试；这是**上线前置条件** |
| proxy 模式打满业务服务器 | 客户端并发限流 + 服务端每用户并发上限；后续上 S3 即消失 |
| 存储后端切换导致历史附件 404 | `basics_file.config_id` 记录原后端，读按行走（§7.4）；切换日按 §7.5 三条检查验收 |
| 图片库与附件共用配置互相牵连 | 独立 `purpose=VAULT_ASSET` 配置（§4.5） |
| 鉴权缺口 | Vault 自建 `/assets/{id}/content`，严格校验归属（§3.2）；**不对外暴露 `/basics/base/file/**`** |
| 25MB × 并发 OOM | 流式转发（§5.2），禁止 `byte[]` |
| 回滚 | **不可回滚到 inline**（D5 已删通道）。回滚方式只剩「切回旧版本的存储后端配置」，代码回滚需连同部署包一起回退 |
| 删表后文本无正文（D4 连带） | §4.2.1 的 `vault_file.content`（D6）**必须先于删表落地**；#8b 排在建表迁移之前 |
| `vault_file` 行变大影响列表查询 | 列表/manifest 显式不 select `content`（§4.2.1 表） |

---

## 11. 交付拆分

| # | 内容 | 优先级 | 估算 |
|---|---|---|---|
| 0 | **FTP 客户端连接池 + 并发测试** | **P0** | 2d |
| 1 | `FileClient` 流式方法（uploadStream / getContentStream） | P0 | 1.5d |
| 2 | `vault_asset_ref` 表 + `POST /assets` + 去重 | P0 | 2d |
| 3 | `PUT /files` 扩展 `asset` + `GET /files/content` 返回 `download` | P0 | 1.5d |
| 4 | `GET /assets/{id}/content` 流式 + Range + 归属校验 | P0 | 1d |
| 5 | `VaultAssetStorage` SPI + S3/FTP 双实现 + 能力位 | P0 | 1.5d |
| 5b | `file_config.purpose` 列 + `getByPurpose` + 管理端用途列 | P0 | 1d |
| 6 | 客户端 `uploadAsset` + 引擎 push/pull + 断点续传 + 并发限流 | P0 | 3d |
| 7 | 生命周期：引用计数、孤儿回收 | P1 | 1d |
| 8 | ~~历史 blob 迁移脚本~~（D4 取消） | — | 0d |
| 8b | **`vault_file.content` 加列 + 读写切换**（删表前置） | P0 | 1d |
| 8c | 移除 `base64Body` 全链路（服务端 + 客户端） | P0 | 1d |
| 9 | E2E + 25MB 压测 | P1 | 1.5d |
| 10 | 清理：删 `VaultFileBlob*`、删测试 mock、删 `sync.assetTransport` | P0 | 0.5d |

约 **19 人日**（原 17 − 迁移 1 + 删表连带 1 + 移除 base64Body 1 + 清理 0.5，取整）。其中 **#0/#1 是基础设施前置**，不做则 FTP 环境上线即不稳定。

**上线顺序**（对应 D3）：

```
#5b 建 VAULT_ASSET 配置 → #8b 笔记正文改列 → #0 连接池 → #1 流式
→ #2/#3/#4/#5 服务端 → #6 客户端 → #8c 移除 base64Body → #10 清理
→ 客户端/服务端同批发版 → 生产灰度（proxy）→ #7 生命周期
→ 观察期 → 阶段 1 切 S3（无需发版）
```

**#8b 必须早于删表**：笔记正文改存 `vault_file.content` 之后，`vault_file_blob` 才真正没人用，删表才不会丢数据。
**#8c 与客户端发版必须同批**：见 §7.6，旧客户端在 base64Body 删除后会直接失败。

---

## 12. 已定 / 待确认

### 已定稿

| # | 决策 | 落点 |
|---|---|---|
| D1 | FTP 连接池上限 **8**（`maxTotal=8`, `maxIdle=4`） | §5.1 |
| D2 | 附件使用**独立 `file_config`**（`purpose=VAULT_ASSET`） | §4.5 |
| D3 | 生产**先 proxy（FTP）→ 后切 S3（direct）** | §7.5 |
| D4 | **`vault_file_blob` 直接删除**，不做数据迁移 | §4.2 / §8.3 |
| D5 | **`base64Body` 直接删除**，不保留兼容分支（Vault 同步尚未发布，无存量客户端） | §7.1 / §7.6 |
| D6 | 笔记/config 正文存 **`vault_file.content` 列** | §4.2.1 |

### 仍需确认

1. **NAS 每账号连接上限是多少？** 池上限定了 8，需确认 NAS 侧允许 ≥8（有些默认 10，够用但无余量给人工 FTP 排查）。**上线前必须确认**。
2. **预签名 TTL 300s 是否够**（direct 模式多图并发）？仅阶段 1 之后生效，不阻塞首发。
3. **`basics_file` 是否加 `content_hash` 列**做跨模块去重（P2，不阻塞）。
4. **admin 前端「文件配置」页**是否本轮一起加用途筛选？（后端字段先行，前端可延后）

> 已关闭：笔记正文存储方式（D6）、旧客户端兼容（无存量客户端，§7.6）。

---

## 附录 A：受影响文件清单

```
服务端
  note-admin/src/main/resources/application.yml                                       [改] multipart 25MB
  note-admin/src/main/resources/db/migration/{mysql,postgresql}/V20__vault_sync_v2.sql       [新]
      -- ALTER TABLE vault_file ADD COLUMN content mediumtext NULL;
      -- CREATE TABLE vault_asset_ref (...);
      -- DROP TABLE IF EXISTS vault_file_blob;
  note-admin/src/main/resources/db/migration/{mysql,postgresql}/V20a__file_config_purpose.sql  [新]

  note-basics/note-base-file/src/main/java/xin/v5ai/basics/file/
    core/client/FileClient.java                    [改] +uploadStream/+getContentStream (default)
    core/client/ftp/FTPFileClient.java             [改] 连接池化 + 流式覆写      ← P0
    core/client/local/LocalFileClient.java         [改] 流式覆写
    core/client/s3/S3FileClient.java               [改] 流式覆写
    core/client/db/DBFileClient.java               [改] 流式覆写(兜底)
    core/client/DefaultFileClientFactory.java      [改] 池生命周期
    service/IFileConfigService.java                [改] +getByPurpose(FileConfigPurpose)
    domain/enums/FileConfigPurpose.java            [新] GENERIC / VAULT_ASSET
    pom.xml                                        [改] commons-pool2

  note-admin/src/main/resources/db/migration/{mysql,postgresql}/V18__vault_sync_tables.sql     [改] 删 blob 建表
  script/sql/notes2.sql                                                                        [改] 删 blob 建表
  note-modules/note-vault-sync/src/test/.../VaultSyncPutBatchTest.java                         [改] 去 blobMapper mock
  v5notes-admin2/src/views/.../fileConfig        [P2] 用途列与筛选

  note-basics/note-admin-file/src/main/java/.../BasicsFileVaultAssetStorage.java     [新] SPI 实现

  note-modules/note-vault-sync/src/main/java/xin/v5ai/vault/
    controller/VaultAssetController.java           [新] POST /assets, GET /assets/{id}/content
    service/VaultAssetStorage.java                 [新] SPI
    service/IVaultAssetService.java                [新]
    service/impl/VaultAssetServiceImpl.java        [新]
    domain/VaultAssetRef.java + mapper              [新]
    domain/VaultFileBlob.java                      [删] D4
    mapper/VaultFileBlobMapper.java                [删] D4
    domain/VaultFile.java                          [改] +content (note/config 正文)
    domain/bo/VaultFilePutBo.java                  [改] +asset；-base64Body (D5)
    domain/vo/VaultFileContentVo.java              [改] download{ mode,url,expiresIn,supportsRange }
    domain/vo/VaultQuotaVo.java                    [改] assetStorage 能力位
    service/impl/VaultSyncServiceImpl.java         [改] putFile/getContent/appendChange/delete；-blobMapper -ensureBlob -decodeBody.base64
    util/VaultQuotaRules.java                      [改] 去重计量

客户端
  v5notes-vault-client/src/
    sync/api.ts                        [改] uploadAsset / putFile.asset / download 描述解析
    sync/engine.ts                     [改] pushOne / applyRemoteUpsert / 并发限流
    sync/download.ts                   [新] .part + Range 断点续传 + sha256 校验
    sync/types.ts                      [改] 类型扩展
    sync/attachments.ts                [改] 删除 bytesToBase64/base64ToBytes 的同步用途（data URL 用途保留）
    vault/attachments.ts               [改] remoteUrlFor 缓存
    plugin-host/core/relativeImages.ts [改] resolve 顺序 本地→远端
```
