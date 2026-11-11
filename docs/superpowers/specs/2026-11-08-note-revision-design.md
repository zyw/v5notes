# 笔记版本历史设计

每次成功保存且正文发生变化时，默认追加一条不可修改的全文快照；预览勾选任务等 `skipHistory` 保存只更新最新正文，不追加版本。`note_notes.content` 继续表示最新正文。用户可以按时间查看历史、只读预览、与当前正文对比，并把某一版恢复成最新正文。恢复本身再写一条新快照，因此恢复后仍能回到恢复前的内容。

编辑器里的撤销只保留在当前这次打开中。本文档解决的是保存之后、刷新之后、或另一处已经覆盖之后，正文仍然找得回来。

本期只改 `v5notes2` 和 `v5notes-client2`。不改 `v5notes/`、`v5notes-client/`、`v5notes-admin/`。

## 范围

本期做：

- 新建 `note_revision`，保存正文全文快照。
- `note_notes` 增加当前正文的 `content_hash`。
- 客户端创建、保存、恢复都在同一事务里记版本，并按笔记保留最近 50 条。
- 客户端历史列表、版本详情、恢复。
- 保存时用正文哈希做冲突检测。冲突后可以重新加载，也可以强制覆盖；强制覆盖前先把库里的当前正文补进历史。
本期不做：

- 真正的 Git 仓库、分支、合并、提交说明。
- 按键记录，或把自动保存的每一次击键都记成版本。当前记入历史的保存点是 Ctrl+S，以及退出编辑前的那一次保存。预览勾选任务会静默保存正文，但带 `skipHistory`，不占用历史配额。
- 版本里记录标题、目录变更。改名或只改目录且正文哈希不变时，不新增版本。
- 回收站。删除后版本如何保留、何时清除，见 [笔记回收站设计](2026-11-08-note-trash-design.md)。
- 管理后台的历史界面。管理端保存仍会写版本，见「管理端」。
- 历史正文的全文搜索。搜索继续只查 `note_notes`。
- 压缩、按天合并、diff 链。对比在客户端打开两个全文后现算。
- 图片文件版本。快照只保存 Markdown 文本；正文里的图片仍是 URL。恢复旧正文不会找回已删除的文件。

## 现状

`note_notes.content` 是一篇笔记的唯一正文。客户端 `PUT /client/notes` 整篇覆盖。`NoteNotesServiceImpl.updateByBo` 直接 `updateById`，没有旧正文。

笔记 ID 是雪花 ID。Java 侧用 `Long`。Jackson 对超出 JavaScript 安全整数范围的 `Long` 序列化成字符串。客户端用 `normalizeIds` 把字段名匹配 `id`、`pid`、`*Id` 的数字收成字符串，请求和状态里不得把这些 ID 转回 `number`。

客户端响应信封是 `{ code, msg, data }`。`code !== 200` 时现有请求层抛出 `Error(msg)`。冲突要在这个层上单独识别 `code === 409`，否则调用方只能看到一句文案，拿不到当前哈希。

目录删除会递归逻辑删除子目录和笔记。笔记使用 `@TableLogic`，`del_flag = 2` 表示已删除。版本表不使用逻辑删除。

## 行为

版本行只追加，不更新。列表按 `create_time DESC, id DESC`。同一笔记的最新一条，且其 `content_hash` 等于 `note_notes.content_hash` 时，它就是当前正文对应的版本。

保存规则：

1. 正文哈希与库中当前哈希相同：只更新标题、目录等字段，不新增版本。
2. 正文哈希变了，且请求带 `skipHistory: true`（预览勾选任务等）：只更新 `note_notes` 正文与哈希，不追加、不裁剪版本。下次普通保存若发现最新版本哈希落后于当前正文，仍会先补记当前正文。
3. 正文哈希变了，且库中当前正文还没有对应版本：先把当前正文插成一条版本，再把新正文插成下一条，然后更新笔记。升级前已经存在的笔记，第一次修改时因此还能回到升级前的正文。
4. 正文哈希变了，且当前正文已经是最新版本：只追加新正文这一条，再更新笔记。

恢复规则：

1. 选中版本的哈希已经等于当前正文：不新增行，直接成功。
2. 否则先按上面的规则补记当前正文（若尚未入库），再把选中版本的正文复制为一条新版本，并写回 `note_notes`。被恢复的旧行保留不动。

创建笔记时，插入笔记行后立刻写一条初始版本，包括空正文。空正文也有确定的哈希。

每篇笔记只保留最近 50 条。条数在同一次事务的全部插入完成之后裁剪。裁剪按 `create_time DESC, id DESC` 保留前 50 条，只删除更老的行。最新正文对应的版本排在最前，不会被裁掉。常量名为 `REVISION_RETAIN_COUNT`，放在版本服务里，值为 50。

## 表设计

两张表都不用数据库外键，和现有 `note_notes`、`note_directory` 一样，归属和存在性在服务层校验。版本行不进入 MyBatis-Plus 逻辑删除。

`note_notes` 只增加一列。其余列不动。

| 列 | 类型 | 空 | 说明 |
| --- | --- | --- | --- |
| `content_hash` | `char(64)` | 允许 | 当前正文的 SHA-256，十六进制小写。`NULL` 表示尚未计算。不设默认空字符串，避免把「未计算」和某个真实哈希混在一起 |

`note_revision`：

| 列 | MySQL | PostgreSQL | 空 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `bigint(20)` | `bigint` | 否 | 主键，雪花 ID |
| `note_id` | `bigint(20)` | `bigint` | 否 | 所属笔记。逻辑上对应 `note_notes.id` |
| `user_id` | `bigint(20)` | `bigint` | 否 | 笔记所属用户，写入时从笔记行复制。查询版本前仍以笔记行的归属为准 |
| `content_hash` | `char(64)` | `char(64)` | 否 | 该快照正文的 SHA-256，十六进制小写 |
| `content` | `mediumtext` | `text` | 允许 | 全文快照。类型与 `note_notes.content` 一致。空正文存空字符串，不存 `NULL` |
| `excerpt` | `varchar(200)` | `varchar(200)` | 否 | 列表摘要。换行压成空格后取前 120 个 Unicode 码位。空正文为空字符串 |
| `size` | `int` | `integer` | 否 | 正文 UTF-8 字节数。空正文为 0。`mediumtext` 上限 16,777,215，有符号 `int` 足够 |
| `create_dept` | `bigint(20)` | `bigint` | 允许 | 与 `BaseEntity` 一致，插入时填充 |
| `create_by` | `bigint(20)` | `bigint` | 允许 | 保存人或恢复操作人 |
| `create_time` | `datetime` | `timestamp` | 否 | 版本时间。默认当前时间 |

版本行没有 `update_by`、`update_time`、`del_flag`、`name`、`dir_id`。写入之后不得更新 `content`、`content_hash`、`excerpt`、`size`。

索引：

| 名称 | 列 | 用途 |
| --- | --- | --- |
| `PRIMARY` | `id` | 按版本 ID 取详情、恢复 |
| `idx_note_revision_note_time` | `note_id, create_time, id` | 按笔记倒序列表，以及保留最近 50 条 |

不建 `(note_id, content_hash)` 唯一索引。同一次恢复会再次保存曾经出现过的正文，哈希允许重复。

`content_hash` 不需要单独索引。冲突检测先按笔记主键锁行，再比较这一列。

### MySQL

已有库走 Flyway：`v5notes2/note-admin/src/main/resources/db/migration/mysql/V6__note_revision.sql`。

```sql
ALTER TABLE note_notes
    ADD COLUMN content_hash char(64) NULL COMMENT '当前正文 SHA-256，十六进制小写。NULL 表示尚未计算' AFTER content;

CREATE TABLE note_revision
(
    id           bigint(20)  NOT NULL COMMENT '版本ID',
    note_id      bigint(20)  NOT NULL COMMENT '笔记ID',
    user_id      bigint(20)  NOT NULL COMMENT '笔记所属用户',
    content_hash char(64)    NOT NULL COMMENT '该快照正文 SHA-256，十六进制小写',
    content      mediumtext  NOT NULL COMMENT '正文全文快照',
    excerpt      varchar(200) NOT NULL DEFAULT '' COMMENT '列表摘要，最多 120 个 Unicode 码位',
    size         int         NOT NULL COMMENT '正文 UTF-8 字节数',
    create_dept  bigint(20)           DEFAULT NULL COMMENT '创建部门',
    create_by    bigint(20)           DEFAULT NULL COMMENT '创建者',
    create_time  datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '版本时间',
    PRIMARY KEY (id),
    KEY idx_note_revision_note_time (note_id, create_time, id)
) ENGINE = InnoDB COMMENT = '笔记版本';
```

`content` 在表定义里是 `NOT NULL`。服务层把 Java `null` 收成空字符串后再插入，和「空正文也占一条版本」一致。`note_notes.content` 保持原来的可空，读取时把 `null` 当成空字符串再做哈希。

全新安装还要同步 `v5notes2/script/sql/notes2.sql`，让 Docker 初始化库和 Flyway 新库结构一致。`notes2.sql` 里直接把 `content_hash` 放进 `note_notes` 建表语句，并带上 `note_revision` 建表。不要只改 Flyway、留下一份没有版本表的全量脚本。

### PostgreSQL

已有库走 Flyway：`v5notes2/note-admin/src/main/resources/db/migration/postgresql/V6__note_revision.sql`。

```sql
ALTER TABLE note_notes
    ADD COLUMN content_hash char(64);

COMMENT ON COLUMN note_notes.content_hash IS '当前正文 SHA-256，十六进制小写。NULL 表示尚未计算';

CREATE TABLE note_revision
(
    id           bigint       NOT NULL,
    note_id      bigint       NOT NULL,
    user_id      bigint       NOT NULL,
    content_hash char(64)     NOT NULL,
    content      text         NOT NULL,
    excerpt      varchar(200) NOT NULL DEFAULT '',
    size         integer      NOT NULL,
    create_dept  bigint                DEFAULT NULL,
    create_by    bigint                DEFAULT NULL,
    create_time  timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE INDEX idx_note_revision_note_time ON note_revision (note_id, create_time, id);

COMMENT ON TABLE note_revision IS '笔记版本';
COMMENT ON COLUMN note_revision.id IS '版本ID';
COMMENT ON COLUMN note_revision.note_id IS '笔记ID';
COMMENT ON COLUMN note_revision.user_id IS '笔记所属用户';
COMMENT ON COLUMN note_revision.content_hash IS '该快照正文 SHA-256，十六进制小写';
COMMENT ON COLUMN note_revision.content IS '正文全文快照';
COMMENT ON COLUMN note_revision.excerpt IS '列表摘要，最多 120 个 Unicode 码位';
COMMENT ON COLUMN note_revision.size IS '正文 UTF-8 字节数';
COMMENT ON COLUMN note_revision.create_dept IS '创建部门';
COMMENT ON COLUMN note_revision.create_by IS '创建者';
COMMENT ON COLUMN note_revision.create_time IS '版本时间';
```

不在迁移里用 `SHA2` 或 `pgcrypto` 回填历史笔记。已有正文的 `content_hash` 留 `NULL`，由应用在第一次读取或第一次保存时补上。这样迁移不锁整表做哈希，也不依赖 PostgreSQL 的摘要扩展。

## 哈希与摘要

算法是 SHA-256。输入是正文的 UTF-8 字节。`note_notes.content` 为 `null` 时按空字符串计算。输出是 64 位十六进制小写。

空字符串的哈希固定为：

```text
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

Java 计算使用 `StandardCharsets.UTF_8` 和 `MessageDigest.getInstance("SHA-256")`，再用小写十六进制编码。不得使用 `String.hashCode`、MD5，也不得在业务路径里改用数据库函数计算，避免字符集和 `NULL` 处理不一致。

`size` 是上述 UTF-8 字节数组的长度，不是 `String.length()`。

`excerpt`：把 `\r\n`、`\n`、`\r` 换成空格，再取前 120 个 Unicode 码位。不足 120 则全部保留。不做 Markdown 语法清洗。摘要只给列表看，详情和恢复都用 `content`。

客户端提交的 `baseHash` 必须是 64 位十六进制，大小写不敏感，服务端比较前收成小写。格式不对返回 `code = 400`，文案「正文版本无效」。

## 事务

版本写入和笔记更新放在同一个 `@Transactional(rollbackFor = Exception.class)` 里。任一步失败则笔记正文和版本行一起回到事务开始前。

锁行：

```sql
SELECT id, user_id, content, content_hash
FROM note_notes
WHERE id = ? AND del_flag = '0'
FOR UPDATE
```

锁不到行，或 `user_id` 不是当前登录用户，返回「无权操作该笔记」。控制器里已有的归属检查保留，服务层再查一次，避免管理端和客户端绕过其中一层。

当前哈希：`content_hash` 非空则直接用；为空则按本节规则从 `content` 计算。本次事务若更新了该笔记，把计算出的哈希写回 `content_hash`。

### 客户端保存

`PUT /client/notes` 增加三个不落库的字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `baseHash` | string | 打开笔记或上次成功保存时拿到的 `contentHash` |
| `force` | boolean | 默认 `false`。`true` 时忽略哈希不一致，仍先补记库中当前正文 |
| `skipHistory` | boolean | 默认 `false`。`true` 时只更新正文，不追加历史（预览勾选任务） |

`baseHash`、`force`、`skipHistory` 不得映射进 `NoteNotes`。请求对象和实体字段分开，避免 Mapstruct 把客户端传来的哈希写进 `content_hash`。库中的 `content_hash` 只由服务端根据正文计算。

客户端保存必须带 `baseHash`。缺省返回 `code = 400`，文案「缺少正文版本」。

处理顺序：

1. 锁笔记行并校验归属。
2. 得到 `currentHash`。
3. 用本次请求正文计算 `newHash`。`content` 为 `null` 时按空字符串。
4. `force` 不为 `true`，且 `baseHash` 与 `currentHash` 不同：不写库，返回冲突。
5. `newHash` 与 `currentHash` 相同：更新标题和目录；若 `content_hash` 原来为空则补上。不插入版本。返回 `newHash`。
6. `skipHistory` 为 `true`：更新 `note_notes.content`、`content_hash` 以及请求里的标题、目录；不插入版本、不裁剪。返回 `newHash`。
7. 若不存在版本，或最新一条的 `content_hash` 不等于 `currentHash`：插入一条当前正文的版本。
8. 插入一条新正文的版本。
9. 更新 `note_notes.content`、`content_hash`，以及请求里的标题、目录。
10. 裁剪到 50 条。
11. 返回新的 `contentHash`。

第 7 步和第 8 步都算进 50 条。一次普通保存最多新增两条。`skipHistory` 保存不新增。

裁剪在 MySQL 里要用包一层的子查询，否则不能在 `DELETE` 的子查询里直接引用正在删除的表：

```sql
DELETE FROM note_revision
WHERE note_id = ?
  AND id NOT IN (
      SELECT id FROM (
          SELECT id
          FROM note_revision
          WHERE note_id = ?
          ORDER BY create_time DESC, id DESC
          LIMIT 50
      ) kept
  );
```

PostgreSQL：

```sql
DELETE FROM note_revision
WHERE note_id = ?
  AND id NOT IN (
      SELECT id
      FROM note_revision
      WHERE note_id = ?
      ORDER BY create_time DESC, id DESC
      LIMIT 50
  );
```

### 创建

`POST /client/notes` 成功插入笔记后，在同一事务里：

1. 计算正文哈希和摘要、字节数。
2. 把 `content_hash` 写到新笔记行。
3. 插入一条初始版本。

创建请求不带 `baseHash`。返回体在现有笔记 ID 之外增加 `contentHash`，供客户端立刻当作 `baseHash`。若继续只返回 ID，客户端要在创建响应的 ID 上再读一次笔记，并使用读到的 `contentHash`。两种都可以，实现时选一种并让创建后的第一笔保存带上这个哈希。推荐创建响应改为：

```json
{ "id": "雪花ID字符串", "contentHash": "64位十六进制" }
```

这是创建接口响应形状的变化。客户端 `create` 现在把整个 `data` 交给 `asId`。实现时要改为读取 `data.id`，并保存 `data.contentHash`。

### 读取

`GET /client/notes/{id}` 的数据增加 `contentHash`。列为 `NULL` 时先算出哈希并写回，再返回。这一步失败时仍返回算出的哈希和正文，不因为补写哈希失败而让笔记打不开。补写使用单独的更新语句，只设置 `content_hash`，不改 `content` 和 `update_time`。MyBatis-Plus 的更新填充若会改 `update_time`，这里用明确列更新避开。

列表、搜索、目录树不返回 `contentHash`，也不查询 `note_revision`。

### 恢复

`POST /client/notes/{noteId}/revisions/{revisionId}/restore`

请求体：

```json
{ "baseHash": "打开或上次保存的哈希", "force": false }
```

处理顺序：

1. 锁笔记行并校验归属。版本行的 `note_id`、`user_id` 必须和这篇笔记一致。对不上返回「版本不存在」。
2. 按保存接口的同一规则检查 `baseHash`。冲突时不恢复。
3. 选中版本的哈希等于 `currentHash`：不插入，返回当前正文和 `contentHash`。
4. 需要时先补记当前正文。
5. 复制选中版本的 `content`、`content_hash`、`excerpt`、`size` 为新行。新行使用新的雪花 ID 和当前时间。
6. 写回 `note_notes.content` 和 `content_hash`。不改标题和目录。
7. 裁剪到 50 条。
8. 返回恢复后的正文和 `contentHash`。

### 删除

笔记进入回收站时保留 `note_revision`。彻底删除或回收站到期清除时，再按 `note_id` 物理删除版本。回收站的删除、恢复和清除见 [笔记回收站设计](2026-11-08-note-trash-design.md)。

## 接口

全部挂在现有 `/client/notes` 下，沿用登录态和笔记归属校验。ID 在 JSON 里按现有雪花规则出现，客户端一律当字符串。

成功时 HTTP 状态保持 200，信封 `code` 为 200。业务拒绝也保持 HTTP 200，用信封 `code` 区分。这和现有 `R` 一致。

### 保存

`PUT /client/notes`

请求在现有笔记字段上增加 `baseHash`、`force`。

成功：

```json
{
  "code": 200,
  "msg": "操作成功",
  "data": { "contentHash": "64位十六进制" }
}
```

冲突时不写库：

```json
{
  "code": 409,
  "msg": "笔记已在其他地方保存，请查看历史或重新加载后再保存",
  "data": {
    "contentHash": "库中当前正文哈希",
    "updateTime": "yyyy-MM-dd HH:mm:ss"
  }
}
```

`R` 目前没有「自定义 code 加 data」的公开方法。实现时增加一个，内部仍走现有 `restResult`。不要为了带上 data 把冲突写成 `code = 500`。

其他失败：

| code | 条件 | msg |
| --- | --- | --- |
| 400 | 客户端保存缺少 `baseHash` | 缺少正文版本 |
| 400 | `baseHash` 不是 64 位十六进制 | 正文版本无效 |
| 200 的失败码，沿用现有 `R.fail` | 笔记不存在或不属于当前用户 | 无权操作该笔记 |

现有失败码是 `HttpStatus.ERROR`（500）。权限失败保持这个现有行为，不在本期改成 403。

### 历史列表

`GET /client/notes/{noteId}/revisions?pageNum=1&pageSize=20`

`pageSize` 默认 20，最大 50。超出最大按 50。不返回 `content`。

```json
{
  "code": 200,
  "data": {
    "rows": [
      {
        "id": "版本雪花ID",
        "noteId": "笔记雪花ID",
        "contentHash": "64位十六进制",
        "excerpt": "摘要",
        "size": 128,
        "createTime": "yyyy-MM-dd HH:mm:ss",
        "head": true
      }
    ],
    "total": 3
  }
}
```

`head` 只可能出现在本页的第一条，且仅当该条是全表最新一条、并且 `contentHash` 等于笔记当前哈希。其他行为 `false`。分页第 2 页即使哈希相同，`head` 也全部为 `false`。

### 版本详情

`GET /client/notes/{noteId}/revisions/{revisionId}`

```json
{
  "code": 200,
  "data": {
    "id": "版本雪花ID",
    "noteId": "笔记雪花ID",
    "content": "全文",
    "contentHash": "64位十六进制",
    "excerpt": "摘要",
    "size": 128,
    "createTime": "yyyy-MM-dd HH:mm:ss"
  }
}
```

版本不属于这篇笔记，或笔记不属于当前用户时，返回「版本不存在」。不区分「没有这条」和「这是别人的」，避免探出其他用户的版本是否存在。

### 恢复

成功 `data`：

```json
{
  "content": "恢复后的全文",
  "contentHash": "64位十六进制",
  "updateTime": "yyyy-MM-dd HH:mm:ss"
}
```

冲突形状与保存接口相同。

### 客户端请求层

`v5notes-client2/src/service/request/index.ts` 在 `code !== 200` 的通用抛错之前识别 `code === 409`。抛出的错误要带上 `msg`、`contentHash` 和 `updateTime`，供对话框使用。其他非 200 仍按现在的方式抛 `Error(msg)`。

`Note` 增加可选的 `contentHash`。`update` 的成功结果改为 `{ contentHash: string }`。草稿在 `load` 和每次成功保存、成功恢复后记下这个值，下一次 `PUT` 作为 `baseHash` 送出。

## 客户端界面

历史是编辑区工具栏上的一个按钮，放在保存按钮附近。预览和编辑都可以打开。按钮文案为「历史」。

打开前若草稿未保存，先走现有的保存。保存成功再开历史。保存失败则留在编辑态，历史不打开。保存若返回冲突，走冲突对话框，不打开历史。

历史使用现有应用内对话框，不用 `window.alert`、`window.confirm`、`window.prompt`。

- `role="dialog"`，`aria-modal="true"`，标题「历史版本」。
- 左侧或上方是版本列表：时间、摘要、大小。当前正文对应的那一条标成「当前」。
- 选中一条后请求详情，在对话框内只读显示全文。
- 提供「与当前对比」。对比使用当前对话框里已经拿到的版本全文和笔记当前全文，在客户端做行级差异。不新增 diff 接口。差异只展示，不能在差异视图里直接改字。
- Esc 或取消关闭对话框，不修改笔记。请求失败时对话框保持打开，并在对话框内显示错误。
- 列表为空时说明这篇笔记还没有历史版本。升级后的旧笔记在第一次成功的正文保存之前就是这种空列表；那次保存会先补上旧正文。

恢复使用第二个确认对话框：

- 写明恢复到的时间。
- 写明当前正文会保留为一条历史，恢复后还能再回来。
- 取消则两个对话框的笔记状态都不变。
- 确认按钮用普通主按钮。恢复可以再撤回去，不用危险按钮样式。
- 恢复请求失败时确认框保持打开，显示服务端文案。

恢复成功后：

- 用返回的 `content` 替换当前草稿，`dirty` 为 false，`baseHash` 换成返回的 `contentHash`。
- 编辑器保持当前这次挂载，把正文写回去，不因为恢复而整页重开笔记。
- 本地 Ctrl+Z 只影响这次写回之后尚未再次保存的草稿。再次保存才会按哈希差新增版本。
- 预览态恢复后仍停留在预览，显示恢复后的正文。

冲突对话框：

- 文案使用接口返回的 `msg`。
- 「重新加载」丢弃本地未保存修改并重新 `GET` 笔记。重新加载前若有未保存修改，先用现有未保存确认，用户取消则留在编辑。
- 「仍要覆盖保存」以 `force: true` 再提交当前草稿。服务端会先把库里的正文补进历史，再写入本地这份。
- 取消则留在编辑，草稿还在。

专注模式和侧栏显隐不改变历史入口。历史对话框盖在编辑区之上。

## 管理端

`NoteNotesController` 与客户端共用笔记服务。管理端保存也要进入同一套版本事务，这样后台改正文不会绕过历史。

管理端本期没有历史界面，请求里也不带 `baseHash`。服务层对管理端保存的约定是：未传 `baseHash` 时按 `force` 处理，先补记库中当前正文，再写新正文。客户端控制器不允许走这条分支，缺少 `baseHash` 仍然是 400。

在服务方法上把两种入口分开，例如客户端方法要求 `baseHash`，管理端方法内部以强制保存调用同一事务。不要用「请求里没有 `baseHash`」这一个条件同时服务两端，否则旧的或写错的客户端会静默覆盖。

管理端本期不增加恢复接口。后台误改可以在客户端的历史里恢复。

## 代码落点

后端，均在 `v5notes2/note-modules/note-notes`：

| 位置 | 职责 |
| --- | --- |
| `domain/NoteRevision.java` | 版本实体。不使用 `@TableLogic`。不声明 `updateTime` |
| `domain/NoteNotes.java` | 增加 `contentHash` |
| `mapper/NoteRevisionMapper.java` | 插入、按笔记分页、按主键加笔记 ID 查询、按笔记删除、裁剪 |
| `service` 中的版本服务 | 哈希、摘要、补记、裁剪、恢复。笔记服务的创建、更新、删除调用它 |
| `NoteNotesServiceImpl` | 创建和更新包进版本事务。删除笔记时删除版本 |
| `NoteDirectoryServiceImpl.recursiveDelete` | 删笔记时带上版本删除 |
| `controller/client/ClientNotesController` | 列表、详情、恢复，以及保存时校验 `baseHash` |
| `controller/admin/NoteNotesController` | 保存改为强制补记路径 |
| `domain/bo`、`domain/vo` | 请求字段和返回字段。`baseHash`、`force`、`skipHistory` 只出现在客户端保存请求里 |

客户端，均在 `v5notes-client2`：

| 位置 | 职责 |
| --- | --- |
| `src/service/api/index.ts` | 类型、三个版本接口、`update` 的返回值和 `baseHash` |
| `src/service/request/index.ts` | 识别 `code === 409` |
| `src/models/draft.ts` | 记住 `contentHash`，保存时带上 |
| 编辑区工具栏与新的历史对话框 | 列表、预览、对比、恢复确认、冲突选择 |

API 路径继续只写在 `src/service/api/index.ts`。组件不拼版本 URL。

## 验收

- 连续两次保存不同正文，产生两条版本；最新一条的哈希等于笔记当前哈希，全文等于当前正文。
- 正文不变、只改标题，版本条数不变。
- 空正文创建后有一条版本，哈希等于空字符串的 SHA-256。
- 把一篇升级前的笔记改掉并保存后，历史里先有旧正文，再有新正文。恢复旧正文后，笔记内容变回旧正文，并且还能再恢复到改写后的那一版。
- 恢复到已经是当前正文的版本，不新增行。
- 第 51 次正文变化后，最老的一条被删除，当前正文仍在。一次保存若同时补记旧正文并写入新正文，两条都计入 50 条。
- 客户端 `baseHash` 过期且 `force` 不为 `true` 时，笔记正文和版本行都不变，响应 `code` 为 409，`data.contentHash` 是库中哈希。
- `force: true` 时写入本地正文，库中被盖住的正文仍能在历史里打开。
- 客户端不传 `baseHash` 返回 400，不写库。管理端保存不传 `baseHash` 仍能保存，且旧正文进入历史。
- 其他用户的笔记 ID 或版本 ID 不能列出、读取或恢复。版本 ID 配错笔记 ID 时返回「版本不存在」。
- 笔记进入回收站后版本仍在；彻底删除或到期清除后，该笔记的版本行被物理删除。见 [笔记回收站设计](2026-11-08-note-trash-design.md)。
- 取消历史对话框、取消恢复确认、恢复请求失败时，编辑器里的正文和 `dirty` 与打开前一致。
- 列表接口的 SQL 不选择 `note_revision.content`。
- 客户端在响应、状态和请求体里把 `id`、`noteId` 保持为字符串。
