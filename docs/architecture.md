# 项目结构与核心流程

## 组件关系

```text
管理后台 (v5notes-admin) ── /notes/*、/system/* 等 ─┐
                                                    ├─ Java API (v5notes/v5cn-admin)
桌面客户端 (v5notes-client/frontend) ── /client/* ──┘       │
  ElectronEgg 主进程：窗口、托盘等本机能力                     ├─ MySQL：用户、目录、笔记
                                                           └─ Redis：后端缓存/会话等
```

后端聚合入口是 `v5notes/v5cn-admin` 中的 `V5NotesApplication`。根 `pom.xml` 聚合 `v5cn-admin`、`v5cn-common`、`v5cn-extend`、`v5cn-modules`。业务模块中，`v5cn-notes` 是笔记核心；`v5cn-system` 管理用户、角色、租户及 OSS 等；`v5cn-basics` 提供文件能力；其余还包括 `v5cn-ai`、`v5cn-generator`、`v5cn-job`、`v5cn-demo`。这些模块都在 Maven 构建中，但并非桌面笔记操作都依赖它们。

管理后台的笔记页面位于 `v5notes-admin/src/views/notes/`，接口封装位于 `src/api/`；桌面界面位于 `v5notes-client/frontend/src/views/`、`components/`、`api/` 和 `stores/`。Electron 主进程代码位于 `v5notes-client/electron/`，其中 `controller/basic.js` 处理登录窗口和主窗口尺寸。

## 笔记数据

模型和表结构分别见 `v5notes/v5cn-modules/v5cn-notes/src/main/java/org/dromara/notes/domain/` 与 `v5notes/script/sql/notes_mysql.sql`。

| 概念 | 表 | 主要字段与关系 |
| --- | --- | --- |
| 目录 | `note_directory` | `id`、`user_id`、`name`、`pid`；`pid = 0` 是根目录 |
| 笔记 | `note_notes` | `id`、`user_id`、`name`、`dir_id`、`content`；`dir_id = 0` 可表示根级笔记 |

两张表都有 `dept_id`、`tenant_id`、创建/更新时间和 `del_flag`，实体使用 MyBatis-Plus 逻辑删除。目录是树形结构，删除目录时服务层递归删除子目录及目录内笔记。客户端列表中 `dirId = 0` 表示全部笔记、`dirId = 1` 表示最新笔记入口，其他值是实际目录 ID；最新笔记另有 `/client/notes/new-notes` 接口。

## 请求与鉴权

客户端登录时先调用 `GET /client/ping` 测试用户输入的服务器地址，再使用 `POST /auth/login`，默认 `grantType=clientPassword`、`deviceType=pc_client`。`ClientPasswordAuthStrategy` 要求登录用户为客户端用户类型；管理后台创建客户端账号时应选择“客户端用户”。客户端请求工具在 `v5notes-client/frontend/src/utils/request.ts` 中添加 Bearer token 和 `clientid`，服务器 URL 保存在全局 store。

| 功能 | 客户端接口 | 管理后台接口 |
| --- | --- | --- |
| 目录增删改查、树 | `/client/notes/dir`、`/tree-dir`、`/tree` | `/notes/directory`、`/tree-dir`、`/tree` |
| 笔记增删改查 | `/client/notes`、`/list`、`/{id}` | `/notes/notes`、`/list`、`/{id}` |
| 搜索、最新笔记 | `/client/notes/search`、`/new-notes` | 管理列表按查询条件筛选 |

客户端和后台控制器分别在 `v5cn-notes/.../controller/client/` 和 `controller/admin/`；二者共用 `NoteNotesServiceImpl`、`NoteDirectoryServiceImpl` 与 Mapper。客户端笔记列表和最新笔记在服务层按当前登录用户过滤，搜索由 Mapper 按用户 ID 查询。目录树的查询依赖 Mapper 的数据权限处理；涉及用户隔离的改动应同时检查直接按 ID 读取、更新、删除及目录树路径，不能只依据列表过滤推断所有接口的权限边界。

## 常见改动入口

- 笔记或目录字段：后端 `domain/`、`domain/bo/`、`domain/vo/`、Mapper 和 SQL；再同步两套前端的 API 类型与页面。
- 客户端行为：`v5notes-client/frontend/src/views/`、`components/`、`stores/`；本机窗口/托盘行为查 `v5notes-client/electron/`。
- 管理后台：`v5notes-admin/src/views/notes/` 及对应 `src/api/`；权限菜单的初始 SQL 在 `notes_mysql.sql`。
- 登录/权限：`v5notes/v5cn-admin/src/main/java/org/dromara/web/`、`v5cn-system`、两套前端的请求封装与环境文件。
