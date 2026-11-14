# V5Notes Vault Client

本地优先的 Vault 桌面客户端（Tauri 2 + Vue 3）。与 Cloud 客户端 `v5notes-client2` **并列、互不合并**。

**双产品边界：** 同一账号可登录两个客户端；Cloud 笔记与 Vault 库默认不是同一份数据。Cloud 在服务端目录树；Vault 在本机文件夹，可选同步。

**请勿**把库放进网盘同步目录后再开官方 Sync（易产生双重冲突与幽灵改动）。

## Phase 0 冻结（脚手架）

| 键 | 值 |
|---|---|
| `productName` | `V5Notes Vault` |
| `identifier` | `xin.v5ai.v5notes.vault` |
| deep link schemes | `["v5notes-vault"]` |
| 窗口标题 | `V5Notes Vault` |
| `deviceType`（后续账号） | `vault_client` |

依据：`docs/vault-client-dev-plan.md`、`docs/vault-client-design.md`。

## 开发

```bash
cd v5notes-vault-client
npm install
npm run tauri dev
```

Vite 开发端口为 **1421**（Cloud client2 使用 1420）。

## @v5md 编辑器 vendor

依赖与 Cloud 相同，来自 `vendor/v5md/*.tgz`（`@v5md/core|view|vue`）。

同步方式（Phase 0）：从 `v5notes-client2/vendor/v5md/` **复制**同版本 tgz。升级编辑器时两边同步复制，暂不建 npm workspace。

```bash
cp ../v5notes-client2/vendor/v5md/*.tgz vendor/v5md/
npm install
```

## 本阶段范围

- 欢迎占位页 + 空设置页
- `vault.json` / `sync-state.json` 类型与 JSON Schema 草稿
- 错误码枚举草稿（TS；Java 在 `note-vault-sync`）
- **未实现** 本地建库 / CRUD / 同步（Phase 1+）
