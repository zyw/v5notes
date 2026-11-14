# V5Notes Vault Client

本地优先的 Vault 桌面客户端（Tauri 2 + Vue 3）。与 Cloud 客户端 `v5notes-client2` **并列、互不合并**。

**双产品边界：** 同一账号可登录两个客户端；Cloud 笔记与 Vault 库默认不是同一份数据。Cloud 在服务端目录树；Vault 在本机文件夹，可选同步。

**请勿**把库放进网盘同步目录后再开官方 Sync（易产生双重冲突与幽灵改动）。

## 配置冻结

| 键 | 值 |
|---|---|
| `productName` | `V5Notes Vault` |
| `identifier` | `xin.v5ai.v5notes.vault` |
| deep link schemes | `["v5notes-vault"]` |
| 窗口标题 | `V5Notes Vault` |
| `deviceType` | `vault_client` |
| 默认 `client_id` | `b8e4f02a5c3d7916f2a0b1d9e7c5f3a1` |

依据：`docs/vault-client-dev-plan.md`、`docs/vault-client-design.md`。

## 开发

```bash
cd v5notes-vault-client
npm install
npm run tauri dev
```

Vite 开发端口为 **1421**（Cloud client2 使用 1420）。浏览器单独打开 Vite 只能看欢迎/设置 UI；创建/打开库与社交登录唤起需 Tauri 壳。

```bash
npm test          # path / account / search / trash
npm run build     # 前端类型检查 + 打包
```

## Phase 3（本阶段 · 可选账号）

- 设置页账号区：密码登录 / 社交登录（`app=vault` → `v5notes-vault://`）
- `deviceType=vault_client`；token 存 localStorage（vault 前缀），**从不存密码**；401/登出清 token
- 未登录仍可纯本地编辑；会话过期横幅不丢未保存草稿
- 双产品一句话 + 同步入口引导（SyncEngine 属 Phase 4，本阶段禁用）
- 套餐形态 B stub：Cloud 桶可读现网 `/client/account/quota`；Vault sync 桶待 Phase 4
- 后端：`justauth.vault-client-address`、sys_client 种子、OAuth 落地页 `app=vault`

## Phase 2（已落地）

- watcher / 本地搜索 / 最近库 / trash / 原子写 / 脏守卫 / 快捷键 / design tokens / 树 CRUD

## @v5md 编辑器 vendor

依赖与 Cloud 相同，来自 `vendor/v5md/*.tgz`（`@v5md/core|view|vue`）。

```bash
cp ../v5notes-client2/vendor/v5md/*.tgz vendor/v5md/
npm install
```
