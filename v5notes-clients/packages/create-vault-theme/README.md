# @v5notes/create-vault-theme

给 `v5notes-vault-client` 生成一个**能被外观设置选中**的主题包。

主题不是「插件顺便注入一段 CSS」。宿主对 `theme.css` 有一套硬规则，违反任何一条都会**静默回退到「默认」**，界面上只说一句「CSS 校验失败」。脚手架把这些规则变成生成时的校验，并在构建时再跑一遍。

完整契约见 [`docs/vault-plugin-development.md`](../../../docs/vault-plugin-development.md) 第六节。

## 用法

```bash
cd v5notes-clients/packages/create-vault-theme
node bin/create-vault-theme.js <目录> [选项]
```

```bash
node bin/create-vault-theme.js ../ink-night --name "墨夜"

# 指定主色与底色
node bin/create-vault-theme.js ../paper-rose --accent brick --mode cool
```

| 选项 | 说明 |
|---|---|
| `--id <id>` | `[a-z0-9-]+`，**必须等于目录名**；省略时由目录名推导 |
| `--name <名称>` | 显示名，默认由 id 推导 |
| `--accent <颜色>` | 预设 `moss` `indigo` `brick` `plum` `amber` `slate`，或 `#rgb` / `#rrggbb`；缺省按 id 稳定挑一个 |
| `--mode <warm\|cool>` | 底色：暖纸（默认）/ 冷灰 |
| `--description` / `--version` | 写进 manifest，默认 `1.0.0` |

`default` 与 `dusk` 是内置主题 id，宿主解析时优先命中内置，不会使用你的包。

## 生成的结构

```
ink-night/
  manifest.json      kind: "theme"，入口 theme.css
  theme.css          浅色 / 深色 / 明暗安全网三段，全部限定到本主题
  theme.json         modes 与 accent（宿主不读，给设置页预览用）
  scripts/build.mjs  校验 + 输出 dist/
  scripts/install.mjs 拷进 <应用配置目录>/extensions/themes/<id>
```

`theme.css` 是**普通文本，直接改**。生成器只是给出一份能通过校验的起点：一个主色推出来的整套浅色/深色 token。

## 开发循环

```bash
cd ../ink-night
npm run check          # 只校验
npm run build          # 校验并输出 dist/
npm run install:app    # 拷进应用目录
```

然后在 **设置 → 外观** 里选中它。注意：装的主题全机共享，**当前用哪个主题是每个库各自的**（写在库内 `.v5notes/appearance.json`），所以换个库要重新选一次。

## 构建时校验的规则

- 每条规则都必须以 `:root[data-community-theme='<id>']` 开头——未限定的 `:root` 在切换主题后仍然生效，表现为「换了主题没反应」
- 拒绝 `@import`、远程 `url()`、`position: fixed`、`expression()`、`javascript:`、`behavior`、`* { all: unset }`、`* { display:none }`
- 必须定义至少一半的设计 token：`--bg --panel --ink --muted --line --accent --accent-hover --surface --danger --danger-bg`
- manifest：`kind` 必须是 `theme`，只能申请 `ui:theme` / `ui:settings` / `ui:commands`，不能有 `main`
- 警告项：缺深色 palette、`--vault` 没带 `!important`（应用把库色写成行内样式，不带就会被盖住）

## 测试

```bash
npm test      # node:test，无依赖
```
