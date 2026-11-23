# T10 · E2E 与压测验收清单

- 版本：v1.0（2026-11-23）
- 依据：[实施任务包](./vault-attachment-implementation-tasks.md) 的 T10、[设计文档](./vault-attachment-file-api-design.md) v2.3
- 前置：T1–T9 已合并（服务端 45 条测试、客户端 333 条测试已通过）

> 这份清单验证**单元测试覆盖不到的东西**：真实 FTP/NAS 的并发行为、25MB 大文件的流式传输、断网恢复、以及图片库没有被 FTP 池化改造打坏。

---

## 0. 环境准备

### 0.1 需要的东西

| 项 | 要求 | 用途 |
|---|---|---|
| FTP/FTPS 服务器 | NAS 或 vsftpd，路径含中文更好 | 复现生产配置 |
| 两个客户端设备 | 同一账号，不同机器（或两个不同的库目录） | 双向同步与冲突 |
| 数据库 | MySQL 或 PostgreSQL，跑过全部 Flyway 迁移 | 验证 V20/V20a |
| 一把能限速/断网的工具 | 如 Chrome DevTools 的 Offline、`tc`，或直接拔网线 | J2 |

### 0.2 建配置：`purpose=VAULT_ASSET`

附件必须走**独立配置**，否则 `getByPurpose` 返回空、附件上传直接 503。

> **前提**：`basics_file_config.purpose` 列由迁移 `V20a__file_config_purpose.sql` 添加。
> `script/sql/notes2.sql` 是早期基线，**不含** `purpose` 列。请先确认 Flyway 已跑到 V20a：
>
> ```sql
> SELECT column_name FROM information_schema.columns
> WHERE table_name = 'basics_file_config' AND column_name = 'purpose';  -- 必须返回 1 行
> ```
> 若返回空，说明迁移未执行，先跑 Flyway 再继续。

```sql
-- 先看现有配置
SELECT id, name, purpose, storage, master FROM basics_file_config;

-- 新建附件专用配置（storage: 100本地 101数据库 102FTP 103SFTP 104S3）
-- 注意：GENERIC 是图片库/头像在用的，不要改它
INSERT INTO basics_file_config (id, name, purpose, storage, master, config)
VALUES (<雪花ID>, 'Vault 附件存储', 'VAULT_ASSET', 102, 1,
        '{"basePath":"/共享目录/v5notes_vault_asset/","domain":"https://<你的域名>","host":"<nas>","port":21,"username":"<账号>","password":"<密码>","mode":"Passive","sslEnable":false,"charset":"UTF-8"}');
```

**检查点 S0**：

- [ ] `SELECT purpose, COUNT(*) FROM basics_file_config GROUP BY purpose;` —— `VAULT_ASSET` 恰好 1 条
- [ ] 图片库仍在用的那条 `GENERIC` 配置**未被修改**（记下它的 `id`，后面要对比）
- [ ] FTP 账号能在 NAS 上手动创建 `/共享目录/v5notes_vault_asset/`

### 0.3 准备测试原料

```bash
# 25MB 文件（正好卡在上限）
dd if=/dev/urandom of=/tmp/big-25mb.pdf bs=1M count=25

# 超限文件（26MB，必须被拒）
dd if=/dev/urandom of=/tmp/too-big.pdf bs=1M count=26

# 一张小图
printf 'PNG-FAKE-CONTENT' > /tmp/a.png

# 校验和
shasum -a 256 /tmp/big-25mb.pdf /tmp/a.png
```

---

## 1. J1 · 25MB 附件经 FTP 往返

**目的**：验证流式传输（不 OOM、不超时）+ sha256 一致。这是 proxy 模式最典型的路径。

### 步骤

1. 设备 A 启动客户端，登录，打开库目录，往 `attachments/` 放入 `/tmp/big-25mb.pdf`
2. 等待同步状态显示「同步完成」
3. 设备 B 登录同一账号、绑定同一云端库，等待拉取完成

### 判定

| # | 检查 | 通过标准 |
|---|---|---|
| J1-1 | A 端同步完成 | 无「超限跳过」角标；状态为 idle |
| J1-2 | B 端文件落地 | `attachments/big-25mb.pdf` 存在且大小 **26214400** 字节 |
| J1-3 | 字节一致 | `shasum -a 256` 与 A 端相同 |
| J1-4 | 服务端只存一份 | 见下方 SQL，`basics_file` 只 1 行 |
| J1-5 | 耗时合理 | 局域网 < 30s；记录实测值 |
| J1-6 | 服务端内存 | 上传期间 JVM 堆无异常尖峰（`jstat -gc` 或监控面板） |

```sql
-- J1-4 验证：vault_file 有引用，basics_file 只有一份对象
SELECT vf.id, vf.path, vf.file_type, vf.size_bytes, ref.asset_id, ref.backend, ref.config_id
FROM vault_file vf
JOIN vault_asset_ref ref ON ref.file_id = vf.id
WHERE vf.path LIKE '%big-25mb.pdf';
-- 期望：file_type='asset'，size_bytes=26214400，backend='ftp'
```

> ⚠️ **已知限制**：`BasicsFileVaultAssetStorage.store()` 目前用 `content.readAllBytes()`。25MB 单文件没问题，但**并发上传 N 个 25MB 会占用 N×25MB 堆**。J4 会暴露这一点。

---

## 2. J2 · 断网 30 秒恢复

**目的**：验证重试队列 + 幂等（不重复上传、不丢文件）。

### 步骤

1. A 端放入 `/tmp/a.png` 到 `attachments/`
2. **立即断网**（或 DevTools → Offline），保持 30 秒
3. 观察客户端状态变为「网络不可用 / 重试中」
4. 恢复网络，等待自动重试

### 判定

| # | 检查 | 通过标准 |
|---|---|---|
| J2-1 | 断网时状态正确 | 显示 offline 或 retrying，**不是** error |
| J2-2 | 恢复后同步完成 | 状态回到 idle |
| J2-3 | 不丢文件 | B 端收到 `a.png` |
| J2-4 | **不重复上传** | 见下方 SQL，`basics_file` 该对象只 1 行、`vault_asset_ref` 只 1 行 |

```sql
-- J2-4 验证：同一个 sha256 只应产生一个对象
SELECT sha256, COUNT(*) AS ref_count FROM vault_asset_ref GROUP BY sha256 HAVING COUNT(*) > 1;
-- 期望：空结果（同一库内 sha256 唯一索引已保证）

SELECT COUNT(*) FROM basics_file WHERE path LIKE '%/vault/%' AND name LIKE '%a.png%';
-- 期望：1（去重生效）
```

> 断网期间 `uploadAsset` 已成功、但 `putFile` 未提交的情况，是设计里明确允许的「孤儿对象」。重试时会被 `deduped:true` 短路。

---

## 3. J3 · 两设备同时改同一附件

**目的**：验证冲突副本机制对附件同样生效。

### 步骤

1. A、B 两端都同步到包含 `attachments/a.png` 的状态
2. **两端同时**（间隔 < 5 秒）用不同的内容覆盖 `a.png`
3. 两端各自触发同步
4. 再次同步，直到两端都 idle

### 判定

| # | 检查 | 通过标准 |
|---|---|---|
| J3-1 | 产生冲突副本 | 出现 `a 冲突 xxx.png` 一类文件 |
| J3-2 | 两份都能打开 | 内容分别等于 A 和 B 的修改 |
| J3-3 | 主文件不丢 | `a.png` 存在 |
| J3-4 | 无静默覆盖 | 不存在「一端内容凭空消失」 |

---

## 4. J4 · 1000 个小附件首轮同步

**目的**：验证 FTP 连接池上限 8 不被突破，且不会因池耗尽而大面积失败。

### 步骤

```bash
# 生成 1000 个 1KB 小文件
mkdir -p /tmp/many/attachments
for i in $(seq 1 1000); do head -c 1024 /dev/urandom > /tmp/many/attachments/f$i.bin; done
# 复制到一个全新的库目录后绑定同步
```

### 观测（关键）

同步**进行中**，在服务端机器上持续采样：

```bash
# 每 2 秒采样一次 FTP 连接数
while true; do
  echo "$(date +%T) ftp_conns=$(netstat -an | grep -c ':21 ')"
  sleep 2
done | tee /tmp/ftp_conns.log
```

### 判定

| # | 检查 | 通过标准 |
|---|---|---|
| J4-1 | 全部成功 | 1000 个文件在 B 端都拉取到 |
| J4-2 | **连接数 ≤ 8** | `grep ftp_conns /tmp/ftp_conns.log \| awk -F= '{print $2}' \| sort -n \| tail -1` ≤ 8 |
| J4-3 | NAS 未报连接超限 | NAS 日志无「too many connections」 |
| J4-4 | 无串目录 | 每个文件内容与其路径对应（抽样 20 个比对 sha256） |
| J4-5 | 内存 | 无 OOM，堆峰值记录（对照 J1 的已知限制） |

> **J4-2 是最关键的一条**。若超过 8，说明 `maxTotal` 配置未生效，或存在未归还连接的路径。

---

## 5. J5 · NAS 连接计数与断线自愈

**目的**：验证 `validateObject` 的探活真的生效（A8 的线上验证）。

### 步骤

1. 空闲客户端 10 分钟不动
2. 在 NAS 侧重启 FTP 服务（或主动踢掉连接）
3. 回到客户端，上传一个新文件

### 判定

| # | 检查 | 通过标准 |
|---|---|---|
| J5-1 | 重启后首次上传成功 | 不报错，或报错后自动重试成功 |
| J5-2 | 不影响其他功能 | 图片库同时可用 |

> 这一条如果失败，通常是 `validateObject` 没做真实探测。代码里已用 `sendNoOp()` + 回复码判定。

---

## 6. J6 · 切 S3 后历史附件仍可读

**目的**：验证「切换后端不影响旧数据」（设计 §7.4）—— 这是最容易 404 的地方。

### 步骤

1. 在 J1 完成后的库基础上，记录历史附件的 `config_id`（以下称「旧配置」）
2. 新建一条 `purpose='VAULT_ASSET', storage=104(S3)` 的配置（称「新配置」）
3. **把旧配置的 `purpose` 改成 `'VAULT_ASSET_OLD'`**，让 `VAULT_ASSET` 只指向新配置
4. 重启服务
5. 上传一个**新**附件
6. 在另一端拉取**旧**附件

> ⚠️ 第 3 步必须改 `purpose`：`getByPurpose` 要求同一用途只有一条记录，两条都叫 `VAULT_ASSET` 会直接 503。
> 但**不要**改旧配置的 `id` —— `basics_file.config_id` 仍然指向它，读取时就靠它回到 FTP。

### 判定

| # | 检查 | 通过标准 |
|---|---|---|
| J6-1 | 新附件写 S3 | `vault_asset_ref.backend='s3'`，`config_id` 为新配置 |
| J6-2 | **旧附件仍可读** | 旧附件下载成功，`config_id` 仍是旧值 |
| J6-3 | 能力位刷新 | `GET /vault/v1/quota` 的 `assetStorage.directDownload` 变为 `true` |
| J6-4 | 客户端无需发版 | 客户端自动走 direct 下载 |

```sql
-- J6 验证：按 config_id 分组，新旧应各自有数据
SELECT config_id, backend, COUNT(*) AS refs
FROM vault_asset_ref
GROUP BY config_id, backend
ORDER BY config_id;
-- 期望：至少两行 —— 旧配置那行 backend='ftp'，新配置那行 backend='s3'

-- 历史附件的写入配置必须仍是旧值
SELECT COUNT(*) FROM vault_asset_ref WHERE config_id = <旧配置ID>;
-- 期望：等于 J1/J2 期间产生的附件数量，不应为 0
```

---

## 7. 回归：图片库 / 头像 / 编辑器插图（**必做**）

**为什么要单独列**：T1 把 `FTPFileClient` 从单连接改成了连接池，这是**图片库、头像、编辑器插图共用的同一个类**。单元测试只能证明并发正确，证明不了端到端可用。

> 对应任务包的 A7 / A9 / C8。

| # | 场景 | 操作 | 通过标准 |
|---|---|---|---|
| R1 | 图片库上传 | 客户端2 打开图片库 → 上传 | 上传成功，列表出现该图，缩略图可见 |
| R2 | 头像上传 | 个人设置 → 换头像 | 成功，头像刷新 |
| R3 | 编辑器插图 | 插入图片 → 选本地文件 | 成功，正文显示图片 |
| R4 | 图片库预览 | 点开大图 | 正常显示，不 404 |
| R5 | 管理端文件列表 | admin → 文件配置 → 列表 | 能看到 R1/R2/R3 上传的记录 |
| R6 | **配置选路未变** | 对比 §0.2 记下的 `GENERIC` 配置 id | 图片库记录的 `config_id` 仍等于它，**没有被 VAULT_ASSET 抢走** |
| R7 | 连续改配置 | 管理端连续保存文件配置 10 次后上传 | 仍能正常上传（验证 T1b 池泄漏修复） |

**R6 和 R7 是本轮最容易漏的两条**：

- R6 验证 `getMasterFileClient()` 没被改动（任务包 E8）
- R7 验证 `refresh()` 会先销毁旧池（T1b A10–A13）

---

## 8. 错误路径（负向测试）

| # | 操作 | 期望 |
|---|---|---|
| N1 | 上传 26MB 文件 | 客户端显示「超过单文件上限（25MB），已跳过同步」；服务端 413 `vault.file.too.large` |
| N2 | 手工调 `PUT /files` 传 `type=asset` 但无 `asset` 字段 | 400 `vault.asset.required`，**且不进重试队列** |
| N3 | 用 A 账号的 `assetId` 去 B 账号读 `/assets/{id}/content` | 403 或 404 `vault.asset.not.found` |
| N4 | 停掉 FTP 服务后上传 | 503 `vault.asset.storage-unavailable`，进重试队列 |
| N5 | 声明错误的 `sha256` 上传 | 409 `vault.hash.mismatch`，**不重试** |

手工验证 N2/N3 的 curl（把占位符换成实际值）：

```bash
TOKEN='<登录拿到的 token>'
BASE='http://<server>'
CLIENT_ID='<clientid>'
VAULT_ID='<vaultId>'

# N2：asset 类型但没有 asset 引用
curl -s -X PUT "$BASE/vault/v1/vaults/$VAULT_ID/files" \
  -H "Authorization: Bearer $TOKEN" \
  -H "clientid: $CLIENT_ID" \
  -H 'Content-Type: application/json' \
  -d '{"path":"attachments/x.png","hash":"sha256:0000000000000000000000000000000000000000000000000000000000000000","type":"asset","baseRev":0}'
# 期望：code=400，data.code = vault.asset.required

# N3：跨账号读附件
curl -s -o /dev/null -w '%{http_code}\n' \
  "$BASE/vault/v1/vaults/$VAULT_ID/assets/<他人的assetId>/content" \
  -H "Authorization: Bearer $TOKEN" -H "clientid: $CLIENT_ID"
# 期望：403 或 404
```

---

## 9. 数据库最终检查

```sql
-- 1) 旧表必须已删除
SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'vault_file_blob';
-- 期望：0

-- 2) 新表与新列存在
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'vault_file' AND column_name = 'content';          -- 期望 1
SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'vault_asset_ref';  -- 期望 1

-- 3) 附件不再有 blob，全部走引用
SELECT COUNT(*) FROM vault_file WHERE file_type='asset';
SELECT COUNT(*) FROM vault_asset_ref;
-- 期望：两个数字相等

-- 4) 笔记正文落在 content 列
SELECT id, path, CHAR_LENGTH(content) AS body_len FROM vault_file
WHERE file_type IN ('note','config') AND deleted=0 LIMIT 5;
-- 期望：body_len > 0

-- 5) 无孤儿引用
SELECT COUNT(*) FROM vault_asset_ref r
LEFT JOIN vault_file f ON f.id = r.file_id WHERE f.id IS NULL;
-- 期望：0
```

---

## 10. 结果记录表

| 用例 | 结果 | 实测值 / 备注 | 记录人 | 日期 |
|---|---|---|---|---|
| S0 配置就绪 | ☐ 通过 ☐ 失败 | | | |
| J1 25MB 往返 | ☐ 通过 ☐ 失败 | 耗时 ____ s | | |
| J2 断网恢复 | ☐ 通过 ☐ 失败 | | | |
| J3 双端冲突 | ☐ 通过 ☐ 失败 | | | |
| J4 1000 附件 | ☐ 通过 ☐ 失败 | 峰值连接数 ____ | | |
| J5 断线自愈 | ☐ 通过 ☐ 失败 | | | |
| J6 切 S3 兼容 | ☐ 通过 ☐ 失败 | | | |
| R1–R7 图片库回归 | ☐ 通过 ☐ 失败 | | | |
| N1–N5 负向路径 | ☐ 通过 ☐ 失败 | | | |
| DB 最终检查 | ☐ 通过 ☐ 失败 | | | |

**放行条件**：S0、J1–J6、R1–R7、N1–N5、DB 检查**全部通过**。任何一项失败，先修再重跑该组。

---

## 11. 已知问题与预期偏差

这些**不是**验收失败项，遇到时按这里记录即可：

| 现象 | 原因 | 处理 |
|---|---|---|
| 并发上传多个 25MB 时内存上升 | `BasicsFileVaultAssetStorage.store()` 用 `readAllBytes()` | 记录峰值；若 OOM，改流式写 basic-file 接口 |
| `pool.close()` 时仍有连接占用 | 关闭只销毁空闲连接，借出的归还时销毁 | 正常行为，非缺陷 |
| `note-common-mybatis` 的 `PageQueryTest` 失败 | **既有问题**，基线上同样失败 | 与本功能无关，忽略 |
| 切配置后旧附件仍显示 ftp 后端 | 按 `config_id` 回原后端读取，符合设计 §7.4 | 正常行为 |
