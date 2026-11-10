# v5notes-admin2 管理后台

V5Notes 管理后台，使用 Vue 3.5、Element Plus 2.14 和 Vite 8，对接 `v5notes2` 后端。

## 开发

```bash
pnpm install
pnpm dev          # 默认 80 端口，/dev-api 代理到 http://localhost:8080
```

## 构建

```bash
pnpm build        # 产物 dist/
```

## 已移植页面

- 笔记管理：`src/views/notes/notes/index.vue`（含列表、编辑器、预览）
- 目录管理：`src/views/notes/directory/index.vue`
- 文件管理：`src/views/basics/file/index.vue`、`config.vue`
- 对应 API：`src/api/notes/**`、`src/api/basics/**`

菜单由后端 `sys_menu` 驱动，组件路径保持 `notes/notes/index`、`notes/directory/index`、`basics/file/index`。

## 接口加密

`.env.development/.production` 的 `VITE_APP_RSA_PUBLIC_KEY/PRIVATE_KEY` 已与 `v5notes2` 的 `api-decrypt` 对齐（复用旧 v5notes 密钥对，兼容 v5notes-client2）。
