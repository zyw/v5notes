# v5notes2 后端

V5Notes 后端，使用 Java 21 与 Spring Boot 4.1，提供笔记、目录、客户端密码登录和本地文件服务。

## 模块

| 模块 | 说明 |
| --- | --- |
| `note-admin` | 启动模块（`V5Notes2Application`），含 `ClientPasswordAuthStrategy` |
| `note-api` / `note-common/*` / `note-extend/*` | 6.1.0 原版基础设施 |
| `note-modules/note-system` | 系统管理（用户/角色/菜单/字典/客户端等） |
| `note-modules/note-notes` | **笔记业务**（目录树、笔记 CRUD、客户端接口、搜索、最新笔记） |
| `note-modules/note-basics` | **文件服务**（`basics_file` 本地/DB 存储，`/basics/base/file` 上传/下载） |

## 构建

```bash
# Maven 网络不通时使用仓库内 settings（本地仓库不变，镜像 apache central）
mvn -s maven-settings.xml -DskipTests -Dmaven.test.skip=true clean package
# 产物：note-admin/target/v5notes2.jar
```

## 初始化数据库

1. 新建库 `v5notes2`（MySQL 8）。
2. 依次执行：
   - `script/sql/ry_vue.sql`（6.1.0 基础表 + 种子数据）
   - `script/sql/notes2.sql`（笔记/文件表、菜单、字典、sys_client）
   - 若从旧库迁移数据：`script/sql/migrate_data_from_old.sql`（见文件头说明）

## 本地运行

```bash
# 改 note-admin/src/main/resources/application-dev.yml 数据源/Redis 后
java -jar note-admin/target/v5notes2.jar --spring.profiles.active=dev
# 或 IDE 运行 xin.v5ai.V5Notes2Application
```

- 端口默认 8080。
- 客户端接口前缀 `/client/notes/**`；管理端 `/notes/**`；文件 `/basics/**`。
- 登录加密兼容 `v5notes-client2`：`api-decrypt` 复用旧 v5notes RSA 密钥对。

## 部署

`docker/docker-compose.yml` 启动 MySQL、Redis、API 和管理后台。库表在 API 启动时由 Flyway 创建，不要再手工执行 `script/sql`。

```bash
cd v5notes2 && mvn -DskipTests package
cd ../v5notes-admin2 && pnpm install && pnpm build
cd ../v5notes2/docker && docker compose up -d --build
```

管理后台默认端口 8988，API 默认端口 8080。密码见 `docker/env.example`，需要修改时复制为 `docker/.env`。上传文件保存在 `docker/uploadfile`。

## 与旧 v5notes 的差异

- Spring Boot 3.2 → 4.1、Java 17 → 21、Sa-Token 1.38 → 1.46。
- 移除多租户模块（v5notes 实际单租户）。
- `TableDataInfo` → `PageResult`；EasyExcel → Apache Fesod；`RepeatSubmit` 移入 `common-redis`。
- 文件不再使用 OSS，沿用 `basics_file` 存储。

## 数据库迁移（Flyway）

项目已集成 Flyway，应用启动时自动执行 `note-admin/src/main/resources/db/migration` 下的迁移脚本，无需再手工执行建表 SQL：

- **全新库**：`spring.flyway.enabled=true`，启动即按版本顺序执行迁移：
  - `V1__base_schema.sql`：基础 schema（`script/sql/ry_vue.sql` / `script/sql/postgres/postgres_ry_vue.sql`，已去除 `CREATE DATABASE` / `USE`）。
  - `V2__v5notes_schema.sql`：笔记/文件表、菜单、字典、`sys_client`、`basics_file_config`（由 `script/sql/notes2.sql` 派生）。
  - 历史表固定为 `flyway_schema_history`。
- **已存在的库**：已开启 `baseline-on-migrate: true`，首次启动会以当前状态建立 baseline，避免对已有表重复执行 V1，随后仅执行尚未应用的版本。
  - 若已有库已包含笔记/文件表（即已手工执行过 `V2`），请先把 `spring.flyway.baseline-version` 设为 `2`（或手工建立 baseline）后再启动，否则 `V2` 会重建相关表。
- **方言切换**：`v5notes.db-dialect` 决定使用哪个方言目录，默认 `mysql`，可用环境变量 `V5NOTES_DB_DIALECT` 覆盖为 `postgresql`：
  - `mysql` → `db/migration/mysql`
  - `postgresql` → `db/migration/postgresql`
  - 迁移目录为 `classpath:db/migration/common,classpath:db/migration/${v5notes.db-dialect}`；`common` 可放两方言通用的脚本，但同一版本号不要在 `common` 与方言目录重复。
- **PostgreSQL 转换说明**：`V2` 的 PG 版本已将 `mediumtext`→`text`、`mediumblob`→`bytea`、`bit(1)`→`boolean`，去掉 `ENGINE` 子句，`sysdate()`→`now()`、`b'1'`→`true`，去掉 `ON UPDATE CURRENT_TIMESTAMP`（改为普通 `default now()`），并将内联 `KEY` / `COMMENT` 改为独立 `CREATE INDEX` / `COMMENT ON`。
- 仍保留 `script/sql/` 下原始脚本供参考；手工初始化（上一节）与 Flyway 二选一，切勿对同一库重复执行。



## 模块与包名
- Maven 模块统一以 `note-` 前缀（如 `note-admin`、`note-common-core`、`note-modules/note-notes`），groupId 为 `xin.v5ai`。
- Java 包名为 `xin.v5ai.*`。
- 未包含 ai/demo/workflow/gen/job、monitor-admin/snailai-server，以及 common-ai/liteflow/elasticsearch/mcp/mqtt。


## 刷新令牌
- 登录响应返回 `access_token` / `refresh_token` / `expire_in` / `refresh_expire_in`。
- `POST /auth/refresh`（请求体 `{refreshToken}`，需 AES 加密）返回轮换后的新令牌对；刷新令牌一次性使用，默认有效期 30 天。
- 登出时撤销关联刷新令牌。
