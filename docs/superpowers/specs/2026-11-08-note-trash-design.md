# 笔记回收站设计

删除笔记或目录时，先从目录树拿掉，放进该用户的回收站，保留 30 天。用户可以整条恢复，也可以彻底删除。到期由定时任务清除。正文版本在进入回收站时保留，彻底删除时才物理删除。

本期只改 `v5notes2` 和 `v5notes-client2`。不改 `v5notes/`、`v5notes-client/`、`v5notes-admin/`。

版本历史的保存、冲突和恢复仍按 [笔记版本历史设计](2026-11-08-note-revision-design.md)。回收站上线后，那份设计里「逻辑删除时立刻删除 `note_revision`」改为本文的清除时机。

## 范围

本期做：

- 客户端删除笔记、删除目录改为进入回收站。
- 回收站列表、恢复、彻底删除一条、清空。
- 每天清除已到期的记录。
- 管理端删除笔记或目录也进入笔记所属用户的回收站。管理端不提供回收站页面。

本期不做：

- 从一次目录删除里单独恢复某一篇笔记或某一个子目录。
- 在回收站里打开、编辑笔记，或查看该笔记的版本历史。
- 回收站记录本身的操作历史。
- 把升级前已经删除的笔记和目录补进回收站。那些正文版本已经物理删除，无法恢复。
- 彻底删除时删除 Markdown 里引用的图片文件。图片是独立文件，可能被其他笔记使用。

## 一次删除一条记录

用户删除一篇笔记，回收站里出现这一篇。用户删除一个目录，回收站里只出现这个目录，子目录和笔记不各占一行。恢复和彻底删除都作用在这一整批上。

目录里已经单独进入回收站的笔记或子目录，继续留在它们自己的记录上。删除上层目录不改它们的批次，恢复上层目录也不把它们带回来。

已经在回收站里的对象不能再删除一次。笔记返回「笔记已在回收站」，目录返回「目录已在回收站」。

## 可见性

正常目录树、笔记列表和搜索继续只看未删除数据。两张业务表已经使用 `@TableLogic`。全局配置是 `logicNotDeleteValue: 0`、`logicDeleteValue: 1`，所以未删除是 `del_flag = 0`，已删除是 `del_flag = 1`。

表注释里的「2 代表删除」和运行时配置不一致。回收站按运行时的 `0` / `1` 写，不修改全局逻辑删除配置，也不把删除值改成 `2`。

只改 `del_flag` 还不够。单靠它无法区分「跟着这次目录删除一起进来的」和「更早单独删除、仍然留在自己那条回收站记录里的」。因此业务表增加 `trash_id`。正常行的 `trash_id` 为空。进入回收站后 `del_flag = 1`，`trash_id` 指向 `note_trash.id`。

进回收站、恢复和物理清除都用手写 SQL，在同一条语句里写 `del_flag` 和 `trash_id`。不调用 `deleteById`。`deleteById` 只会改逻辑删除标志，写不进 `trash_id`，而且当前实现还会顺带物理删除正文版本。

这些 SQL 放在不带 `@DataPermission` 的 Mapper 方法上，方法标记 `@InterceptorIgnore(dataPermission = "true")`。归属只在服务层按 `user_id` 校验，避免数据权限插件给手写语句追加条件后把回收站更新滤掉。

## 表设计

三张表都不加数据库外键。`note_trash` 的一行被恢复或彻底删除后直接物理删除，不用逻辑删除，也没有 `update_time`。

`note_notes`、`note_directory` 各增加一列：

| 列 | 类型 | 空 | 说明 |
| --- | --- | --- | --- |
| `trash_id` | `bigint` | 允许 | 把该行送进回收站的 `note_trash.id`。正常数据为空 |

`note_trash`：

| 列 | MySQL | PostgreSQL | 空 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `bigint(20)` | `bigint` | 否 | 主键，雪花 ID |
| `user_id` | `bigint(20)` | `bigint` | 否 | 笔记或目录的所属用户。管理端删除时仍写对象主人，不写管理员 |
| `object_type` | `char(1)` | `char(1)` | 否 | `1` 笔记，`2` 目录 |
| `object_id` | `bigint(20)` | `bigint` | 否 | 笔记 ID 或目录 ID |
| `name` | `varchar(100)` | `varchar(100)` | 否 | 删除时的名称 |
| `original_parent_id` | `bigint(20)` | `bigint` | 否 | 笔记原来的 `dir_id`，目录原来的 `pid`。根级为 `0` |
| `original_path` | `varchar(500)` | `varchar(500)` | 否 | 删除时从根到直接上级的路径，供列表展示 |
| `note_count` | `int` | `integer` | 否 | 这次一并进入回收站的笔记数。删一篇笔记时为 `1` |
| `dir_count` | `int` | `integer` | 否 | 这次一并进入回收站的目录数，含被删除的目录本身。删笔记时为 `0` |
| `create_by` | `bigint(20)` | `bigint` | 允许 | 执行删除的人。用户自己删除时等于 `user_id` |
| `deleted_time` | `datetime` | `timestamp` | 否 | 删除时间 |
| `expire_time` | `datetime` | `timestamp` | 否 | `deleted_time` 加 30 天 |

索引：

| 名称 | 列 | 用途 |
| --- | --- | --- |
| `PRIMARY` | `id` | 恢复、彻底删除 |
| `idx_note_trash_user_time` | `user_id, deleted_time, id` | 按用户倒序列出回收站，并扫描到期记录 |
| `idx_note_trash_object` | `object_type, object_id` | 判断对象是否已在回收站 |
| `idx_note_notes_trash` | `note_notes.trash_id` | 按批次恢复或清除笔记 |
| `idx_note_directory_trash` | `note_directory.trash_id` | 按批次恢复或清除目录 |

`original_path` 用 ` / ` 连接从根到直接上级的目录名。对象本身在根上时，路径写「根目录」。总长超过 500 时保留靠近对象的部分，并在开头加 `…`。数量在删除事务里数好后写入，列表不再递归统计。

保留天数是版本服务旁的常量 `TRASH_RETAIN_DAYS = 30`。`expire_time = deleted_time.plusDays(30)`。

### MySQL

已有库走 Flyway：`v5notes2/note-admin/src/main/resources/db/migration/mysql/V7__note_trash.sql`。

```sql
ALTER TABLE note_notes
    ADD COLUMN trash_id bigint(20) NULL COMMENT '回收站批次ID。正常数据为空' AFTER content_hash;

ALTER TABLE note_directory
    ADD COLUMN trash_id bigint(20) NULL COMMENT '回收站批次ID。正常数据为空' AFTER pid;

CREATE INDEX idx_note_notes_trash ON note_notes (trash_id);
CREATE INDEX idx_note_directory_trash ON note_directory (trash_id);

CREATE TABLE note_trash
(
    id                 bigint(20)   NOT NULL COMMENT '回收站记录ID',
    user_id            bigint(20)   NOT NULL COMMENT '对象所属用户',
    object_type        char(1)      NOT NULL COMMENT '1笔记 2目录',
    object_id          bigint(20)   NOT NULL COMMENT '笔记ID或目录ID',
    name               varchar(100) NOT NULL COMMENT '删除时的名称',
    original_parent_id bigint(20)   NOT NULL COMMENT '删除时的上级ID，根级为0',
    original_path      varchar(500) NOT NULL COMMENT '删除时的路径',
    note_count         int          NOT NULL COMMENT '这次一并删除的笔记数',
    dir_count          int          NOT NULL COMMENT '这次一并删除的目录数，含目录本身',
    create_by          bigint(20)            DEFAULT NULL COMMENT '执行删除的人',
    deleted_time       datetime     NOT NULL COMMENT '删除时间',
    expire_time        datetime     NOT NULL COMMENT '到期清除时间',
    PRIMARY KEY (id),
    KEY idx_note_trash_user_time (user_id, deleted_time, id),
    KEY idx_note_trash_object (object_type, object_id)
) ENGINE = InnoDB COMMENT = '笔记回收站';
```

全新安装同步 `v5notes2/script/sql/notes2.sql`：把 `trash_id` 放进 `note_notes`、`note_directory` 的建表语句，并带上 `note_trash`。已有 Flyway 历史的库只执行 V7，不改已经执行过的 V2、V6。

### PostgreSQL

已有库走 Flyway：`v5notes2/note-admin/src/main/resources/db/migration/postgresql/V7__note_trash.sql`。

```sql
ALTER TABLE note_notes
    ADD COLUMN trash_id bigint;
ALTER TABLE note_directory
    ADD COLUMN trash_id bigint;

COMMENT ON COLUMN note_notes.trash_id IS '回收站批次ID。正常数据为空';
COMMENT ON COLUMN note_directory.trash_id IS '回收站批次ID。正常数据为空';

CREATE INDEX idx_note_notes_trash ON note_notes (trash_id);
CREATE INDEX idx_note_directory_trash ON note_directory (trash_id);

CREATE TABLE note_trash
(
    id                 bigint       NOT NULL,
    user_id            bigint       NOT NULL,
    object_type        char(1)      NOT NULL,
    object_id          bigint       NOT NULL,
    name               varchar(100) NOT NULL,
    original_parent_id bigint       NOT NULL,
    original_path      varchar(500) NOT NULL,
    note_count         integer      NOT NULL,
    dir_count          integer      NOT NULL,
    create_by          bigint                DEFAULT NULL,
    deleted_time       timestamp    NOT NULL,
    expire_time        timestamp    NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX idx_note_trash_user_time ON note_trash (user_id, deleted_time, id);
CREATE INDEX idx_note_trash_object ON note_trash (object_type, object_id);

COMMENT ON TABLE note_trash IS '笔记回收站';
COMMENT ON COLUMN note_trash.id IS '回收站记录ID';
COMMENT ON COLUMN note_trash.user_id IS '对象所属用户';
COMMENT ON COLUMN note_trash.object_type IS '1笔记 2目录';
COMMENT ON COLUMN note_trash.object_id IS '笔记ID或目录ID';
COMMENT ON COLUMN note_trash.name IS '删除时的名称';
COMMENT ON COLUMN note_trash.original_parent_id IS '删除时的上级ID，根级为0';
COMMENT ON COLUMN note_trash.original_path IS '删除时的路径';
COMMENT ON COLUMN note_trash.note_count IS '这次一并删除的笔记数';
COMMENT ON COLUMN note_trash.dir_count IS '这次一并删除的目录数，含目录本身';
COMMENT ON COLUMN note_trash.create_by IS '执行删除的人';
COMMENT ON COLUMN note_trash.deleted_time IS '删除时间';
COMMENT ON COLUMN note_trash.expire_time IS '到期清除时间';
```

不回填历史已删除数据。`del_flag = 1` 且 `trash_id` 为空的旧行留在原地，不出现在回收站列表里。

## 删除

客户端沿用 `DELETE /client/notes/{ids}` 和 `DELETE /client/notes/dir/{id}`。语义改成进入回收站。一次请求里的多篇笔记，每篇各写一条回收站记录，放在同一个事务里；任一篇失败则全部回滚。

删除前先走现有的未保存草稿确认。用户取消则不删除。

### 笔记

1. 笔记属于当前用户，且 `del_flag = 0`。否则返回「笔记已在回收站」或「无权操作该笔记」。不存在和无权对客户端都返回「无权操作该笔记」，和现有删除一致。
2. 插入 `note_trash`：`object_type = 1`，`note_count = 1`，`dir_count = 0`。
3. 更新该笔记：`del_flag = 1`，`trash_id` 为新记录 ID。不修改正文，不删除 `note_revision`。

打开中的笔记若就是这一篇，清空编辑区，并去掉本地记住的笔记 ID。

### 目录

1. 目录属于当前用户，且 `del_flag = 0`。根 ID `0` 不是目录行，不能删除。
2. 收集当前仍然有效的全部子孙目录和笔记。已经是 `del_flag = 1` 的子孙不进入这次统计，也不改它们的 `trash_id`。
3. 插入一条 `note_trash`：`object_type = 2`。`dir_count` 含被删目录本身。`note_count` 只计这次新进入的笔记。
4. 把该目录和这次收集到的子孙更新为 `del_flag = 1`、同一个 `trash_id`。
5. 不删除这些笔记的 `note_revision`。

若当前打开的笔记属于这次被标记的笔记，清空编辑区，并去掉本地记住的笔记。当前选中的目录属于这次被标记的目录时，选中回到根。

### 保存已在回收站的笔记

`PUT /client/notes` 若发现笔记 `del_flag = 1`，不写正文、不新增版本，返回「笔记已在回收站」。客户端留在编辑态并显示这句文案。不能靠保存把笔记写回目录树。

## 恢复

`POST /client/notes/trash/{id}/restore`

恢复整条记录。目录批次里不能指定其中一篇笔记。

处理在一个事务里：

1. 按回收站 ID 锁记录。记录不存在、不属于当前用户，都返回「记录不存在」。
2. 笔记：原目录存在、属于该用户、且 `del_flag = 0` 时，笔记的 `dir_id` 保持不变。否则把 `dir_id` 改为 `0`。
3. 目录：只恢复 `trash_id` 等于这条记录的目录和笔记。原上级目录存在、属于该用户、且 `del_flag = 0` 时，目录的 `pid` 保持不变。否则把该目录的 `pid` 改为 `0`。子孙的上下级关系保持删除时的样子。
4. 被恢复行写回 `del_flag = 0`、`trash_id = null`。名称允许和现有对象重复，不自动改名。
5. 物理删除这条 `note_trash`。

成功响应：

```json
{
  "code": 200,
  "msg": "操作成功",
  "data": {
    "objectType": "1",
    "objectId": "笔记或目录的雪花ID",
    "parentId": "恢复后的上级ID",
    "relocated": false
  }
}
```

原位置不可用时，`relocated` 为 `true`，`parentId` 为 `"0"`，`msg` 为「原目录已不在，已恢复到根目录」。客户端刷新目录树；恢复的是笔记时打开该笔记，恢复的是目录时选中该目录。`relocated` 为 `true` 时在页面上显示 `msg`。

原上级本身还在回收站里，也视为原位置不可用，恢复到根目录。不把对象挂进一条仍处于回收站的目录。

## 彻底删除

三条入口共用 `purge(trashId)`：

- `DELETE /client/notes/trash/{id}` 清除一条。
- `DELETE /client/notes/trash` 清空当前用户的全部记录。清空是循环调用 `purge`，每条一个事务，某一条失败不影响已经清除的记录，并在响应消息里说明失败条数。
- 每天 03:10 执行一次定时任务，查出 `expire_time <= 当前时间` 的记录并调用 `purge`。任务放在 `note-notes` 模块。记录已经不存在时跳过。多实例重复执行是安全的。

`purge` 在一个事务里：

1. 锁回收站记录。客户端调用时不属于当前用户则返回「记录不存在」。定时任务按记录上的 `user_id` 清除，不再要求登录用户。
2. 笔记记录：物理删除该笔记的全部 `note_revision`，再物理删除笔记行。
3. 目录记录：只处理 `trash_id` 等于这条记录的笔记和目录。先物理删除这些笔记的版本，再物理删除这些笔记和目录。`trash_id` 不同的笔记即使 `dir_id` 指向即将消失的目录，也不删除。以后恢复那些笔记时，原目录已经不在，按恢复规则放到根目录。
4. 物理删除 `note_trash` 行。

物理删除使用 `DELETE FROM`，不用 `deleteById`。

## 接口

新接口挂在 `/client/notes/trash`。ID 在客户端全程是字符串。成功和业务拒绝都保持 HTTP 200，用信封 `code` 区分，和现有 `R` 一致。

列表：`GET /client/notes/trash?pageNum=1&pageSize=20`

`pageSize` 默认 20，最大 50。按 `deleted_time DESC, id DESC`。

```json
{
  "code": 200,
  "data": {
    "rows": [
      {
        "id": "回收站记录ID",
        "objectType": "2",
        "objectId": "目录ID",
        "name": "工作",
        "originalPath": "根目录 / 资料",
        "noteCount": 12,
        "dirCount": 3,
        "deletedTime": "yyyy-MM-dd HH:mm:ss",
        "expireTime": "yyyy-MM-dd HH:mm:ss",
        "daysLeft": 29
      }
    ],
    "total": 1
  }
}
```

`daysLeft` 由服务端用到期时间减当前日期得到，最小为 `0`。列表不返回正文，也不查询 `note_revision`。

恢复失败、彻底删除失败沿用 `R.fail` 的现有错误码，消息用上面各节的文案。

## 界面

回收站是侧栏底部、退出登录上方的一项，不放进目录树。选中后主区域从编辑器换成回收站列表。列表每行显示名称、类型、原路径、删除时间和剩余天数。目录用删除时记下的数量，例如「3 个目录，12 篇笔记」。

每行有「恢复」和「彻底删除」。列表上方有「清空回收站」。空列表写「回收站是空的」。

确认框使用现有应用内对话框：

- 删除笔记：「{名称}」将移到回收站，30 天内可以恢复。
- 删除目录：「{名称}」及其子目录和笔记会移到回收站，30 天内可以恢复。此前单独删除的内容仍留在各自的记录里。
- 彻底删除：写明对象名称，说明正文版本会一并清除，且无法再恢复。按钮用危险样式。
- 清空：说明将永久删除回收站中的全部笔记、目录和正文版本。按钮用危险样式。

取消或请求失败时不改变目录树和当前编辑内容。失败消息留在对话框里。删除成功后刷新目录树；若删掉的是正在看的笔记或它所在的目录，编辑区按删除一节清空。

专注模式仍然收起侧栏。退出专注后可以进入回收站。

## 管理端

`NoteNotesController`、`NoteDirectoryController` 的删除改为调用同一套进入回收站的服务。回收站记录的 `user_id` 是对象主人，`create_by` 是当前管理员。用户在客户端能看到并恢复。

管理端本期没有回收站列表，也没有管理员代为彻底删除的接口。

## 代码落点

后端，均在 `v5notes2/note-modules/note-notes`：

| 位置 | 职责 |
| --- | --- |
| `domain/NoteTrash.java` | 回收站实体。不使用 `@TableLogic` |
| `NoteNotes`、`NoteDirectory` | 增加 `trashId` |
| 手写 Mapper SQL | 标记回收站、按批次恢复、按 ID 物理删除笔记、目录和版本 |
| 回收站服务 | 删除、列表、恢复、`purge`。常量 `TRASH_RETAIN_DAYS` |
| `NoteNotesServiceImpl.deleteWithValidByIds` | 改为进入回收站，不再调用 `deleteByNoteIds` |
| `NoteDirectoryServiceImpl.recursiveDelete` | 改为按批次标记，不再调用 `deleteByNoteIds` |
| `ClientNotesController` | 列表、恢复、彻底删除、清空 |
| 管理端两个删除接口 | 改为进入对象主人的回收站 |
| 定时任务 | 每天 03:10 调用 `purge` |

`note_revision` 的物理删除只留在 `purge`。版本服务现有的 `deleteByNoteIds` 只供 `purge` 使用。

客户端，均在 `v5notes-client2`：

| 位置 | 职责 |
| --- | --- |
| `src/service/api/index.ts` | 回收站四个调用。删除笔记和目录仍走原来的 URL |
| 侧栏底部 | 「回收站」入口，位于退出登录上方 |
| 主区域列表 | 展示、恢复、彻底删除、清空 |
| `useWorkspace.ts` 里的删除确认文案 | 改成移入回收站的说明 |

API 路径只写在 `src/service/api/index.ts`。

## 验收

- 删除一篇笔记后，目录树、列表和搜索都不再出现它。回收站有一条笔记记录，`note_revision` 仍在。30 天内恢复后，正文和版本历史都还在，笔记回到原目录。
- 原目录也在回收站或已经被清除时，笔记恢复到根目录，界面显示「原目录已不在，已恢复到根目录」。
- 删除一个含笔记和子目录的目录后，回收站只有一条目录记录。数量等于这次新进入的笔记数，以及含子目录和它本身的目录数。恢复后树形关系和删除前一致。
- 先单独删除子笔记，再删除父目录。回收站有两条记录。恢复父目录不带回那篇子笔记。恢复子笔记时，若父目录还在回收站，子笔记出现在根目录。
- 名称与现有笔记相同也可以恢复，名称不变。
- 彻底删除笔记后，笔记行和它的 `note_revision` 都没有了。彻底删除目录只清除该批次的行；另一条回收站记录里的笔记还在。
- 清空和到期任务使用同一套 `purge`。到期记录在任务运行后不再出现。对已清除的 ID 再执行一次不会报错中断任务。
- 对回收站中的笔记保存，正文不变，版本条数不变，客户端看到「笔记已在回收站」。
- 其他用户的回收站 ID 不能列出、恢复或彻底删除。
- 取消删除确认、恢复失败、彻底删除失败时，目录树和打开中的草稿保持操作前的样子。
- 升级前 `del_flag = 1` 且 `trash_id` 为空的旧数据不出现在回收站。
- 客户端请求和状态里的回收站 ID、对象 ID、上级 ID 保持字符串。
