# V5Notes

[简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md)

[![Java](https://img.shields.io/badge/Java-21-4479A1?logo=openjdk&logoColor=white)](v5notes2/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1-6DB33F?logo=springboot&logoColor=white)](v5notes2/)
[![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white)](v5notes-admin2/)
[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](v5notes-client2/)
[![License](https://img.shields.io/badge/License-Apache%202.0%20%2F%20MIT-blue)](LICENSE)

把想法留在自己的伺服器上。

V5Notes 是一套可以私有部署的 Markdown 雲端筆記。桌面用戶端負責寫作，管理後台負責人和權限，後端把目錄、正文、歷史版本和檔案收在你自己的資料庫裡。打開電腦就能寫，換一台電腦接著寫，筆記不會散落到別人的雲端硬碟裡。

本文說明三個目錄：[`v5notes2`](v5notes2/)、[`v5notes-admin2`](v5notes-admin2/)、[`v5notes-client2`](v5notes-client2/)。

## 目錄

- [它解決什麼問題](#它解決什麼問題)
- [三端如何配合](#三端如何配合)
- [介面截圖](#介面截圖)
- [功能一覽](#功能一覽)
- [技術棧](#技術棧)
- [環境準備](#環境準備)
- [本機執行](#本機執行)
- [部署](#部署)
- [二次開發](#二次開發)
- [設定](#設定)
- [常見問題](#常見問題)
- [上線前檢查](#上線前檢查)
- [後期功能規劃](#後期功能規劃)

## 它解決什麼問題

雲端筆記很好用，直到你想把資料拿回來。本機 Markdown 很自由，直到目錄、搜尋、誤刪和多裝置把事情變亂。V5Notes 把這兩件事合成一套你能自己安裝、自己備份、自己改的系統。

| 你遇到的情況 | V5Notes 的做法 |
| --- | --- |
| 筆記散落在聊天記錄、雲端硬碟和本機資料夾裡 | 一篇筆記就是一份 Markdown，按目錄歸好，按標題搜尋 |
| 希望資料留在自己的機器上 | API、MySQL 或 PostgreSQL、Redis、上傳檔案都由你部署 |
| 寫作介面堆滿了管理功能 | 桌面端只留下目錄、正文和寫作工具；使用者、角色、檔案和稽核放在管理後台 |
| 改亂了，或刪錯了一整棵目錄 | 正文保留可恢復的歷史版本；刪除先進入回收桶，30 天內可以找回 |
| 家裡或小團隊裡有不同語言的人 | 三端介面都支援簡體中文、繁體中文和英文 |

適合這些人：想自己託管筆記的個人，需要給家人或小團隊開通帳號的人，以及希望在一套現成的使用者、權限和筆記 API 上繼續做產品的開發者。

## 三端如何配合

```mermaid
flowchart LR
  Client["v5notes-client2<br/>桌面寫作"] -->|"/client/notes"| API["v5notes2<br/>API"]
  Admin["v5notes-admin2<br/>管理後台"] -->|"/notes · /system · /basics"| API
  API --> DB[("MySQL 或 PostgreSQL")]
  API --> Redis[("Redis")]
  API --> Files["本機檔案"]
```

| 目錄 | 你用它來 | 技術 |
| --- | --- | --- |
| [`v5notes2`](v5notes2/) | 登入、筆記、目錄、回收桶、歷史版本、檔案和管理介面 | Java 21、Spring Boot 4.1 |
| [`v5notes-admin2`](v5notes-admin2/) | 使用者與權限、筆記與目錄、檔案、登入和操作稽核 | Vue 3.5、TypeScript、Element Plus、Vite 8 |
| [`v5notes-client2`](v5notes-client2/) | 在 Windows、macOS、Linux 上閱讀和編輯 Markdown | Vue 3.5、TypeScript、Tauri 2 |

用戶端走 `/client/notes/**`，管理後台走 `/notes/**`、`/system/**` 和 `/basics/**`。同一套筆記服務同時服務兩端，雪花 ID 從介面到頁面始終按字串處理。

## 介面截圖

以下截圖來自實際執行的介面。桌面用戶端負責寫作，管理後台負責成員、筆記和系統狀態。

### 桌面用戶端

| 登入（淺色） | 登入（深色） |
|:---:|:---:|
| ![桌面用戶端登入頁：連線工作區、使用者名稱和密碼，淺色主題](images/client/登录-浅.png) | ![桌面用戶端登入頁，深色主題](images/client/登录-深.png) |

| 工作區首頁 | 深色主題 |
|:---:|:---:|
| ![工作區首頁：左側目錄樹與新增筆記入口](images/client/home-img.png) | ![深色主題下的閱讀檢視](images/client/home-dark.png) |

| 編輯模式 | 預覽模式 |
|:---:|:---:|
| ![所見即所得的編輯模式，工具列和已儲存狀態](images/client/编辑模式.png) | ![唯讀預覽模式，右上角可切回編輯](images/client/预览模式.png) |

| 原始碼模式 | 尋找 |
|:---:|:---:|
| ![原始碼模式：直接編輯 Markdown 原文](images/client/源码模式.png) | ![右側尋找面板與命中結果清單](images/client/查找.png) |

| 大綱 | 命令面板 |
|:---:|:---:|
| ![右側大綱面板，按標題層級跳轉](images/client/大纲操作.png) | ![命令面板：切換顯示模式、檢視、排版和匯出](images/client/命令面板.png) |

| 回收桶 | 歷史版本 |
|:---:|:---:|
| ![回收桶：剩餘 30 天，可還原或徹底刪除](images/client/回收站.png) | ![歷史版本：版本清單、正文預覽與還原](images/client/历史版本.png) |

| 設定 |
|:---:|
| ![設定：連線、語言、主題與工作區偏好](images/client/设置.png) |

### 管理後台

| 登入（淺色） | 登入（深色） |
|:---:|:---:|
| ![管理後台登入頁：帳號、密碼、驗證碼，淺色主題](images/admin/login-light.png) | ![管理後台登入頁，深色主題](images/admin/login-dark.png) |

| 工作台（淺色） | 工作台（深色） |
|:---:|:---:|
| ![工作台：筆記總數、活躍使用者、今日編輯與內容成長](images/admin/home-light.png) | ![深色主題下的工作台](images/admin/home-dark.png) |

| 筆記管理 | 成員管理 |
|:---:|:---:|
| ![筆記管理：目錄樹、篩選條件和筆記清單](images/admin/notes-light.png) | ![成員管理：部門結構、角色與存取範圍](images/admin/user-light.png) |

| 筆記歷史版本 |
|:---:|
| ![從管理後台檢視筆記歷史版本並還原](images/admin/his-light.png) |

## 功能一覽

**寫一篇筆記，就該這麼順**

- 左側是一棵目錄和筆記混在一起的樹：搜尋、新建、重新命名、刪除都在這裡完成。
- Markdown 編輯器支援預覽和編輯來回切換，復原記錄留在同一次編輯工作階段裡。
- 專注模式收起側欄，把視窗留給正文。
- 右側可以打開大綱，也可以在正文裡尋找。
- `Ctrl/Cmd + S` 儲存。有未儲存修改時，切換筆記或關閉視窗會先問你。

**刪得安心，改得回去**

- 筆記和目錄先進入回收桶，保留 30 天，可以恢復。
- 清空回收桶或徹底刪除時，才會連同正文版本一起清掉。
- 每篇筆記可以查看歷史版本，預覽後恢復。

**帳號和檔案有地方管**

- 管理後台提供使用者、部門、崗位、角色、選單、字典、參數、通知和用戶端設定。
- 線上使用者、登入日誌、操作日誌和快取監控用來看系統正在發生什麼。
- 檔案走本機儲存，上傳內容跟資料庫放在一起備份即可。
- 登入可以使用存取權杖和重新整理權杖。重新整理權杖預設 30 天、一次性輪換；用戶端不儲存密碼。

## 技術棧

| 層 | 選型 |
| --- | --- |
| 後端 | Java 21、Spring Boot 4.1.2、MyBatis-Plus 3.5、Sa-Token 1.46、Flyway、Redisson、Hutool |
| 管理後台 | Vue 3.5、TypeScript、Vite 8、Element Plus 2.14、Pinia、UnoCSS、vue-i18n |
| 桌面用戶端 | Vue 3.5、TypeScript、Vite 6、Tauri 2、`@v5md` 編輯器、vue-i18n |
| 資料 | MySQL 8.4 或 PostgreSQL，Redis 7.4 |
| 部署 | Docker Compose、可執行 Jar、Nginx 靜態站點 |

後端按 Maven 多模組組織，`groupId` 為 `xin.v5ai`：

| 模組 | 職責 |
| --- | --- |
| `note-admin` | 啟動入口 `xin.v5ai.V5Notes2Application`，登入、驗證碼、權杖 |
| `note-modules/note-notes` | 目錄樹、筆記、搜尋、回收桶、歷史版本、用戶端介面 |
| `note-modules/note-system` | 使用者、角色、選單、字典、部門、用戶端 |
| `note-modules/note-basics` | 本機檔案服務 |
| `note-common` | 安全、快取、資料存取、加解密等基礎設施 |

資料庫結構在 API 啟動時由 Flyway 遷移，指令碼位於 `v5notes2/note-admin/src/main/resources/db/migration`。MySQL 與 PostgreSQL 各有一套方言指令碼。

## 環境準備

| 工具 | 版本 |
| --- | --- |
| JDK | 21 |
| Maven | 3.9 或更高 |
| Node.js | 22.12+、24 或 26 |
| pnpm | 10 或更高，用於管理後台 |
| npm | 用於桌面用戶端 |
| Rust | 穩定版。只在打包或 `tauri dev` 時需要 |
| 資料庫 | MySQL 8 或 PostgreSQL |
| Redis | 7 |

三端介面語言可以在各自的介面裡切換。用戶端請求會帶上 `Content-Language`，後端依該語言回傳提示。

## 本機執行

先準備好 MySQL 和 Redis，再依 `v5notes2/note-admin/src/main/resources/application-dev.yml` 核對連線。開發庫預設名為 `v5notes2-dev`。

```bash
# 後端，預設連接埠 8080。首次啟動會執行 Flyway。
cd v5notes2
mvn -DskipTests package
java -jar note-admin/target/v5notes2.jar --spring.profiles.active=dev
```

```bash
# 管理後台。預設連接埠 80，/dev-api 代理到 http://localhost:8080。
# 80 連接埠需要權限時，修改 .env.development 裡的 VITE_APP_PORT。
cd v5notes-admin2
pnpm install
pnpm dev
```

```bash
# 桌面用戶端。瀏覽器開發位址為 http://127.0.0.1:1420。
cd v5notes-client2
npm install
npm run dev          # 只跑頁面
npm run tauri dev    # 帶桌面殼
npm test
```

介面文件由 SpringDoc 預設開啟，分組為通用模組、系統模組和雲端筆記。

## 部署

四種方式可以依情境挑選。資料庫表都由 API 啟動時的 Flyway 建立。使用 Flyway 時，不要再對同一個庫手工執行 `v5notes2/script/sql`。

### 方式一：Docker Compose

適合第一次把整套系統跑起來，也適合單機生產。Compose 會拉起 MySQL 8.4、Redis 7.4、API 和管理後台。映像只複製已經打好的產物，容器裡不編譯原始碼。

```bash
cd v5notes2
mvn -DskipTests package

cd ../v5notes-admin2
pnpm install
pnpm build

cd ../v5notes2/docker
cp env.example .env    # 對外服務前先改密碼
docker compose up -d --build
```

| 服務 | 預設位址 |
| --- | --- |
| 管理後台 | http://localhost:8988 |
| API | http://localhost:8080 |
| MySQL | `localhost:3306`，庫名 `v5notes2` |
| Redis | `localhost:6379` |

需要備份時，拷走這三個目錄：

| 資料 | 位置 |
| --- | --- |
| 資料庫 | `v5notes2/docker/mysql/data` |
| 快取持久化 | `v5notes2/docker/redis/data` |
| 上傳檔案 | `v5notes2/docker/uploadfile` |

MySQL 官方映像只在資料目錄為空時初始化 root 密碼。已經啟動過再改 `MYSQL_ROOT_PASSWORD`，要同時改 `.env` 裡的資料源密碼，或清空資料目錄後重建。

### 方式二：Jar 與 Nginx

適合已經有 MySQL、Redis，或者要把管理後台放到現有網域後面。

1. 打包 API，用 `prod` 設定啟動：

```bash
cd v5notes2
mvn -DskipTests package

export V5NOTES_DB_DIALECT=mysql
export V5NOTES_DATASOURCE_MYSQL_URL='jdbc:mysql://127.0.0.1:3306/v5notes2?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true&nullCatalogMeansCurrent=true'
export V5NOTES_DATASOURCE_MYSQL_USERNAME=v5notes
export V5NOTES_DATASOURCE_MYSQL_PASSWORD='請替換'
export V5NOTES_REDIS_HOST=127.0.0.1
export V5NOTES_REDIS_PASSWORD='請替換'
export V5NOTES_JWT_SECRET='請替換為一串足夠長的隨機字串'

java -jar note-admin/target/v5notes2.jar --spring.profiles.active=prod
```

用 systemd 託管時，可以把上面的環境變數寫進 `/etc/v5notes2.env`，再使用類似下面的服務：

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

2. 建置管理後台，並用 Nginx 託管 `dist/`。生產環境的介面前綴是 `/prod-api`：

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

`proxy_pass` 末尾的 `/` 會去掉 `/prod-api` 前綴，後端收到的仍是 `/auth/login` 這樣的路徑。

### 方式三：PostgreSQL

API 用同一個開關切換方言和 Flyway 目錄。先建空庫 `v5notes2`，再啟動：

```bash
export V5NOTES_DB_DIALECT=postgresql
export V5NOTES_DATASOURCE_POSTGRESQL_URL='jdbc:postgresql://127.0.0.1:5432/v5notes2'
export V5NOTES_DATASOURCE_POSTGRESQL_USERNAME=v5notes
export V5NOTES_DATASOURCE_POSTGRESQL_PASSWORD='請替換'
```

Docker Compose 預設附帶的是 MySQL。使用外部 PostgreSQL 時，把 API 的方言和連線指到那台資料庫，不要把 MySQL 指令碼匯入 PostgreSQL。

### 方式四：桌面安裝包

用戶端安裝後填寫伺服器位址即可，不需要和 API 裝在同一台機器上。打包需要本機已安裝 Rust：

```bash
cd v5notes-client2
npm install
npm run tauri build
```

安裝包出現在 `v5notes-client2/src-tauri/target/release/bundle/`，涵蓋 Tauri 目前平台能產出的 Windows、macOS 和 Linux 目標。應用內更新讀取 GitHub Releases 上的 `latest.json`。

若伺服器的用戶端編號或登入 RSA 公鑰與儲存庫預設值不同，打包前設定：

```bash
export VITE_CLIENT_ID='與 sys_client 中一致的用戶端編號'
export VITE_API_PUBLIC_KEY='與伺服器 api-decrypt 成對的公鑰'
```

### 第一次打開

1. 打開管理後台。初始管理員為 `admin` / `admin123`，登入需要驗證碼。進入後馬上修改密碼。
2. 新建一個使用者，使用者類型選擇「用戶端使用者」（`cli_user`）。桌面端只接受這一類帳號。
3. 打開桌面用戶端，伺服器填 API 位址，例如 `http://192.168.1.10:8080`，再用剛才的帳號進入。

Docker 部署時，管理後台是 [http://localhost:8988](http://localhost:8988)，用戶端裡的伺服器填 `http://localhost:8080`。從另一台電腦連線時，把 `localhost` 換成伺服器的區域網路或公網位址。

## 二次開發

三個目錄可以分開改。後端增加能力，管理後台和用戶端各自接自己的介面。

| 想做的事 | 從這裡開始 |
| --- | --- |
| 新的筆記、目錄、回收桶或版本介面 | `v5notes2/note-modules/note-notes` |
| 登入、驗證碼、存取權杖和重新整理權杖 | `v5notes2/note-admin` 中的 `xin.v5ai.web` |
| 使用者、角色、選單、字典 | `v5notes2/note-modules/note-system` |
| 上傳與本機檔案 | `v5notes2/note-modules/note-basics` |
| 管理後台頁面 | `v5notes-admin2/src/views` 與 `src/api` |
| 寫作介面、側欄、大綱、尋找 | `v5notes-client2/src` |
| 三語文案 | 管理後台與用戶端的 i18n，以及後端提示語 |
| 表結構 | `v5notes2/note-admin/src/main/resources/db/migration` |

建議的改動順序：

1. 在 `note-notes` 增加介面。用戶端路徑放在 `/client/notes` 下，管理端路徑放在 `/notes` 下，兩邊共用同一套服務。
2. 需要新表或新欄位時，為 MySQL 和 PostgreSQL 各增加一個更高版本號的 Flyway 指令碼。同一版本號不要在 `common` 和方言目錄裡各放一份。
3. 管理後台把頁面放到 `src/views`，介面放到 `src/api`。選單來自資料表 `sys_menu`，元件路徑與檔案路徑對應，例如 `notes/notes/index`。
4. 用戶端把請求集中在 `src/api.ts`，頁面只處理互動。目錄和筆記的編號全程使用字串。
5. 簡體中文、繁體中文、英文三套文案一起改。用戶端發出的 `Content-Language` 決定後端提示語的語言。

寫作體驗有幾條已經定下來的約定：

- 預覽和編輯共用同一個編輯器實例，這樣 Markdown 狀態和復原歷史還在。
- 切到預覽前先儲存。儲存失敗時留在編輯狀態。
- 刪除目錄要說明會連同子目錄和筆記一起進入回收桶。
- 對話框用應用內的模態框完成，帶標題、驗證和失敗後的錯誤資訊。
- 存取權杖放在記憶體裡，重新整理權杖可以留在本機，密碼不落地。

編輯器來自 `@v5md/vue`。區塊選單、拖曳手柄和排序屬於編輯器本身。用戶端鎖定了 `vendor/v5md` 中的套件；要換編輯器能力時，先更新這組相依再建置。

管理後台的常用命令：

```bash
pnpm dev
pnpm build
pnpm lint
```

更細的模組說明、重新整理權杖協定和完整環境變數見 [v5notes2/README.md](v5notes2/README.md)、[v5notes-admin2/README.md](v5notes-admin2/README.md)、[v5notes-client2/README.md](v5notes-client2/README.md)。

## 設定

未設定環境變數時，使用對應 profile 設定檔中的預設值。生產環境請明確設定密碼和金鑰。

| 變數 | 作用 |
| --- | --- |
| `V5NOTES_SERVER_PORT` | API 連接埠，預設 `8080` |
| `V5NOTES_DB_DIALECT` | `mysql` 或 `postgresql` |
| `V5NOTES_DATASOURCE_MYSQL_URL` | MySQL 連線字串 |
| `V5NOTES_DATASOURCE_MYSQL_USERNAME` / `PASSWORD` | MySQL 帳號 |
| `V5NOTES_DATASOURCE_POSTGRESQL_URL` | PostgreSQL 連線字串 |
| `V5NOTES_DATASOURCE_POSTGRESQL_USERNAME` / `PASSWORD` | PostgreSQL 帳號 |
| `V5NOTES_REDIS_HOST` / `PORT` / `PASSWORD` | Redis |
| `V5NOTES_JWT_SECRET` | 登入 JWT 金鑰 |
| `V5NOTES_API_DECRYPT_PUBLIC_KEY` / `PRIVATE_KEY` | 介面加解密金鑰，需與兩個前端成對 |
| `VITE_CLIENT_ID` | 用戶端編號，對應伺服器 `sys_client` |
| `VITE_API_PUBLIC_KEY` | 用戶端登入加密用的公鑰 |

Docker Compose 使用 `v5notes2/docker/.env`，變數名見 [env.example](v5notes2/docker/env.example)。那裡的 `MASTER_DATASOURCE_*` 會傳給容器內的資料源設定。

<details>
<summary>郵件、簡訊和第三方登入</summary>

| 變數 | 作用 |
| --- | --- |
| `V5NOTES_MAIL_ENABLED` / `HOST` / `PORT` / `FROM` / `USER` / `PASSWORD` | SMTP |
| `V5NOTES_SMS_ALIBABA_*` | 阿里雲簡訊 |
| `V5NOTES_SMS_TENCENT_*` | 騰訊雲簡訊 |
| `V5NOTES_GITEE_CLIENT_ID` / `CLIENT_SECRET` | Gitee 登入 |
| `V5NOTES_GITHUB_CLIENT_ID` / `CLIENT_SECRET` | GitHub 登入 |

欄位加密還可設定 `V5NOTES_MYBATIS_ENCRYPTOR_PASSWORD`、`PUBLIC_KEY`、`PRIVATE_KEY`。

</details>

## 常見問題

**啟動後資料庫裡沒有表。**  
確認 API 日誌裡 Flyway 已執行，並且 `V5NOTES_DB_DIALECT` 與真實資料庫一致。已有舊庫時，Flyway 會按 baseline 跳過已存在的版本。若庫裡已經有筆記表，卻又從 V2 開始遷移，請先閱讀 [v5notes2/README.md](v5notes2/README.md) 裡的 baseline 說明。

**管理後台頁面能開，介面全部失敗。**  
開發環境走 `/dev-api`，生產建置走 `/prod-api`。Nginx 需要把這個前綴反向代理到 API，並去掉前綴。

**桌面端無法登入。**  
依次核對：伺服器位址能從這台電腦存取、帳號的使用者類型是用戶端使用者、`clientid` 與伺服器一致、登入公鑰與伺服器 `api-decrypt` 成對。用戶端會先請求伺服器，再提交帳號密碼。

**兩個人同時編輯同一篇筆記。**  
後儲存的正文會覆蓋先儲存的那一份。需要找回時，打開這篇筆記的歷史版本。

**改了 Docker 裡的資料庫密碼，API 仍然連不上。**  
MySQL 資料目錄已經初始化後，只改 `MYSQL_ROOT_PASSWORD` 不會改變已有實例的密碼。讓 `.env` 中的 root 密碼和資料源密碼保持一致，或在空資料目錄上重新初始化。

## 上線前檢查

- 修改初始管理員 `admin` 的密碼，並為資料庫、Redis 設定獨立密碼。
- 設定 `V5NOTES_JWT_SECRET`，更換一對 API 加解密金鑰，同時更新管理後台和用戶端。
- 不要把 `docker/.env`、生產設定和私鑰提交進儲存庫。
- 對公網只開放管理後台和 API。MySQL 的 `3306` 和 Redis 的 `6379` 留在內網。
- 備份資料庫資料目錄和 `uploadfile`。筆記正文在資料庫裡，附件在檔案目錄裡。

## 後期功能規劃

下列能力已進入設計或規劃，但尚未排進目前開發。若你需要其中某一項，請給儲存庫點 [Star](https://github.com/zyw/v5notes)，並在 [Issues](https://github.com/zyw/v5notes/issues) 裡投票或留言，協助我們決定優先順序。

1. **思維導圖檔案** — 在桌面用戶端中建立、編輯、儲存獨立的思維導圖檔案，並與現有目錄樹、歷史版本和回收桶一起管理；後續還可在 Markdown 中引用同一張導圖。設計方案見 [docs/superpowers/specs/2026-11-12-v5notes-client2-mindmap-design.md](docs/superpowers/specs/2026-11-12-v5notes-client2-mindmap-design.md)。
2. **AI 功能** — 首期做 **AI 寫作助手**：選區改寫、摘要/大綱、續寫；也可由 AI **建立新筆記**，或把目前文件整體改寫成指定風格（如微信公眾號、小紅書）並**另存為新文件**，不覆蓋原文。預設關閉，由使用者設定模型端點；結果需確認後再寫入。後期再考慮跨筆記問答、語意搜尋等知識增強能力。設計方案見 [docs/superpowers/specs/2026-11-12-v5notes-ai-writing-design.md](docs/superpowers/specs/2026-11-12-v5notes-ai-writing-design.md)。

## 儲存庫

- GitHub：https://github.com/zyw/v5notes
- Gitee：https://gitee.com/zyw/v5notes

儲存庫根目錄以 [Apache License 2.0](LICENSE) 發布。後端與管理後台的元件授權見各自目錄中的 `LICENSE`（MIT）。
