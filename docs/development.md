# 开发与部署

以下命令从仓库根目录执行。构建命令来自项目配置，本文未声称在当前机器上完成完整运行验证。

## 本地开发

后端 Maven 配置要求 Java 17。启动类是 `v5notes/v5cn-admin/src/main/java/org/dromara/V5NotesApplication.java`；`application.yml` 中服务默认端口为 `8081`，默认 Maven profile 为 `dev`，对应 `application-dev.yml`。后端需要可用的 MySQL 和 Redis，并需核对开发配置中的数据源、Redis 连接及加密配置；仓库开发配置含特定环境的加密连接值，不应假设能连接本机数据库。

```bash
cd v5notes
mvn -pl v5cn-admin -am package -DskipTests
```

构建后可从 `v5notes/` 执行 `java -jar v5cn-admin/target/v5cn-admin.jar`，也可在 IDE 中启动 `V5NotesApplication`；启动前先确认所选 profile 的连接配置。数据库脚本位于 `v5notes/script/sql/`：基础结构 `ry_vue_5.X.sql`、文件表 `basics_file_mysql.sql`、笔记表与菜单 `notes_mysql.sql`。脚本含建表/删表语句，导入前先确认目标库和现有数据。

管理后台由 `v5notes-admin/package.json` 定义命令。开发模式使用 `.env.development` 的 `/dev-api`，Vite 将其代理到 `http://localhost:8081`，默认前端端口为 `80`：

```bash
cd v5notes-admin
npm install
npm run dev
```

桌面客户端有两层依赖：`v5notes-client/package.json` 管 ElectronEgg，`v5notes-client/frontend/package.json` 管 Vue 页面。项目脚本提供 `dev`、`dev-frontend`、`dev-electron`、`build-frontend` 和各平台 `build-*`；先分别安装两层依赖，再从客户端根目录运行：

```bash
cd v5notes-client
npm install
cd frontend
npm install
cd ..
npm run dev
```

桌面前端单独运行可在 `v5notes-client/frontend/` 执行 `npm run dev`（Vite 端口 `8080`）；API 服务器地址从登录页面输入，页面路由采用 hash 模式。Electron 构建需先运行 `npm run build-frontend`，再按目标平台选择 `build-w`、`build-m` 或 `build-l` 等脚本。Node/npm 版本应根据实际安装的 ElectronEgg、Vite 依赖兼容性确定，本仓库未统一锁定该版本。

## Docker Compose

顶层部署入口是 `docker/docker-compose.yml`，使用 `docker/env/v5notes.env`，包含 MySQL 8.4、Redis 7.4、预构建 API 镜像及管理后台镜像。端口映射：管理后台 `8988`、API `8080`、MySQL `3306`、Redis `6379`。正常启动后管理后台地址为 `http://localhost:8988`，客户端填写可从桌面访问的 API 地址（本机部署通常为 `http://localhost:8080`）。

**当前仓库的阻塞点：** Compose 将 `v5notes/script/sql/basics_file.sql` 与 `notes.sql` 挂载到容器，`docker/mysql/init.sql` 也引用这两个文件；仓库中实际文件是 `basics_file_mysql.sql` 和 `notes_mysql.sql`。首次初始化前须将 Compose 的两个宿主机源路径改为实际文件名，容器内挂载名可保持不变。否则数据库初始化脚本无法按预期导入这些表。此处仅记录现状，未修改部署配置。

核对路径、数据库名称、凭据和镜像后再启动：

```bash
cd docker
docker compose --env-file ./env/v5notes.env config
docker compose --env-file ./env/v5notes.env up -d
docker compose --env-file ./env/v5notes.env ps
```

Compose 配置的连接参数由环境文件覆盖默认值；不要将示例凭据直接用于公开环境。持久化目录位于 `docker/mysql/data/`、`docker/redis/data/` 和 `docker/uploadfile/` 等挂载路径。MySQL 的 `/docker-entrypoint-initdb.d/` 脚本只在新数据目录初始化时执行，已有数据目录不会自动重新导入。

## 配置与排查索引

| 问题 | 首先检查 |
| --- | --- |
| API 启动失败 | `v5notes/v5cn-admin/src/main/resources/application.yml`、对应 `application-*.yml`、数据源和 Redis |
| 管理端请求失败 | `v5notes-admin/.env.development`、`v5notes-admin/vite.config.ts`、API 的 `8081` 端口 |
| 客户端连不上服务 | 登录页面填写的服务器 URL、`GET /client/ping`、客户端用户类型与 `clientid` |
| 笔记/目录异常 | `v5cn-notes` 的 Controller、Service、Mapper 与 `notes_mysql.sql` |
| Docker 首次安装缺表 | `docker/docker-compose.yml` 的 SQL 挂载文件名、`docker/mysql/init.sql`、MySQL 初始化日志 |

后端 `application.yml` 配有 springdoc 的“云笔记”分组；接口签名仍以仓库中的 Controller、BO、VO 为准。
