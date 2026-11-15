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
npm test          # path / account / search / trash / backup / publish …
npm run build     # 前端类型检查 + 打包
```

## Phase 8（本阶段 · 官方增值与双产品收尾）

- 设置页：**官方发布 / 分享** stub（`channel=product`，永不向第三方暴露 `publish:*`）
- **整库 zip 备份**（排除 trash / sync-state / index；文案强调备份 ≠ Sync）
- Cloud ↔ Vault **显式迁移说明**（确认后展示步骤，不自动合并）
- 帮助区双产品全文案；Cloud 并行轨登录/设置/资料页同步一句边界说明
- **不做**完整站点托管后端；**不**把 Vault 插件宿主引入 Cloud

## Phase 7（已落地）

- `network:safe` + allowlist；Catalog `/vault/v1/catalog/...`（非 file-sync）
- Ribbon / SettingTab / View 轻量表面；拒 publishing 标签

## Phase 6（已落地）

- PluginHost P1 + Theme API；核心日记/模板；Safe Mode

## Phase 3–5（已落地）

- 可选账号 / SyncEngine / 冲突副本 / 设备管理 / 附件与配额文案

## Phase 2（已落地）

- watcher / 本地搜索 / 最近库 / trash / 原子写 / 脏守卫 / 快捷键 / design tokens / 树 CRUD

## @v5md 编辑器 vendor

依赖与 Cloud 相同，来自 `vendor/v5md/*.tgz`（`@v5md/core|view|vue`）。

```bash
cp ../v5notes-client2/vendor/v5md/*.tgz vendor/v5md/
npm install
```
