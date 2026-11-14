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
| `deviceType`（后续账号） | `vault_client` |

依据：`docs/vault-client-dev-plan.md`、`docs/vault-client-design.md`。

## 开发

```bash
cd v5notes-vault-client
npm install
npm run tauri dev
```

Vite 开发端口为 **1421**（Cloud client2 使用 1420）。浏览器单独打开 Vite 只能看欢迎 UI；创建/打开库需 Tauri 壳。

```bash
npm test          # path identity 等单测
npm run build     # 前端类型检查 + 打包
```

## @v5md 编辑器 vendor

依赖与 Cloud 相同，来自 `vendor/v5md/*.tgz`（`@v5md/core|view|vue`）。

```bash
cp ../v5notes-client2/vendor/v5md/*.tgz vendor/v5md/
npm install
```

## Phase 1（本阶段）

- 路径身份键：`normalizeDisplayPath` / `toIdentityKey`（NFC + case-fold，§6.2）
- `VaultFs` + `VaultWorkspace`：创建/打开/默认库，写入 `.v5notes` 骨架
- 欢迎页三路径 + 最近库（localStorage 桩）
- 侧栏树 + 打开 `.md` → `V5Editor`（预览/编辑同实例；回预览前保存）
- **零网络、零账号、零同步**

尚未包含（Phase 1b / Phase 2）：本地搜索、watcher、原子写 hardening、移盘书签持久化打磨、trash UX、脏导航守卫完善、设计 token。
