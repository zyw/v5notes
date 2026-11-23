# Vault 附件改走基础文件接口 —— 实施任务包

- 日期：2026-11-23
- 关联设计：[vault-attachment-file-api-design.md](./vault-attachment-file-api-design.md)（v2.3，决策 D1–D6 已定稿）
- 用途：可按模块直接派工的任务清单，含改动点、依赖关系、验收标准

---

## 0. 使用说明

### 0.1 任务依赖

```
T1(连接池) ─> T1b(池生命周期)
     │
     └─> T3(流式) ─┐
                   ├─> T5 ─┐
T2(迁移) ─> T4 ────┘       ├─> T6 ─> T7 ─> T8 ─> T9 ─> T10
                   ────────┘

T1/T1b/T3 同属 note-base-file，必须严格先后、最好同一人。
```

- **T1 是 Hard Blocker**：没有连接池，FTP 环境并发即出错，后续任务无法真实验证。
- **T2 必须先合入**：T4/T5/T6 都依赖新表与 `content` 列存在。

### 0.2 对现有上传下载接口的影响（评审必读）

本方案**大部分改动是隔离的**，但 `note-base-file` 是现有图片库/头像/插图共用的底层，
其中三个任务会**直接修改既有功能所依赖的代码**。

| 共享点 | 是否影响现有接口 | 涉及任务 | 处置 |
|---|---|---|---|
| `FileClient` 接口 | **不影响**（用 `default` 方法，5 个实现零改动） | T3 | — |
| `AbstractFileClient` | 影响（新增 `doDestroy` 钩子，`refresh` 顺序变化） | T1b | A10–A13 |
| **`FTPFileClient`** | **影响**（同一个类重构） | T1、T1b、T3 | A5、A7、A8、A9 |
| **`LocalFileClient`** | **影响**（覆写流式读，引入 range 边界） | T3 | C7、C8 |
| **`DefaultFileClientFactory`** | **影响**（池生命周期，泄漏会波及全部上传） | T1b | A10–A13 |
| `FileInfoServiceImpl.uploadByBo` | 不影响（只调用，不改） | — | — |
| `FileBaseController` / `FileController` | **不影响**（不修改、不改鉴权） | — | — |
| `basics_file` 表 | **不影响**（只给 `basics_file_config` 加 `purpose`） | T2 | B1–B5 |
| `getMasterFileClient()` | **不得改动**（图片库选路保持不变） | T5 | E8、E9 |
| Vault 全部改动 | 不影响（独立模块，单向 SPI 依赖） | T4–T7 | — |

**三条硬性约束**：

1. `getMasterFileClient()` 的实现**一行都不改** —— 图片库仍取 `master=true` 那条，与 `purpose` 无关（E8）。
2. `/basics/base/file/**` 的全部端点**不修改、不删除、不改鉴权**。
3. T1/T1b/T3 合入前，必须跑一遍**图片库上传、头像上传、编辑器插图、图片预览**四条现有链路的回归（A7、C8）。

### 0.3 统一验收定义（DoD）

1. 服务端：`mvn -pl <module> -am test` 通过
2. 客户端：`pnpm test`（vitest）通过
3. 新增/修改的能力有**对应测试**，不允许「实现完没测」
4. 不引入设计文档之外的字段或分支

---

## T1 · FTP 客户端连接池 ⭐P0 Hard Blocker ✅ **已完成**

> 实现：`FTPConnectionFactory`（建连/登录/握手/UTF-8/basePath 校验，每连接一次）+
> `FTPFileClient` 改为每操作 borrow/return。验证 8 条（`FTPFileClientConcurrencyTest`）。
>
> 过程中确认的两个语义：`pool.close()` **不销毁借出中的连接**（归还时才销毁）；
> `resolveMode()` 的 FTPS→Passive 改为局部决策，不再写回共享 config。

**模块**：`note-basics/note-base-file`  
**估时**：2d  
**风险**：高 —— **这是一次面向全局的重构，不是「附件新功能」的局部改动**

> ⚠️ **影响面提示**：`FTPFileClient` 是**现有图片库、头像、编辑器插图**共用的底层。T1 改的是同一个类，
> 因此本任务的回归范围包含 `/basics/base/file` 全部既有功能，而不只是 Vault 附件。
> 合入前必须证明图片库上传/下载无任何行为变化（见 A7/A8/A9）。

### 改动清单

| 文件 | 改动 |
|---|---|
| `pom.xml` | 新增 `commons-pool2` 依赖 |
| `core/client/ftp/FTPFileClient.java:36` | 字段 `private FTPClient client` → `private GenericObjectPool<FTPClient> pool` |
| `core/client/ftp/FTPFileClient.java:43-72` | `doInit()` 改为建池；登录校验 + basePath 可进逻辑下沉到工厂 `makeObject()` |
| `core/client/ftp/FTPFileClient.java:154-184` | `upload()`：borrow → 操作 → return/invalidate，**全部使用局部 client** |
| `core/client/ftp/FTPFileClient.java:220-226` | `delete()` 同上 |
| `core/client/ftp/FTPFileClient.java:229-246` | `getContent()` 同上 |
| `core/client/ftp/FTPFileClient.java:248-259` | **删除 `reconnectIfNeeded()`**（池接管生命周期） |
| `core/client/ftp/FTPFileClient.java:315-333` | `disconnectQuietly()` → `invalidate(FTPClient)`，由池的 `destroyObject` 调用 |
| `core/client/ftp/FTPClientFactory.java` | **新建**：`makeObject / destroyObject / validateObject` |
| `core/client/ftp/FTPFileClient.java:74-82` | `resolveMode()` 当前会写回共享 config，改为局部变量 |

### 池参数

| 参数 | 值 | 理由 |
|---|---|---|
| `maxTotal` | **8** | D1 定稿；客户端 proxy 最多 2 路在途，余量给管理端/人工排查 |
| `maxIdle` | 4 | — |
| `maxWaitMillis` | 5000 | 超时抛可重试异常 |
| `minEvictableIdleTimeMillis` | 30000 | 空闲回收 |
| `testOnBorrow` | false | 性能；借用不做 RTT 探活 |
| `testWhileIdle` | true | 后台探活，提前淘汰死连接 |

### 关键实现约束

```java
public FileUploadResult upload(byte[] content, String path, String type) throws Exception {
    FTPClient c = pool.borrowObject();
    boolean healthy = false;
    try {
        ensureDirectory(c, dir);          // 用局部 c，绝不触碰实例字段
        c.changeWorkingDirectory(dir);
        healthy = c.storeFile(fileName, in);
        return ...;
    } finally {
        if (healthy) pool.returnObject(c);
        else pool.invalidateObject(c);    // 状态不可信就丢弃
    }
}
```

**禁止事项**：

- 禁止保留任何 `private FTPClient` 字段
- 禁止用 `synchronized` 兜底（假修复，且把全部传输串行化）
- 禁止在共享 `config` 对象上写值

### 两个必须处理的细节

**1. `reconnectIfNeeded()` 删除后的自愈责任转移**

现有实现靠 `sendNoOp()` 探测 + 重连自愈。换成池之后自愈责任转移给池：

- `testWhileIdle=true` + `minEvictableIdleTimeMillis=30000` 后台淘汰死连接
- `validateObject` 必须做真实探测（`sendNoOp()` + 2xx 判定），**不能返回恒 `true`**
- 若 `validateObject` 恒为 true，长时间空闲后的首次上传会失败，且表现为普通上传失败而非自动恢复

**2. `resolveMode()` 的副作用必须消除但不能变行为**

现有代码在 FTPS + Active 时执行 `config.setMode(FtpMode.Passive.name())`，**写回共享 config 对象**。
池化后 config 被所有连接共享，必须改为局部变量；但**行为结果不能变** —— FTPS 仍必须是 Passive（见 A9）。

### 验收标准

| # | 验收项 | 判定方式 |
|---|---|---|
| A1 | 8 线程并发上传到 8 个不同目录，全部落到正确目录 | 新测试 `FTPFileClientConcurrencyTest`，断言 CWD 序列与文件落点 |
| A2 | 并发时无串目录、无 550 | 同上，路径与内容一一对应 |
| A3 | 池耗尽按 `maxWaitMillis` 超时并抛可重试异常 | `maxTotal=1` 双线程，第二线程 5s 失败 |
| A4 | 传输异常 → 连接被 invalidate，下次 borrow 可新建 | 模拟 `storeFile` 抛 `IOException` |
| A5 | 单线程上传/下载/删除行为不变 | 现有 file 模块测试全绿 |
| A6 | 不存在 `private FTPClient client` 字段 | `grep` 校验 |
| A7 | **现有图片库上传不回归**：经 `/basics/base/file` 上传头像、图片库图片、编辑器插图各一次，全部成功且 `basics_file` 记录正确 | 手工/集成回归，走 `FTPFileClient` |
| A8 | **断线自愈不退化**：空闲超过 NAS timeout 后首次操作仍成功 | 断开 NAS 连接等待超时再上传，断言自动重连成功 |
| A9 | **FTPS 强制 Passive 逻辑不变**：`sslEnable=true` + Active 配置仍被强制改为 Passive | 单测断言 `config.getMode()` 行为与改造前一致 |

---

## T1b · `DefaultFileClientFactory` 资源生命周期 ⭐P0（新增）✅ **已完成**

> 实现：`AbstractFileClient.doDestroy()` 钩子 + `refresh()` 先销毁后重建 +
> `removeFileClient()` 释放客户端。

**模块**：`note-basics/note-base-file`  
**估时**：0.5d  
**依赖**：T1  
**为什么单列**：这是**所有文件上传共用**的工厂，池泄漏会波及图片库，且不会立刻报错——
它表现为运行数天后 NAS 连接数累积触顶，然后所有上传开始失败。

### 问题定位

```java
// AbstractFileClient.refresh() —— 现有实现
public final void refresh(C config) {
    if (this.config.equals(config)) return;
    this.config = config;
    this.init();          // ← 再跑一次 doInit()，T1 之后就是【再建一个新池】
}

// DefaultFileClientFactory
} else {
    client.refresh(typedConfig);   // 旧池从未关闭
}
```

改造前 `doInit()` 只是重连一个 `FTPClient`，旧连接被覆盖后自然回收；
**改造后 `doInit()` 会 new 一个池，旧池里的连接没有任何人会关闭**。
此外 `removeFileClient()` 仅 `clients.remove(configId)`，同样不释放池。

### 改动清单

| 文件 | 改动 |
|---|---|
| `core/client/AbstractFileClient.java` | 新增 `protected void doDestroy() {}` 钩子；`refresh()` 在 `init()` 之前调用 `doDestroy()` |
| `core/client/ftp/FTPFileClient.java` | 覆写 `doDestroy()`：`pool.close()` |
| `core/client/DefaultFileClientFactory.java:60` | `removeFileClient()` 中先 `getFileClient(configId).doDestroy()` 再 `clients.remove()` |
| `core/client/AbstractFileClient.java` | `doDestroy()` 声明为 `protected`，只允许工厂调用 |

### 验收标准

| # | 验收项 | 判定方式 |
|---|---|---|
| A10 | 连续 `refresh()` 20 次后，池中连接数不增长 | 用 mock `FTPClient` 统计 `connect()`/`disconnect()` 次数 |
| A11 | `removeFileClient()` 后原池已关闭，再次获取会新建 | 单测 |
| A12 | `refresh()` 后首个请求使用新配置（如换了 FTP 主机） | 单测断言新 host 被连接 |
| A13 | 图片库功能在连续修改文件配置 10 次后仍正常上传 | 集成回归 |

---

## T2 · 数据库迁移 V20 ⭐P0

**模块**：`note-admin`（migration）、`script/sql`  
**估时**：0.5d  
**定位**：第一个合入的代码任务

### 改动清单

| 文件 | 改动 |
|---|---|
| `db/migration/mysql/V20__vault_sync_v2.sql` | **新建** |
| `db/migration/postgresql/V20__vault_sync_v2.sql` | **新建** |
| `db/migration/mysql/V20a__file_config_purpose.sql` | **新建** |
| `db/migration/postgresql/V20a__file_config_purpose.sql` | **新建** |
| `db/migration/{mysql,postgresql}/V18__vault_sync_tables.sql` | 删除 `vault_file_blob` 建表语句 |
| `script/sql/notes2.sql` | 同步删除 blob 建表 |

### V20 内容（顺序即依赖）

```sql
-- 1) 笔记/config 正文落列（D6，必须先于删表）
ALTER TABLE vault_file ADD COLUMN content mediumtext NULL
    COMMENT 'note/config 正文（asset 为 NULL）';

-- 2) 建 vault_asset_ref（见设计 §4.2）
CREATE TABLE IF NOT EXISTS vault_asset_ref ( ... );

-- 3) 删除内容寻址 blob 表（D4）
DROP TABLE IF EXISTS vault_file_blob;
```

> **postgresql 差异**：`mediumtext` → `text`；`bigint(20)` → `bigint`；去掉 `ENGINE=InnoDB`；注释用 `COMMENT ON COLUMN`。

### 验收标准

| # | 验收项 | 判定方式 |
|---|---|---|
| B1 | 全新库跑通全量迁移，`vault_file.content` 与 `vault_asset_ref` 存在 | `flyway clean && migrate` 后查 `information_schema` |
| B2 | `vault_file_blob` 已不存在 | 同上，返回空 |
| B3 | mysql / postgresql 两套语义一致 | Code Review 对比 |
| B4 | `notes2.sql` 与迁移不冲突 | 用 `notes2.sql` 建库后再跑迁移，无重复建表报错 |
| B5 | 迁移前后 `vault_file` 行数不变 | `SELECT COUNT(*)` 对比 |

---

## T3 · `FileClient` 流式能力 ⭐P0

**模块**：`note-basics/note-base-file`  
**估时**：1.5d  
**依赖**：T1（同一文件，必须在其之后）

### 改动清单

| 文件 | 改动 |
|---|---|
| `core/client/FileClient.java` | 新增两个 `default` 方法，不破坏现有 5 个实现 |
| `core/client/ftp/FTPFileClient.java` | 覆写：`storeFile(name, in)` / `retrieveFile(name, out)`；偏移用 `setRestartOffset` |
| `core/client/local/LocalFileClient.java` | 覆写：`Files.copy(in, path)` / `RandomAccessFile.seek + transferTo` |
| `core/client/s3/S3FileClient.java` | 覆写：`client.upload(path, InputStream)` / `client.download(key, out)` |
| `core/client/sftp/SFTPFileClient.java` | 可选覆写 |
| `core/client/db/DBFileClient.java` | 不覆写（走 default 兜底） |

### 接口形态

```java
default FileUploadResult uploadStream(InputStream in, long size, String path, String type) throws Exception {
    return upload(IoUtil.readBytes(in), path, type);   // 兜底
}

default void getContentStream(String path, long offset, long length, OutputStream out) throws Exception {
    out.write(getContent(path));                        // 兜底
}
```

### 验收标准

| # | 验收项 | 判定方式 |
|---|---|---|
| C1 | FTP 上传 25MB 流不构造完整 `byte[]` | `MemoryMXBean` 前后堆差 < 8MB |
| C2 | FTP 从 offset=1000 读 2048 字节内容正确 | 逐字节比对 |
| C3 | Local 流式拷贝字节一致 | 同上 |
| C4 | S3 覆写生效，不走 default 兜底 | spy 验证 `getContent` 未被调用 |
| C5 | 未覆写的 `DBFileClient` 仍可工作 | 功能测试 |
| C6 | file 模块现有单测全绿 | `mvn -pl .../note-base-file test` |
| C7 | **offset+length 超出文件末尾时返回剩余部分，不抛异常** | 对 Local 与 FTP 各测一次：文件 1000 字节，读 offset=800,length=500 |
| C8 | **开发环境图片库预览不回归**（Local 后端） | 手工回归：图片库列表 → 预览大图 |

---

## T4 · `vault_asset_ref` 领域层 ⭐P0

**模块**：`note-vault-sync`  
**估时**：0.5d  
**依赖**：T2

### 改动清单

| 文件 | 改动 |
|---|---|
| `domain/VaultAssetRef.java` | **新建**（fileId/assetId/vaultId/sha256/sizeBytes/mimeType/storageKey/backend/createTime） |
| `mapper/VaultAssetRefMapper.java` | **新建**，`extends BaseMapper<VaultAssetRef>` |
| `domain/VaultFileBlob.java` | **删除**（D4） |
| `mapper/VaultFileBlobMapper.java` | **删除**（D4） |
| `domain/VaultFile.java` | 新增 `content` 字段；确保**列表查询不 select content** |

### 验收标准

| # | 验收项 | 判定方式 |
|---|---|---|
| D1 | `VaultAssetRef` 可按 fileId 插入/查询 | 新测试 `VaultAssetRefMapperTest` |
| D2 | `uk_vault_asset_ref_hash` 生效 | 重复 (vault_id, sha256) 插入抛唯一约束异常 |
| D3 | `VaultFileBlob*` 已无引用 | 全仓 `grep` 仅剩迁移脚本 |
| D4 | `VaultFile.content` 可读写 | 新测试 |
| D5 | manifest 查询 SQL 不含 `content` 列 | 打印 SQL 或注解断言 |

---

## T5 · `VaultAssetStorage` SPI + 实现 ⭐P0

**模块**：`note-vault-sync`（接口）、`note-basics/note-admin-file`（实现）  
**估时**：1.5d  
**依赖**：T2、T3

### 改动清单

| 文件 | 改动 |
|---|---|
| `note-vault-sync/.../service/VaultAssetStorage.java` | **新建** SPI，所有方法带 `configId`（设计 §4.3） |
| `note-vault-sync/.../service/model/{StoredObject,PresignedUrl,ByteRange,Capability}.java` | **新建** |
| `note-base-file/.../enums/FileConfigPurpose.java` | **新建** `GENERIC / VAULT_ASSET` |
| `note-base-file/.../service/IFileConfigService.java` | 新增 `getByPurpose(FileConfigPurpose)` |
| `note-base-file/.../service/impl/FileConfigServiceImpl.java` | 实现，按 `purpose` 查唯一启用项 |
| `note-admin-file/.../BasicsFileVaultAssetStorage.java` | **新建** SPI 实现 |
| `note-vault-sync/.../VaultAssetServiceImpl.java` | 注入 `ObjectProvider<VaultAssetStorage>` |

### 验收标准

| # | 验收项 | 判定方式 |
|---|---|---|
| E1 | `getByPurpose(VAULT_ASSET)` 返回对应配置 | 新测试 |
| E2 | 无 `VAULT_ASSET` 配置时应用可启动，附件接口返回 503 | 新测试 |
| E3 | `presign` 对 FTP 后端返回 `Optional.empty()` | 新测试 |
| E4 | `presign` 对私有 S3 返回非空 URL | 新测试 |
| E5 | `store` 落在 `targetConfigId()` 对应配置 | 断言 `basics_file.config_id` |
| E6 | 读取严格按传入 configId，不读主配置 | 主配置设为另一条，断言仍读对 |
| E7 | 同一 purpose 两条启用配置 → 明确报错 | 新测试 |
| E8 | **`getMasterFileClient()` 实现零改动**：仍取 `master=true` 那条，与 `purpose` 无关 | `git diff` 不含该方法；新测试断言两者选路互不影响 |
| E9 | 存在 `VAULT_ASSET` 配置时，图片库仍走 `GENERIC`/master 配置 | 新测试 |

---

## T6 · 服务端 `VaultSyncServiceImpl` 改造 ⭐P0

**模块**：`note-vault-sync`  
**估时**：2d  
**依赖**：T4、T5

### 改动清单

| 位置 | 改动 |
|---|---|
| `VaultFilePutBo` | 新增 `AssetRef asset`；**删除 `base64Body`**（D5） |
| `putFileInternal()` | 按 type 分叉：asset 校验归属 + sha256 → 写 `vault_file` + `vault_asset_ref`；note/config 写 `file.content` |
| `ensureBlob()` | **删除** |
| `decodeBody()` | 删除 base64 分支，只留 `body` |
| `getContent()` | note/config 读 `file.content`；asset 查 ref → 拼 `download` 描述 |
| `deleteFile()` | 删 ref → 引用归零才 `storage.delete(configId, key)` |
| `appendChange()` | 附件变更补 `assetId/sizeBytes/mimeType` |
| 构造器 | 去掉 `blobMapper` 参数 |
| `VaultErrorCodes` | 新增 `ASSET_REQUIRED = "vault.asset.required"` |

### 验收标准

| # | 验收项 | 判定方式 |
|---|---|---|
| F1 | `type=asset` 无 `asset` → 400 `vault.asset.required` | `VaultSyncPutBatchTest` 新用例 |
| F2 | `type=asset` 带 `base64Body` → 同样 400 | 同上 |
| F3 | `type=asset` + 合法 `asset` → file 1 行 + ref 1 行 | 新用例 |
| F4 | `type=note` + `body` → `file.content` 落库，无 ref 行 | 新用例 |
| F5 | `type=note` 读取不调用存储层 | `verify(storage, never())` |
| F6 | `type=asset` 读取返回 `download{...}`，`body == null` | 新用例 |
| F7 | assetId 属于其他用户 → 403 | 新用例 |
| F8 | 删除最后一个引用才调 `storage.delete` | 新用例 |
| F9 | sha256 不符 → 409，零写入 | 沿用现有用例 |
| F10 | 去 blob mock 后现有测试全绿 | `mvn -pl note-modules/note-vault-sync test` |

---

## T7 · 附件端点 `VaultAssetController` ⭐P0

**模块**：`note-vault-sync`  
**估时**：2d  
**依赖**：T5、T6

### 接口清单

| 接口 | 说明 |
|---|---|
| `POST /vault/v1/vaults/{vaultId}/assets` | multipart；流式 sha256；去重；返回 `{assetId, contentHash, sizeBytes, deduped}` |
| `GET /vault/v1/vaults/{vaultId}/assets/{assetId}/content` | `@SaCheckLogin` 三方归属校验；流式；支持 `Range` |
| `POST /vault/v1/vaults/{vaultId}/assets/presign`（P2） | 批量取下载地址 |
| `VaultQuotaVo` | 增加 `assetStorage { backend, directDownload, maxFileBytes, maxConcurrentUploads }` |

### 关键约束

- 上传：`file.getInputStream()` 直传 `storage.store(...)`，**禁止 `IoUtil.readBytes`**
- 下载：`storage.streamTo(..., resp.getOutputStream())`，**禁止 `byte[]`**
- 归属：`vault_id + user_id + asset_id` 三者同时匹配，缺一即 403/404
- 上限 25MB，与 `VaultQuotaRules.DEFAULT_MAX_FILE_BYTES` 一致

### 验收标准

| # | 验收项 | 判定方式 |
|---|---|---|
| G1 | 上传 25MB 堆增量 < 8MB | `MemoryMXBean` |
| G2 | 同内容二次上传 → `deduped=true`，`basics_file` 仍 1 行 | 集成测试 |
| G3 | 声明 sha256 不符 → 409 | 集成测试 |
| G4 | 跨用户读 content → 403 | 集成测试 |
| G5 | `Range: bytes=1000-3047` → 206 + 正确 `Content-Range` | 集成测试 |
| G6 | 无 Range → 200 + 完整 `Content-Length` | 集成测试 |
| G7 | 超 25MB → 413 | 集成测试 |
| G8 | 配额不足 → 402 | 集成测试 |
| G9 | 能力位随配置变化（FTP→proxy、S3→direct） | 新用例 |

---

## T8 · 客户端同步引擎 ⭐P0

**模块**：`v5notes-vault-client`  
**估时**：3d  
**依赖**：T7

### 改动清单

| 文件 | 改动 |
|---|---|
| `src/sync/api.ts` | 新增 `uploadAsset()`（multipart）；`putFile` 增加 `asset`；解析 `download` 描述；`vault.asset.required` 归为不可重试 |
| `src/sync/types.ts` | `VaultFileContent` 增加 `download`；`LocalScanFile` 增加 `mime` |
| `src/sync/engine.ts:216-230` | asset 扫描不再预编码 base64，只保留 `readBytes` 算 hash |
| `src/sync/engine.ts:337-360` | `pushOne`：asset → `uploadAsset` → `putFile({asset})` |
| `src/sync/engine.ts:404-518` | `applyRemoteUpsert`：`download` 分支下载；删除 `isBinary` 分支 |
| `src/sync/download.ts` | **新建**：`.part` + Range 断点续传 + sha256 校验 + 原子 rename |
| `src/sync/attachments.ts` | 删除同步用途的 base64 编解码（**保留**给 data URL 的 `bytesToBase64`） |

### 验收标准

| # | 验收项 | 判定方式 |
|---|---|---|
| H1 | asset 推送顺序 `uploadAsset` → `putFile`，且 `putFile` 无 `base64Body` | `engine.test.ts` spy 顺序 |
| H2 | `uploadAsset` 失败 → 重试队列 kind=`asset-upload` | 新用例 |
| H3 | `putFile` 409 → 冲突副本，不重复 `uploadAsset` | 新用例 |
| H4 | proxy 下载带 `Authorization` 头 | 新用例 |
| H5 | 中断后发 `Range`，最终 sha256 一致 | 新用例 |
| H6 | 校验失败 → 删 `.part`，重试 2 次 | 新用例 |
| H7 | 同时最多 2 个附件请求在途 | 并发计数 |
| H8 | `vault.asset.required` 不进重试队列 | 新用例 |
| H9 | note 推送路径不变 | 现有 `engine.test.ts` 全绿 |
| H10 | `pnpm test` 全绿 | CI |

---

## T9 · 清理与收尾 ⭐P0

**模块**：全仓  
**估时**：0.5d  
**依赖**：T6、T8

### 改动清单

| 项 | 动作 |
|---|---|
| `sync.assetTransport` 开关 | 若已写入则删除（D5 后无意义） |
| `sync/attachments.ts` 头注释 | 「OSS direct upload remains deferred」更新为现状 |
| 设计文档 §4.1 数据流 | 与实际实现核对一致 |

### 验收标准

| # | 验收项 | 判定方式 |
|---|---|---|
| I1 | `grep -r base64Body` 无业务代码引用 | ✅ 仅剩说明性注释 |
| I2 | `grep -r VaultFileBlob` 无引用 | ✅ 零引用 |
| I3 | 客户端 `pnpm build`（含 `vue-tsc --noEmit`）通过 | ✅ |
| I4 | 服务端全模块 `mvn test` 通过 | ✅ 45 条（vault 37 + FTP 8） |

### T9 收尾记录（2026-11-23）

| 项 | 处理 |
|---|---|
| `sync.assetTransport` 开关 | 从未引入（D5 后无意义），✅ 无需删除 |
| `sync/attachments.ts` 头注释 | 「OSS direct upload remains deferred; uses PUT + base64Body」→ 改为描述 multipart + 引用提交 |
| `base64ToBytes` | **删除**：唯一调用方是附件下载分支，已改为 `download` 描述符；测试同步改为只验证编码器 |
| `bytesToBase64` | **保留**：`vault/attachments.ts:247` 仍用它生成本地 `data:` 预览 |
| 设计文档 §4.1 数据流 | 与实际实现对齐：`vault_change` 不携带 `assetId`，并补「实现修正」说明 |
| `VaultChangeVo` | 保持原样，未加三列；理由见设计文档 §4.1 修正说明 |

---

## T10 · E2E 与压测 ⭐P1

**估时**：1.5d  
**依赖**：T9

| # | 场景 | 通过标准 |
|---|---|---|
| J1 | 25MB PDF（FTP 后端）上传 → 另一设备拉取 | sha256 一致，耗时 < 30s |
| J2 | 断网 30s 恢复 | 不丢、不重复上传（`basics_file` 只 1 行） |
| J3 | 两设备同时改同一附件 | 冲突副本产生，均可打开 |
| J4 | 1000 个小附件首轮同步 | 全部成功 |
| J5 | NAS 连接计数观测 | `netstat` 统计 ≤ 8 |
| J6 | 切 S3 后历史附件仍可读 | 老附件 proxy、新附件 direct |

---

## 11. 排期建议

| 阶段 | 任务 | 并行度 | 周期 |
|---|---|---|---|
| 第 1 周 | T2、T1 | 可并行（不同模块） | 2.5d |
| 第 1 周末 | T1b、T3 | 串在 T1 之后 | 2d |
| 第 2 周 | T4 → T5 → T6 | 部分串行 | 4d |
| 第 3 周 | T7 → T8 | 串行 | 5d |
| 第 3 周末 | T9 | — | 0.5d |
| 第 4 周 | T10 | — | 1.5d |

**关键路径**：T2 → T4 → T6 → T7 → T8 → T9 → T10 ≈ 11d  
**含并行压缩后总计**：约 **15.5 个工作日**（T1b 新增 0.5d）。

### 实施进度（2026-11-23）

| 任务 | 状态 | 验证 |
|---|---|---|
| T1 FTP 连接池 | ✅ 完成 | `FTPFileClientConcurrencyTest` 8 条（并发独占连接、池耗尽等待、失效不复用、关闭释放） |
| T1b 池生命周期 | ✅ 完成 | `AbstractFileClient.doDestroy` + `refresh` 先销毁 + `removeFileClient` 释放 |
| T2 迁移 V20/V20a | ✅ 完成 | mysql/postgresql 双份；全量迁移可跑通 |
| T3 流式能力 | ✅ 完成 | FTP(REST) / Local(seek) / S3 覆写；default 兜底 |
| T4 `vault_asset_ref` | ✅ 完成 | `VaultAssetUploadTest` |
| T5 SPI + 实现 | ✅ 完成 | `getByPurpose`；`getMasterFileClient` 零改动 |
| T6 同步服务改造 | ✅ 完成 | `VaultSyncContentTest` 2 条 + 既有 17 条回归 |
| T7 附件端点 | ✅ 完成 | `VaultAssetRangeTest` 7 条（Range 解析全覆盖） |
| T8 客户端引擎 | ✅ 完成 | `download.test.ts` 7 条；客户端 333 条全绿 |
| T9 清理收尾 | ✅ 完成 | 见 §T9 收尾记录：`base64ToBytes` 死代码删除、`attachments.ts` 头注释更新、设计文档 §4.1 与实现对齐 |
| T10 E2E 与压测 | ⏳ 待做 | 需真实 NAS / FTP 环境 |

**已知未覆盖**：`VaultAssetController` 的 Spring 层集成测试（需启动上下文），当前仅有 Range 解析单测与归属校验的逻辑覆盖。

---

## 12. 分工建议

| 角色 | 负责 |
|---|---|
| 服务端 A（存储层） | T1、T1b、T3（同一人，改动同一批文件） |
| 服务端 B（同步层） | T2、T4、T5、T6、T7 |
| 客户端 | T8 |
| 联调 | T9、T10 |

> **T1/T1b/T3 必须同一个人或严格先后**：三者都改 `note-base-file` 的同一批方法（`upload`/`getContent`/`doInit`/`refresh`），并行改动必然冲突。

---

## 13. 前置确认（阻塞项）

| 项 | 状态 | 影响 |
|---|---|---|
| NAS 每账号连接上限 | **待确认** | 若 < 8，T1 的 `maxTotal` 需下调，否则频繁 borrow 超时 |
| `purpose=VAULT_ASSET` 配置行 | **需先手工创建** | 否则 `getByPurpose` 返回空，附件上传走 503 分支 |
| 开发库是否有历史数据 | 待确认 | 若有 blob 数据，T2 的 `DROP TABLE` 会丢数据（设计假设无） |
