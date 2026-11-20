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

依据：`docs/vault-client-design.md`（含插件系统、工程拍板与延期能力）。写插件看 **[`docs/vault-plugin-development.md`](../docs/vault-plugin-development.md)**；生成插件用 **[`packages/create-vault-plugin`](../packages/create-vault-plugin/)**，生成主题用 **[`packages/create-vault-theme`](../packages/create-vault-theme/)**。

## 开发

```bash
cd v5notes-clients/v5notes-vault-client
npm install
npm run tauri dev
```

Vite 开发端口为 **1421**（Cloud client2 使用 1420）。浏览器单独打开 Vite 只能看欢迎/设置 UI；创建/打开库与社交登录唤起需 Tauri 壳。

```bash
npm test          # path / account / search / trash / backup / publish …
npm run build     # 前端类型检查 + 打包
```

## 在线升级

桌面端可在应用内检查、下载并安装新版本（Tauri 2 updater，签名校验后安装，完成后重启）。

- **入口**：设置 → 关于本机 →「检查更新」。有结果后同一按钮变成「可更新至 x.y.z」；刚装完的版本会在「本版更新说明」里补看内容。
- **静默检查**：启动 8 秒后检查一次，之后每 6 小时最多一次。发现新版本时，如果正开着库就先收住提示，回到欢迎页再弹出；同一版本点过「稍后」后不再打扰，手动检查不受影响。
- **安装前排空**：安装前会先保存当前未保存的笔记；保存失败就停在「已下载，等待重启」，不重启、不丢内容。
- 设置页的 `updater.pubkey` 只用于**校验**更新包。私钥不进仓库。

### 发版

Vault 的更新清单是 **`vault-latest.json`**，Cloud（`v5notes-client2`）用的是 `latest.json`。
两份清单文件名不同，可以挂在**同一个 Release** 里互不覆盖，客户端各取各的地址：

```
https://github.com/zyw/v5notes/releases/latest/download/vault-latest.json   ← Vault
https://github.com/zyw/v5notes/releases/latest/download/latest.json         ← Cloud
```

**推荐做法：跟 Cloud 一起发在同一条 `v<版本>` Release 上**，这样 `releases/latest` 指向它，
已安装的 Vault 才能自动看到新版本。仓库根的 `.github/workflows/publish-vault-desktop.yml`
监听 `v*` tag，与 Cloud 的 workflow 并行执行，各自上传自己的包和自己的清单：

```bash
git tag v2.2.0 && git push origin v2.2.0
```

只发 Vault、不上 `releases/latest` 时，推 `vault-v<版本>` tag（或 Actions → Run workflow 手动指定 tag）。

1. 同步修改 Vault 的三处版本号：`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`。
2. 可选写 `releases/<版本>.md` 作为更新说明（工作流读这个路径；没有就留空）。

私钥只配进仓库 Secrets，**不进仓库**：

```bash
# 生成一对新密钥（私钥文件自己保管，填成 CI Secret）
npm run tauri -- signer generate -w ~/vault-updater.key
# GitHub → Settings → Secrets and variables → Actions
#   VAULT_SIGNING_PRIVATE_KEY           = ~/vault-updater.key 的整段内容（一行 base64）
#   VAULT_SIGNING_PRIVATE_KEY_PASSWORD  = 生成时设的口令（没设就留空）
```

换密钥时，把 `vault-updater.key.pub` 的 base64 填进 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`。

**手动发版**（不走 CI 时）：

1. 用更新私钥构建，`bundle.createUpdaterArtifacts` 会产出 `.app.tar.gz` / `_x64-setup.nsis.zip` 与同名 `.sig`。
2. 把 macOS 更新包改名为 `vault_aarch64.app.tar.gz`（及同名 `.sig`）。
3. 生成清单并作为附件上传到对应的 `v<版本>` Release：

```bash
python3 scripts/vault_latest_json.py \
  --assets-dir dist --version 2.2.0 --tag v2.2.0 \
  --repo zyw/v5notes --notes-file releases/2.2.0.md \
  --pub-date 2026-11-19T00:00:00Z --out dist/vault-latest.json
```

脚本只接受 `vault-latest.json` 这个文件名：写成 `latest.json` 会直接报错，免得盖掉 Cloud 的清单。

> - 首次发布的客户端必须自带当前 pubkey。换了密钥就换了信任根：老版本只能手动重新安装，之后才会自动升级。
> - 客户端固定拉 `releases/latest/download/vault-latest.json`，只有**最新正式 Release** 的附件能被读到。若这次只发在不带 `latest` 的 `vault-v*` Release 上，已安装的客户端不会看到它，需要把同一份清单也挂到最新 Release。

## Phase 8（本阶段 · 官方增值与双产品收尾）

- 设置页：**官方发布 / 分享** stub（`channel=product`，永不向第三方暴露 `publish:*`）
- **整库 zip 备份**（排除 trash / sync-state / index；文案强调备份 ≠ Sync）
- Cloud ↔ Vault **显式迁移说明**（确认后展示步骤，不自动合并）
- 帮助区双产品全文案；Cloud 并行轨登录/设置/资料页同步一句边界说明
- **不做**完整站点托管后端；**不**把 Vault 插件宿主引入 Cloud

### 插件与主题的归属

插件代码、主题包、启用状态是**全局**的，装在应用配置目录 `extensions/` 下，装一次所有库通用；没打开库也能加载和启用。

插件设置分两层：`loadData()` / `saveData()` 默认落**库层**（`<库>/.v5notes/plugins/<id>/data.json`，随库同步），显式传 `'global'` 才落**全局层**。库色与当前主题选择仍按库保存。

## Phase 7（已落地）

- `network:safe` + allowlist；Catalog `/vault/v1/catalog/...`（非 file-sync）
- Ribbon / SettingTab / View 轻量表面；拒 publishing 标签

## Phase 6（已落地）

- PluginHost P1 + Theme API；核心日记/模板；Safe Mode

## Phase 3–5（已落地）

- 可选账号 / SyncEngine / 冲突副本 / 设备管理 / 附件与配额文案

## Phase 2（已落地）

- watcher / 本地搜索 / 最近库 / trash / 原子写 / 脏守卫 / 快捷键 / design tokens / 树 CRUD

## @v5md 编辑器

依赖与 Cloud（`v5notes-client2`）相同，来自 npm：`@v5md/core|view|vue@0.0.8`。

开发时可设置 `V5MD_LOCAL_ROOT=/绝对路径/v5md npm run dev`（或 `npm run build`）指向本地 v5md 构建产物；未设置时使用 npm 锁定版本。