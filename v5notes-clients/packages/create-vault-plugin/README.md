# @v5notes/create-vault-plugin

给 `v5notes-vault-client` 生成一个**能被设置页直接加载**的功能插件。

宿主用 `new Function('Plugin', 'module', 'exports', src)` 加载 `main.js`，并且要求产物是
`module.exports = class ... extends Plugin`。这一步手工搭很容易写歪（打成 ESM、把 API 包一起打进去、目录名与 id 不一致），而宿主的失败方式大多是**静默跳过**。脚手架把这些约束前移到生成和构建时。

完整契约见 [`docs/vault-plugin-development.md`](../../../docs/vault-plugin-development.md)。

## 用法

```bash
cd v5notes-clients/packages/create-vault-plugin
node bin/create-vault-plugin.js <目录> [选项]
```

```bash
# 最小插件：只有一条命令
node bin/create-vault-plugin.js ../my-plugin --name "我的插件"

# 带侧栏图标、设置页、白名单联网
node bin/create-vault-plugin.js ../fetch-demo --id fetch-demo \
  --permissions ui:commands,ui:ribbon,ui:settings,network:safe \
  --allowlist api.example.com
```

| 选项 | 说明 |
|---|---|
| `--id <id>` | `[a-z0-9-]+`，**必须等于目录名**（省略时由目录名推导） |
| `--name <名称>` | 显示名，缺省由 id 推导 |
| `--permissions <列表>` | 逗号分隔，默认 `ui:commands` |
| `--allowlist <hosts>` | 逗号分隔；申请 `network:safe` 时必填 |
| `--description` / `--author` | 写进 manifest |
| `--version` / `--min-app-version` | 默认 `1.0.0` / `0.1.0` |

生成的插件按权限裁剪代码：只有申请了 `ui:ribbon` 才会出现 `addRibbonIcon`，只有 `ui:settings` 才会出现 `addSettingTab`。

## 生成后的开发循环

```bash
cd ../my-plugin
npm install
npm run build          # 校验 manifest，产出 main.js
npm run install:app    # 拷进 <应用配置目录>/extensions/plugins/<id>
```

然后在 **设置 → 插件与安全** 里点「启用」。**安装 ≠ 启用**；宿主没有文件监听，只改了代码时点「禁用」再「启用」即可重载。

`npm run install:app -- --app-dir <目录>` 可以把包装进指定的应用配置目录（或设 `V5NOTES_APP_CONFIG_DIR`），用于测试或 CI。

## 生成的结构

```
my-plugin/
  manifest.json          随包分发，构建时校验
  src/main.ts            源码；Plugin 由宿主注入，构建时被替换成加载器变量
  scripts/build.mjs      esbuild 打包 + 改写成 CJS 导出形状 + 拒绝打进去的 API 包
  scripts/install.mjs    拷到应用目录
  main.js                构建产物，随包分发
```

## 校验规则

生成时与构建时都会拦下宿主会拒绝或会静默跳过的情况：

- 目录名 ≠ `manifest.id`（宿主**静默跳过**，不报错）
- `network` / `publish:*` / `sync:control` / `fs:arbitrary` / `shell`（第三方永不发放）
- `network:safe` 缺少 `networkAllowlist`，或 allowlist 里带了协议 / 端口 / 路径
- 未知权限、`publishing` 类标签
- `minAppVersion` 高于当前宿主、`ui:status` / `editor:extend` / `clipboard`（宿主已接受但暂未接入）→ 只警告
- 产物里仍然引用 `@v5notes/vault-plugin-api`，或导出的不是 CJS 形式的 `Plugin` 子类

## 测试

```bash
npm test      # node:test，无需安装依赖
```

生成的插件自带 `esbuild` 依赖（`devDependencies`）；脚手架本身没有任何运行时依赖。
