# 设置页美化 · 三方向初稿

状态：**已选定 dir-6.html**（02 侧栏 + 01 单列内容 + 02 面板），已落地 `SettingsView.vue`（2026-11-17）。

## 先看

- `compare.png` — 三版首屏并排
- `dir-1.html` — 01 案头（整页）
- `dir-2.html` — 02 工作台（整页）
- `dir-3.html` — 03 书页（单屏翻页）
- `thumbs.png` — 六候选缩略图（含未展开的 02 仪器 / 04 索引 / 05 白盒）
- `dir-4.html` / `dir-4.png` — 混合稿：02 工作台骨架 + 01 案头目录（用户 2026-11-17 指定）
- `dir-5.html` / `dir-5.png` — 混合稿：01 布局 + 02 panel 分区（用户 2026-11-17 指定）
- `dir-6.html` / `dir-6.png` — 混合稿：02 侧栏 + 01 内容布局 + 02 panel 分区（用户 2026-11-17 指定）
- `ref-client2.png` — v5notes-client2 设置弹窗实拍参考
- `spec.md` — 统一 spec
- `directions.md` — 六张方向卡 + 为什么做这三张

## 截图

| 方向 | 截图 | 尺寸 |
|---|---|---|
| 01 案头 | `dir-1.png` | 1280×3801 |
| 02 工作台 | `dir-2.png` | 1280×1281 |
| 03 书页 | `dir-3.png` | 1280×900 |
| 03 外观章 | `dir-3-appearance.png` | 1280×900 |
| 03 插件章 | `dir-3-plugins.png` | 1280×900 |
| 01 滚动后（目录吸附） | `dir-1-scroll.png` | 1280×900 |
| 混合稿 | `dir-4.png` | 1280×1254 |
| 混合稿 · 1032 窗口 | `dir-4-1032.png` | 1032×900 |
| 01 布局 + 02 面板 | `dir-5.png` | 1280×2952 |
| 01 布局 + 02 面板 · 1032 | `dir-5-1032.png` | 1032×900 |
| 02 侧栏 + 01 内容 + 02 面板 | `dir-6.png` | 1280×2926 |
| 02 侧栏 · 1032 | `dir-6-1032.png` | 1032×900 |
| 误读 06 的书页版（已废弃） | `final-account-light.png` | 1280×900 |
| 误读 06 的书页版（已废弃） | `final-appearance-light.png` | 1280×900 |
| 误读 06 的书页版（已废弃） | `final-appearance-dark.png` | 1280×900 |
| 误读 06 的书页版（已废弃） | `final-1032.png` | 1032×900 |
| **落地 · dir-6 账户** | **`dir6-final-account.png`** | 1280×900 |
| **落地 · dir-6 外观** | **`dir6-final-appearance.png`** | 1280×900 |
| **落地 · dir-6 暗色** | **`dir6-final-dark.png`** | 1280×900 |
| **落地 · dir-6 · 1032** | **`dir6-final-1032.png`** | 1032×900 |

## 验证

- headless Chrome 1280×900 渲染；CDP 控制台 0 报错。
- 目录 scroll-spy、搜索过滤、翻页/方向键、主题/色模式/库色、可见性、switch 均已实测。
- `design_lint.py check` 因本机未安装 Python playwright 跳过；见 `spec.md` 的说明。

## 一句话

三版都从 v5notes-client2 的同一套语言里长出来：暖纸、墨绿、衬线标题、细线、紧凑 preference row、switch。差别在骨架：一条页边目录、一个控制台、一本对开册子。

## 混合稿说明

用户要求「2 的骨架 + 01 的目录」。`dir-4.html` 保留 02 的工作台骨架：四格状态条、12 栏面板、紧凑 preference row、switch、面板头图标；侧栏换成 01 的页边目录：serif 标题、01–08 编号、发丝线、朱砂 active，去掉图标。主区去掉重复的「设置」大标题，只留一句衬线 lede 与搜索/未登录；面板仍按 02 的平衡排布（7/5、4/4/4、7/5、12）。

## 01 布局 + 02 面板说明

用户要求「01 的布局 + 02 的 panel 区分区域」。`dir-5.html` 保留 01 的页边目录、serif 大标题、780px 单列、lede 与状态条；把 8 节内容各自放进 02 的面板：图标 chip + 编号 + serif 标题 + 状态标签，渐变底、1px 暖灰边、15px 圆角，面板内沿用 02 的紧凑 row / switch / 输入 / 主题预览。面板按 01–08 纵向排列，与左侧目录一一对应。

## 02 侧栏 + 01 内容 + 02 面板说明

用户要求左侧也换成 02 的侧栏样式。`dir-6.html` 把左侧换成 02 的完整侧栏：品牌、serif「设置」+08、图标导航、绿色 active pill、底部账号块；右侧仍是 01 的单列内容布局与 02 的分区面板（820px 单列、图标 + 编号 + serif 标题 + 状态）；1032 窗口自适应。

## 落地记录（2026-11-17）

最终选定：**dir-6.html** —— 02 侧栏 + 01 单列内容 + 02 面板。

经过一次误读：用户说「06」时我按六候选 06「书页」落地；用户纠正「让你给改成dir-6.html这个样子」，已改为 dir-6 并替换书页版本。

改动：

- `src/views/SettingsView.vue`：232px 02 侧栏（品牌/设置/图标导航/绿色 active pill/说明/底部账号）+ 820px 单列；面板头 = 编号 + 图标 + serif 标题 + 状态；账户章 2 列表单；scroll-spy 联动侧栏。
- `src/App.vue`：settings 页加入 `main-fill` 与 `is-settings`。
- `src/styles/style.css`：`.shell.is-settings .main-fill` 全幅铺满、内部滚动。
- `AccountPanel.vue` 未改逻辑；书页/面板模式通过 scoped `:deep` 覆盖排版。

验证：

- `npm run build` 通过（vue-tsc + vite）。
- `npm run test` 22 个文件 / 92 项全部通过。
- Chrome 1280×900、1032×900 实测；侧栏滚动联动、章节内容、主题/色模式、发布可见性、迁移弹窗、目录刷新均正常；无 JS error。
- 截图：`dir6-final-account.png`、`dir6-final-appearance.png`、`dir6-final-dark.png`、`dir6-final-1032.png`。
