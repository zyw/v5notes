# V5Notes

[简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md)

[![Java](https://img.shields.io/badge/Java-21-4479A1?logo=openjdk&logoColor=white)](v5notes2/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1-6DB33F?logo=springboot&logoColor=white)](v5notes2/)
[![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white)](v5notes-admin2/)
[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](v5notes-client2/)
[![License](https://img.shields.io/badge/License-Apache%202.0%20%2F%20MIT-blue)](LICENSE)

把想法留在自己的服务器上。

V5Notes 是一套可以私有部署的 Markdown 云笔记。桌面客户端负责写作，管理后台负责人和权限，后端把目录、正文、历史版本和文件收在你自己的数据库里。打开电脑就能写，换一台电脑接着写，笔记不会散落到别人的网盘里。

本文说明三个目录：[`v5notes2`](v5notes2/)、[`v5notes-admin2`](v5notes-admin2/)、[`v5notes-client2`](v5notes-client2/)。

## 目录

- [它解决什么问题](#它解决什么问题)
- [三端如何配合](#三端如何配合)
- [界面截图](#界面截图)
- [功能一览](#功能一览)
- [技术栈](#技术栈)
- [环境准备](#环境准备)
- [本地运行](#本地运行)
- [部署](#部署)
- [二次开发](#二次开发)
- [配置](#配置)
- [常见问题](#常见问题)
- [上线前检查](#上线前检查)
- [后期功能规划](#后期功能规划)

## 它解决什么问题

云笔记很好用，直到你想把数据拿回来。本地 Markdown 很自由，直到目录、搜索、误删和多设备把事情变乱。V5Notes 把这两件事合成一套你能自己装、自己备份、自己改的系统。

| 你遇到的情况 | V5Notes 的做法 |
| --- | --- |
| 笔记散落在聊天记录、网盘和本地文件夹里 | 一篇笔记就是一份 Markdown，按目录归好，按标题搜索 |
| 希望数据留在自己的机器上 | API、MySQL 或 PostgreSQL、Redis、上传文件都由你部署 |
| 写作界面堆满了管理功能 | 桌面端只留下目录、正文和写作工具；用户、角色、文件和审计放在管理后台 |
| 改乱了，或删错了一整棵目录 | 正文保留可恢复的历史版本；删除先进回收站，30 天内可以找回 |
| 家里或小团队里有不同语言的人 | 三端界面都支持简体中文、繁体中文和英文 |

适合这些人：想自己托管笔记的个人，需要给家人或小团队开通账号的人，以及希望在一套现成的用户、权限和笔记 API 上继续做产品的开发者。

## 三端如何配合

```mermaid
flowchart LR
  Client["v5notes-client2<br/>桌面写作"] -->|"/client/notes"| API["v5notes2<br/>API"]
  Admin["v5notes-admin2<br/>管理后台"] -->|"/notes · /system · /basics"| API
  API --> DB[("MySQL 或 PostgreSQL")]
  API --> Redis[("Redis")]
  API --> Files["本地文件"]
```

| 目录 | 你用它来 | 技术 |
| --- | --- | --- |
| [`v5notes2`](v5notes2/) | 登录、笔记、目录、回收站、历史版本、文件和管理接口 | Java 21、Spring Boot 4.1 |
| [`v5notes-admin2`](v5notes-admin2/) | 用户与权限、笔记与目录、文件、登录和操作审计 | Vue 3.5、TypeScript、Element Plus、Vite 8 |
| [`v5notes-client2`](v5notes-client2/) | 在 Windows、macOS、Linux 上阅读和编辑 Markdown | Vue 3.5、TypeScript、Tauri 2 |

客户端走 `/client/notes/**`，管理后台走 `/notes/**`、`/system/**` 和 `/basics/**`。同一套笔记服务同时服务两端，雪花 ID 从接口到页面始终按字符串处理。

## 界面截图

以下截图来自实际运行的界面。桌面客户端负责写作，管理后台负责成员、笔记和系统状态。

### 桌面客户端

| 登录（浅色） | 登录（深色） |
|:---:|:---:|
| ![桌面客户端登录页：连接工作区、用户名和密码，浅色主题](images/client/登录-浅.png) | ![桌面客户端登录页，深色主题](images/client/登录-深.png) |

| 工作区首页 | 深色主题 |
|:---:|:---:|
| ![工作区首页：左侧目录树与新建笔记入口](images/client/home-img.png) | ![深色主题下的阅读视图](images/client/home-dark.png) |

| 编辑模式 | 预览模式 |
|:---:|:---:|
| ![所见即所得编辑模式，工具栏和已保存状态](images/client/编辑模式.png) | ![只读预览模式，右上角可切回编辑](images/client/预览模式.png) |

| 源码模式 | 查找 |
|:---:|:---:|
| ![源码模式：直接编辑 Markdown 原文](images/client/源码模式.png) | ![右侧查找面板与命中结果列表](images/client/查找.png) |

| 大纲 | 命令面板 |
|:---:|:---:|
| ![右侧大纲面板，按标题层级跳转](images/client/大纲操作.png) | ![命令面板：切换显示模式、视图、排版和导出](images/client/命令面板.png) |

| 回收站 | 历史版本 |
|:---:|:---:|
| ![回收站：剩余 30 天，可恢复或彻底删除](images/client/回收站.png) | ![历史版本：版本列表、正文预览与恢复](images/client/历史版本.png) |

| 设置 |
|:---:|
| ![设置：连接、语言、主题与工作区偏好](images/client/设置.png) |

### 管理后台

| 登录（浅色） | 登录（深色） |
|:---:|:---:|
| ![管理后台登录页：账号、密码、验证码，浅色主题](images/admin/login-light.png) | ![管理后台登录页，深色主题](images/admin/login-dark.png) |

| 工作台（浅色） | 工作台（深色） |
|:---:|:---:|
| ![工作台：笔记总数、活跃用户、今日编辑与内容增长](images/admin/home-light.png) | ![深色主题下的工作台](images/admin/home-dark.png) |

| 笔记管理 | 成员管理 |
|:---:|:---:|
| ![笔记管理：目录树、筛选条件和笔记列表](images/admin/notes-light.png) | ![成员管理：部门结构、角色与访问范围](images/admin/user-light.png) |

| 笔记历史版本 |
|:---:|
| ![从管理后台查看笔记历史版本并恢复](images/admin/his-light.png) |

## 功能一览

**写一篇笔记，就该这么顺**

- 左侧是一棵目录和笔记混在一起的树：搜索、新建、重命名、删除都在这里完成。
- Markdown 编辑器支持预览和编辑来回切换，撤销记录留在同一次编辑会话里。
- 专注模式收起侧栏，把窗口留给正文。
- 右侧可以打开大纲，也可以在正文里查找。
- `Ctrl/Cmd + S` 保存。有未保存修改时，切换笔记或关闭窗口会先问你。

**删得安心，改得回去**

- 笔记和目录先进入回收站，保留 30 天，可以恢复。
- 清空回收站或彻底删除时，才会连同正文版本一起清掉。
- 每篇笔记可以查看历史版本，预览后恢复。

**账号和文件有地方管**

- 管理后台提供用户、部门、岗位、角色、菜单、字典、参数、通知和客户端配置。
- 在线用户、登录日志、操作日志和缓存监控用来看系统正在发生什么。
- 文件走本地存储，上传内容跟数据库放在一起备份即可。
- 登录可以使用访问令牌和刷新令牌。刷新令牌默认 30 天、一次性轮换；客户端不保存密码。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 后端 | Java 21、Spring Boot 4.1.2、MyBatis-Plus 3.5、Sa-Token 1.46、Flyway、Redisson、Hutool |
| 管理后台 | Vue 3.5、TypeScript、Vite 8、Element Plus 2.14、Pinia、UnoCSS、vue-i18n |
| 桌面客户端 | Vue 3.5、TypeScript、Vite 6、Tauri 2、`@v5md` 编辑器、vue-i18n |
| 数据 | MySQL 8.4 或 PostgreSQL，Redis 7.4 |
| 部署 | Docker Compose、可执行 Jar、Nginx 静态站点 |

后端按 Maven 多模块组织，`groupId` 为 `xin.v5ai`：

| 模块 | 职责 |
| --- | --- |
| `note-admin` | 启动入口 `xin.v5ai.V5Notes2Application`，登录、验证码、令牌 |
| `note-modules/note-notes` | 目录树、笔记、搜索、回收站、历史版本、客户端接口 |
| `note-modules/note-system` | 用户、角色、菜单、字典、部门、客户端 |
| `note-modules/note-basics` | 本地文件服务 |
| `note-common` | 安全、缓存、数据访问、加解密等基础设施 |

数据库结构在 API 启动时由 Flyway 迁移，脚本位于 `v5notes2/note-admin/src/main/resources/db/migration`。MySQL 与 PostgreSQL 各有一套方言脚本。

## 环境准备

| 工具 | 版本 |
| --- | --- |
| JDK | 21 |
| Maven | 3.9 或更高 |
| Node.js | 22.12+、24 或 26 |
| pnpm | 10 或更高，用于管理后台 |
| npm | 用于桌面客户端 |
| Rust | 稳定版。只在打包或 `tauri dev` 时需要 |
| 数据库 | MySQL 8 或 PostgreSQL |
| Redis | 7 |

三端界面语言可以在各自的界面里切换。客户端请求会带上 `Content-Language`，后端按该语言返回提示。

## 本地运行

先准备好 MySQL 和 Redis，再按 `v5notes2/note-admin/src/main/resources/application-dev.yml` 核对连接。开发库默认名为 `v5notes2-dev`。

```bash
# 后端，默认端口 8080。首次启动会执行 Flyway。
cd v5notes2
mvn -DskipTests package
java -jar note-admin/target/v5notes2.jar --spring.profiles.active=dev
```

```bash
# 管理后台。默认端口 80，/dev-api 代理到 http://localhost:8080。
# 80 端口需要权限时，修改 .env.development 里的 VITE_APP_PORT。
cd v5notes-admin2
pnpm install
pnpm dev
```

```bash
# 桌面客户端。浏览器开发地址为 http://127.0.0.1:1420。
cd v5notes-client2
npm install
npm run dev          # 只跑页面
npm run tauri dev    # 带桌面壳
npm test
```

接口文档由 SpringDoc 默认开启，分组为通用模块、系统模块和云笔记。

## 部署

四种方式可以按场景挑选。数据库表都由 API 启动时的 Flyway 创建。使用 Flyway 时，不要再对同一个库手工执行 `v5notes2/script/sql`。

### 方式一：Docker Compose

适合第一次把整套系统跑起来，也适合单机生产。Compose 会拉起 MySQL 8.4、Redis 7.4、API 和管理后台。镜像只复制已经打好的产物，容器里不编译源码。

```bash
cd v5notes2
mvn -DskipTests package

cd ../v5notes-admin2
pnpm install
pnpm build

cd ../v5notes2/docker
cp env.example .env    # 对外服务前先改密码
docker compose up -d --build
```

| 服务 | 默认地址 |
| --- | --- |
| 管理后台 | http://localhost:8988 |
| API | http://localhost:8080 |
| MySQL | `localhost:3306`，库名 `v5notes2` |
| Redis | `localhost:6379` |

需要备份时，拷走这三个目录：

| 数据 | 位置 |
| --- | --- |
| 数据库 | `v5notes2/docker/mysql/data` |
| 缓存持久化 | `v5notes2/docker/redis/data` |
| 上传文件 | `v5notes2/docker/uploadfile` |

MySQL 官方镜像只在数据目录为空时初始化 root 密码。已经启动过再改 `MYSQL_ROOT_PASSWORD`，要同时改 `.env` 里的数据源密码，或清空数据目录后重建。

### 方式二：Jar 与 Nginx

适合已经有 MySQL、Redis，或者要把管理后台放到现有域名后面。

1. 打包 API，用 `prod` 配置启动：

```bash
cd v5notes2
mvn -DskipTests package

export V5NOTES_DB_DIALECT=mysql
export V5NOTES_DATASOURCE_MYSQL_URL='jdbc:mysql://127.0.0.1:3306/v5notes2?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true&nullCatalogMeansCurrent=true'
export V5NOTES_DATASOURCE_MYSQL_USERNAME=v5notes
export V5NOTES_DATASOURCE_MYSQL_PASSWORD='请替换'
export V5NOTES_REDIS_HOST=127.0.0.1
export V5NOTES_REDIS_PASSWORD='请替换'
export V5NOTES_JWT_SECRET='请替换为一串足够长的随机字符串'

java -jar note-admin/target/v5notes2.jar --spring.profiles.active=prod
```

用 systemd 托管时，可以把上面的环境变量写进 `/etc/v5notes2.env`，再使用类似下面的服务：

```ini
[Unit]
Description=V5Notes API
After=network.target

[Service]
WorkingDirectory=/opt/v5notes/v5notes2
EnvironmentFile=/etc/v5notes2.env
ExecStart=/usr/bin/java -Xms512m -Xmx512m -jar /opt/v5notes/v5notes2/note-admin/target/v5notes2.jar --spring.profiles.active=prod
Restart=on-failure
User=v5notes

[Install]
WantedBy=multi-user.target
```

2. 构建管理后台，并用 Nginx 托管 `dist/`。生产环境的接口前缀是 `/prod-api`：

```bash
cd v5notes-admin2
pnpm install
pnpm build
```

```nginx
server {
    listen 80;
    server_name notes.example.com;
    root /var/www/v5notes-admin;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /prod-api/ {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_pass http://127.0.0.1:8080/;
        client_max_body_size 10000m;
    }
}
```

`proxy_pass` 末尾的 `/` 会去掉 `/prod-api` 前缀，后端收到的仍是 `/auth/login` 这样的路径。

### 方式三：PostgreSQL

API 用同一个开关切换方言和 Flyway 目录。先建空库 `v5notes2`，再启动：

```bash
export V5NOTES_DB_DIALECT=postgresql
export V5NOTES_DATASOURCE_POSTGRESQL_URL='jdbc:postgresql://127.0.0.1:5432/v5notes2'
export V5NOTES_DATASOURCE_POSTGRESQL_USERNAME=v5notes
export V5NOTES_DATASOURCE_POSTGRESQL_PASSWORD='请替换'
```

Docker Compose 默认附带的是 MySQL。使用外部 PostgreSQL 时，把 API 的方言和连接指到那台数据库，不要把 MySQL 脚本导入 PostgreSQL。

### 方式四：桌面安装包

客户端安装后填写服务器地址即可，不需要和 API 装在同一台机器上。打包需要本机已安装 Rust：

```bash
cd v5notes-client2
npm install
npm run tauri build
```

安装包出现在 `v5notes-client2/src-tauri/target/release/bundle/`，覆盖 Tauri 当前平台能产出的 Windows、macOS 和 Linux 目标。应用内更新读取 GitHub Releases 上的 `latest.json`。

若服务端的客户端编号或登录 RSA 公钥与仓库默认值不同，打包前设置：

```bash
export VITE_CLIENT_ID='与 sys_client 中一致的客户端编号'
export VITE_API_PUBLIC_KEY='与服务端 api-decrypt 成对的公钥'
```

### 第一次打开

1. 打开管理后台。初始管理员为 `admin` / `admin123`，登录需要验证码。进入后马上修改密码。
2. 新建一个用户，用户类型选择「客户端用户」（`cli_user`）。桌面端只接受这一类账号。
3. 打开桌面客户端，服务器填 API 地址，例如 `http://192.168.1.10:8080`，再用刚才的账号进入。

Docker 部署时，管理后台是 [http://localhost:8988](http://localhost:8988)，客户端里的服务器填 `http://localhost:8080`。从另一台电脑连接时，把 `localhost` 换成服务器的局域网或公网地址。

## 二次开发

三个目录可以分开改。后端增加能力，管理后台和客户端各自接自己的接口。

| 想做的事 | 从这里开始 |
| --- | --- |
| 新的笔记、目录、回收站或版本接口 | `v5notes2/note-modules/note-notes` |
| 登录、验证码、访问令牌和刷新令牌 | `v5notes2/note-admin` 中的 `xin.v5ai.web` |
| 用户、角色、菜单、字典 | `v5notes2/note-modules/note-system` |
| 上传与本地文件 | `v5notes2/note-modules/note-basics` |
| 管理后台页面 | `v5notes-admin2/src/views` 与 `src/api` |
| 写作界面、侧栏、大纲、查找 | `v5notes-client2/src` |
| 三语文案 | 管理后台与客户端的 i18n，以及后端提示语 |
| 表结构 | `v5notes2/note-admin/src/main/resources/db/migration` |

推荐的改动顺序：

1. 在 `note-notes` 增加接口。客户端路径放在 `/client/notes` 下，管理端路径放在 `/notes` 下，两边复用同一套服务。
2. 需要新表或新字段时，为 MySQL 和 PostgreSQL 各增加一个更高版本号的 Flyway 脚本。同一版本号不要在 `common` 和方言目录里各放一份。
3. 管理后台把页面放到 `src/views`，接口放到 `src/api`。菜单来自数据表 `sys_menu`，组件路径与文件路径对应，例如 `notes/notes/index`。
4. 客户端把请求集中在 `src/api.ts`，页面只处理交互。目录和笔记的编号全程使用字符串。
5. 简体中文、繁体中文、英文三套文案一起改。客户端发出的 `Content-Language` 决定后端提示语的语言。

写作体验有几条已经定下来的约定：

- 预览和编辑共用同一个编辑器实例，这样 Markdown 状态和撤销历史还在。
- 切到预览前先保存。保存失败时留在编辑状态。
- 删除目录要说明会连同子目录和笔记一起进入回收站。
- 对话框用应用内的模态框完成，带标题、校验和失败后的错误信息。
- 访问令牌放在内存里，刷新令牌可以留在本机，密码不落地。

编辑器来自 `@v5md/vue`。块菜单、拖拽手柄和排序属于编辑器本身。客户端锁定了 `vendor/v5md` 中的包；要换编辑器能力时，先更新这组依赖再构建。

管理后台的常用命令：

```bash
pnpm dev
pnpm build
pnpm lint
```

更细的模块说明、刷新令牌协议和完整环境变量见 [v5notes2/README.md](v5notes2/README.md)、[v5notes-admin2/README.md](v5notes-admin2/README.md)、[v5notes-client2/README.md](v5notes-client2/README.md)。

## 配置

未设置环境变量时，使用对应 profile 配置文件中的默认值。生产环境请显式设置密码和密钥。

| 变量 | 作用 |
| --- | --- |
| `V5NOTES_SERVER_PORT` | API 端口，默认 `8080` |
| `V5NOTES_DB_DIALECT` | `mysql` 或 `postgresql` |
| `V5NOTES_DATASOURCE_MYSQL_URL` | MySQL 连接串 |
| `V5NOTES_DATASOURCE_MYSQL_USERNAME` / `PASSWORD` | MySQL 账号 |
| `V5NOTES_DATASOURCE_POSTGRESQL_URL` | PostgreSQL 连接串 |
| `V5NOTES_DATASOURCE_POSTGRESQL_USERNAME` / `PASSWORD` | PostgreSQL 账号 |
| `V5NOTES_REDIS_HOST` / `PORT` / `PASSWORD` | Redis |
| `V5NOTES_JWT_SECRET` | 登录 JWT 密钥 |
| `V5NOTES_API_DECRYPT_PUBLIC_KEY` / `PRIVATE_KEY` | 接口加解密密钥，需与两个前端成对 |
| `VITE_CLIENT_ID` | 客户端编号，对应服务端 `sys_client` |
| `VITE_API_PUBLIC_KEY` | 客户端登录加密用的公钥 |

Docker Compose 使用 `v5notes2/docker/.env`，变量名见 [env.example](v5notes2/docker/env.example)。那里的 `MASTER_DATASOURCE_*` 会传给容器内的数据源配置。

<details>
<summary>邮件、短信和第三方登录</summary>

| 变量 | 作用 |
| --- | --- |
| `V5NOTES_MAIL_ENABLED` / `HOST` / `PORT` / `FROM` / `USER` / `PASSWORD` | SMTP |
| `V5NOTES_SMS_ALIBABA_*` | 阿里云短信 |
| `V5NOTES_SMS_TENCENT_*` | 腾讯云短信 |
| `V5NOTES_ZHIHU_CLIENT_ID` / `CLIENT_SECRET` | 知乎登录（app_id / app_key） |
| `V5NOTES_GITEE_CLIENT_ID` / `CLIENT_SECRET` | Gitee 登录 |

字段加密还可设置 `V5NOTES_MYBATIS_ENCRYPTOR_PASSWORD`、`PUBLIC_KEY`、`PRIVATE_KEY`。

</details>

## 常见问题

**启动后数据库里没有表。**  
确认 API 日志里 Flyway 已执行，并且 `V5NOTES_DB_DIALECT` 与真实数据库一致。已有旧库时，Flyway 会按 baseline 跳过已存在的版本。若库里已经有笔记表，却又从 V2 开始迁移，请先阅读 [v5notes2/README.md](v5notes2/README.md) 里的 baseline 说明。

**管理后台页面能开，接口全部失败。**  
开发环境走 `/dev-api`，生产构建走 `/prod-api`。Nginx 需要把这个前缀反向代理到 API，并去掉前缀。

**桌面端无法登录。**  
依次核对：服务器地址能从这台电脑访问、账号的用户类型是客户端用户、`clientid` 与服务端一致、登录公钥与服务端 `api-decrypt` 成对。客户端会先请求服务器，再提交账号密码。

**两个人同时编辑同一篇笔记。**  
后保存的正文会覆盖先保存的那一份。需要找回时，打开这篇笔记的历史版本。

**改了 Docker 里的数据库密码，API 仍然连不上。**  
MySQL 数据目录已经初始化后，只改 `MYSQL_ROOT_PASSWORD` 不会改变已有实例的密码。让 `.env` 中的 root 密码和数据源密码保持一致，或在空数据目录上重新初始化。

## 上线前检查

- 修改初始管理员 `admin` 的密码，并为数据库、Redis 设置独立密码。
- 设置 `V5NOTES_JWT_SECRET`，更换一对 API 加解密密钥，同时更新管理后台和客户端。
- 不要把 `docker/.env`、生产配置和私钥提交进仓库。
- 对公网只开放管理后台和 API。MySQL 的 `3306` 和 Redis 的 `6379` 留在内网。
- 备份数据库数据目录和 `uploadfile`。笔记正文在数据库里，附件在文件目录里。

## 后期功能规划

下列能力已进入设计或规划，但尚未排进当前开发。若你需要其中某一项，请给仓库点 [Star](https://github.com/zyw/v5notes)，并在 [Issues](https://github.com/zyw/v5notes/issues) 里投票或留言，帮助我们决定优先顺序。

1. **思维导图文件** — 在桌面客户端中创建、编辑、保存独立的思维导图文件，并与现有目录树、历史版本和回收站一起管理；后续还可在 Markdown 中引用同一张导图。设计方案见 [docs/superpowers/specs/2026-11-12-v5notes-client2-mindmap-design.md](docs/superpowers/specs/2026-11-12-v5notes-client2-mindmap-design.md)。
2. **AI 功能** — 首期做 **AI 写作助手**：选区改写、摘要/提纲、续写；也可由 AI **创建新笔记**，或把当前文档整体改写成指定风格（如微信公众号、小红书）并**另存为新文档**，不覆盖原文。默认关闭，由用户配置模型端点；结果需确认后再写入。后期再考虑跨笔记问答、语义搜索等知识增强能力。设计方案见 [docs/superpowers/specs/2026-11-12-v5notes-ai-writing-design.md](docs/superpowers/specs/2026-11-12-v5notes-ai-writing-design.md)。

## 仓库

- GitHub：https://github.com/zyw/v5notes
- Gitee：https://gitee.com/zyw/v5notes

仓库根目录以 [Apache License 2.0](LICENSE) 发布。后端与管理后台的组件许可见各自目录中的 `LICENSE`（MIT）。
