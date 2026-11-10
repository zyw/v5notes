# V5Notes 后端

`v5notes2` 是 V5Notes 的 API 服务，使用 Java 21 与 Spring Boot 4.1，提供笔记、目录、客户端密码登录和本地文件服务。

## 模块

| 模块 | 说明 |
| --- | --- |
| `note-admin` | 启动模块，入口为 `xin.v5ai.V5Notes2Application`，含 `ClientPasswordAuthStrategy` |
| `note-api` / `note-common/*` / `note-extend/*` | 公共基础设施 |
| `note-modules/note-system` | 系统管理：用户、角色、菜单、字典、客户端 |
| `note-modules/note-notes` | 笔记业务：目录树、笔记、回收站、客户端接口、搜索 |
| `note-modules/note-basics` | 文件服务：`basics_file` 本地或数据库存储，接口 `/basics/base/file` |

Maven 模块以 `note-` 为前缀，groupId 为 `xin.v5ai`，Java 包名为 `xin.v5ai.*`。未包含 ai、demo、workflow、gen、job、monitor-admin、snailai-server，以及 common-ai、liteflow、elasticsearch、mcp、mqtt。

## 构建与本地运行

```bash
# Maven 网络不通时加上 -s maven-settings.xml
mvn -DskipTests package
java -jar note-admin/target/v5notes2.jar --spring.profiles.active=dev
```

产物是 `note-admin/target/v5notes2.jar`，也可以在 IDE 中运行 `xin.v5ai.V5Notes2Application`。

- 端口默认 8080。数据源和 Redis 见 `note-admin/src/main/resources/application-dev.yml`，也可用下方环境变量覆盖。
- 客户端接口前缀 `/client/notes/**`，管理端 `/notes/**`，文件 `/basics/**`。
- 登录加密与 `v5notes-client2` 使用同一套 RSA 密钥，配置项为 `api-decrypt`。

## 刷新令牌

- 登录响应返回 `access_token`、`refresh_token`、`expire_in`、`refresh_expire_in`。
- `POST /auth/refresh` 的请求体为 `{refreshToken}`，需要 AES 加密。成功后返回轮换后的新令牌对。刷新令牌一次性使用，默认有效期 30 天。
- 登出时撤销关联的刷新令牌。

## 数据库

应用启动时由 Flyway 执行 `note-admin/src/main/resources/db/migration` 下的脚本。手工执行 `script/sql` 与 Flyway 二选一，不要对同一个库重复执行。

### Flyway

- 全新库：`spring.flyway.enabled=true`，按版本顺序执行：
  - `V1__base_schema.sql`：基础表，来源于 `script/sql/ry_vue.sql` 与 `script/sql/postgres/postgres_ry_vue.sql`，已去掉 `CREATE DATABASE` 和 `USE`。
  - `V2__v5notes_schema.sql`：笔记、文件、菜单、字典、`sys_client`、`basics_file_config`，由 `script/sql/notes2.sql` 派生。
  - 历史表为 `flyway_schema_history`。
- 已有库：`baseline-on-migrate: true`。首次启动按当前状态建立 baseline，避免重复执行 V1，之后只执行尚未应用的版本。若库中已有笔记和文件表，先把 `spring.flyway.baseline-version` 设为 `2`，或手工建立 baseline，否则 V2 会重建这些表。
- 方言由 `v5notes.db-dialect` 决定，默认 `mysql`，可用 `V5NOTES_DB_DIALECT=postgresql` 切换。
  - `mysql` 使用 `db/migration/mysql`。
  - `postgresql` 使用 `db/migration/postgresql`。
  - 迁移目录为 `classpath:db/migration/common,classpath:db/migration/${v5notes.db-dialect}`。`common` 放两种数据库通用的脚本，同一版本号不要在 `common` 和方言目录中重复。
- PostgreSQL 的 V2 已把 `mediumtext` 改为 `text`、`mediumblob` 改为 `bytea`、`bit(1)` 改为 `boolean`，去掉 `ENGINE`，`sysdate()` 改为 `now()`，`b'1'` 改为 `true`，去掉 `ON UPDATE CURRENT_TIMESTAMP`，并把内联 `KEY` 与 `COMMENT` 改为独立的 `CREATE INDEX` 和 `COMMENT ON`。

### 手工初始化

1. 新建 MySQL 8 数据库 `v5notes2`。
2. 依次执行 `script/sql/ry_vue.sql`、`script/sql/notes2.sql`。
3. 从旧库迁移数据时执行 `script/sql/migrate_data_from_old.sql`，说明见该文件头部。

## 与旧版本的差异

- Spring Boot 3.2 升至 4.1，Java 17 升至 21，Sa-Token 1.38 升至 1.46。
- 不再包含多租户。
- `TableDataInfo` 改为 `PageResult`，EasyExcel 改为 Apache Fesod，`RepeatSubmit` 位于 `common-redis`。
- 文件不再使用 OSS，沿用 `basics_file` 存储。

## 部署

`docker/docker-compose.yml` 启动 MySQL、Redis、API 和管理后台。库表在 API 启动时由 Flyway 创建，不要再手工执行 `script/sql`。

```bash
cd v5notes2 && mvn -DskipTests package
cd ../v5notes-admin2 && pnpm install && pnpm build
cd ../v5notes2/docker && docker compose up -d --build
```

管理后台默认端口 8988，API 默认端口 8080。密码见 `docker/env.example`，需要修改时复制为 `docker/.env`。上传文件保存在 `docker/uploadfile`。

## 环境变量

未设置时使用配置文件中的默认值。同一变量在 `application-dev.yml` 与 `application-prod.yml` 中的默认值可以不同，例如开发库是 `v5notes2-dev`，生产库是 `v5notes2`。

| 名称 | 配置项 | 描述 |
| --- | --- | --- |
| `V5NOTES_SERVER_PORT` | `server.port` | HTTP 服务端口，默认 `8080` |
| `V5NOTES_DB_DIALECT` | `v5notes.db-dialect` | 数据库方言，`mysql` 或 `postgresql`。同时决定 Flyway 迁移目录和实际连接的数据源 |
| `V5NOTES_JWT_SECRET` | `sa-token.jwt-secret-key` | 登录 JWT 密钥 |
| `V5NOTES_API_DECRYPT_PUBLIC_KEY` | `api-decrypt.publicKey` | 接口响应加密公钥，需与管理后台、客户端的解密私钥成对 |
| `V5NOTES_API_DECRYPT_PRIVATE_KEY` | `api-decrypt.privateKey` | 接口请求解密私钥，需与前端加密公钥成对 |
| `V5NOTES_MYBATIS_ENCRYPTOR_PASSWORD` | `mybatis-encryptor.password` | 字段加密的对称密钥。未设置时为空 |
| `V5NOTES_MYBATIS_ENCRYPTOR_PUBLIC_KEY` | `mybatis-encryptor.publicKey` | 字段加密的非对称公钥。未设置时为空 |
| `V5NOTES_MYBATIS_ENCRYPTOR_PRIVATE_KEY` | `mybatis-encryptor.privateKey` | 字段加密的非对称私钥。未设置时为空 |
| `V5NOTES_DATASOURCE_MYSQL_URL` | `v5notes.datasource.mysql.url` | MySQL 连接地址。仅在方言为 `mysql` 时使用 |
| `V5NOTES_DATASOURCE_MYSQL_USERNAME` | `v5notes.datasource.mysql.username` | MySQL 用户名 |
| `V5NOTES_DATASOURCE_MYSQL_PASSWORD` | `v5notes.datasource.mysql.password` | MySQL 密码 |
| `V5NOTES_DATASOURCE_POSTGRESQL_URL` | `v5notes.datasource.postgresql.url` | PostgreSQL 连接地址。仅在方言为 `postgresql` 时使用 |
| `V5NOTES_DATASOURCE_POSTGRESQL_USERNAME` | `v5notes.datasource.postgresql.username` | PostgreSQL 用户名 |
| `V5NOTES_DATASOURCE_POSTGRESQL_PASSWORD` | `v5notes.datasource.postgresql.password` | PostgreSQL 密码 |
| `V5NOTES_REDIS_HOST` | `spring.data.redis.host` | Redis 地址 |
| `V5NOTES_REDIS_PORT` | `spring.data.redis.port` | Redis 端口，默认 `6379` |
| `V5NOTES_REDIS_DATABASE` | `spring.data.redis.database` | Redis 库编号 |
| `V5NOTES_REDIS_PASSWORD` | `spring.data.redis.password` | Redis 密码 |
| `V5NOTES_MAIL_ENABLED` | `mail.enabled` | 是否启用邮件发送，默认 `false` |
| `V5NOTES_MAIL_HOST` | `mail.host` | SMTP 服务器地址 |
| `V5NOTES_MAIL_PORT` | `mail.port` | SMTP 端口 |
| `V5NOTES_MAIL_FROM` | `mail.from` | 发件人地址 |
| `V5NOTES_MAIL_USER` | `mail.user` | SMTP 登录用户名 |
| `V5NOTES_MAIL_PASSWORD` | `mail.pass` | SMTP 登录密码 |
| `V5NOTES_SMS_ALIBABA_ACCESS_KEY_ID` | `sms.blends.config1.access-key-id` | 阿里云短信 AccessKey |
| `V5NOTES_SMS_ALIBABA_ACCESS_KEY_SECRET` | `sms.blends.config1.access-key-secret` | 阿里云短信 AccessKey Secret |
| `V5NOTES_SMS_ALIBABA_SIGNATURE` | `sms.blends.config1.signature` | 阿里云短信签名 |
| `V5NOTES_SMS_ALIBABA_SDK_APP_ID` | `sms.blends.config1.sdk-app-id` | 阿里云短信应用编号 |
| `V5NOTES_SMS_TENCENT_ACCESS_KEY_ID` | `sms.blends.config2.access-key-id` | 腾讯云短信 AccessKey |
| `V5NOTES_SMS_TENCENT_ACCESS_KEY_SECRET` | `sms.blends.config2.access-key-secret` | 腾讯云短信 AccessKey Secret |
| `V5NOTES_SMS_TENCENT_SIGNATURE` | `sms.blends.config2.signature` | 腾讯云短信签名 |
| `V5NOTES_SMS_TENCENT_SDK_APP_ID` | `sms.blends.config2.sdk-app-id` | 腾讯云短信应用编号 |
| `V5NOTES_SNAIL_JOB_TOKEN` | `snail-job.token` | SnailJob 客户端接入令牌 |
| `V5NOTES_GITEE_CLIENT_ID` | `justauth.type.gitee.client-id` | Gitee 第三方登录客户端编号 |
| `V5NOTES_GITEE_CLIENT_SECRET` | `justauth.type.gitee.client-secret` | Gitee 第三方登录客户端密钥 |

仓库说明见根目录 [README.md](../README.md)。
