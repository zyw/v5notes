# V5Notes

[简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md)

私有部署的雲端筆記。筆記以 Markdown 保存，可在管理後台與桌面用戶端閱讀、編輯，並在同一台伺服器上同步。

## 專案組成

| 目錄 | 作用 |
| --- | --- |
| `v5notes2` | 後端 API。Java 21、Spring Boot 4.1，提供登入、筆記、目錄、回收筒、檔案與管理介面。 |
| `v5notes-admin2` | 管理後台。Vue 3、TypeScript、Element Plus、Vite。 |
| `v5notes-client2` | 桌面用戶端。Vue 3 與 Tauri，線上讀寫 Markdown 筆記。 |

三端介面都支援簡體中文、繁體中文和英文。用戶端請求會帶上 `Content-Language`，後端依該語言回傳提示。

## 本機執行

先準備 MySQL 與 Redis，並依 `v5notes2/note-admin/src/main/resources/application-dev.yml` 填寫連線。

```bash
# 後端，預設連接埠 8080。資料庫結構在啟動時遷移。
cd v5notes2
mvn -DskipTests package
java -jar note-admin/target/v5notes2.jar --spring.profiles.active=dev
```

```bash
# 管理後台
cd v5notes-admin2
pnpm install
pnpm dev
```

```bash
# 桌面用戶端
cd v5notes-client2
npm install
npm run dev
npm run tauri dev
```

## 使用

1. 啟動後端。
2. 開啟管理後台，建立可登入的使用者。
3. 在用戶端填入伺服器位址、使用者名稱和密碼。

用戶端需要與伺服器一致的 `clientid`。若不一致，建置前設定 `VITE_CLIENT_ID`。若伺服器更換了登入用 RSA 公鑰，設定 `VITE_API_PUBLIC_KEY`。

## 倉庫

- GitHub: https://github.com/zyw/v5notes
- Gitee: https://gitee.com/zyw/v5notes
