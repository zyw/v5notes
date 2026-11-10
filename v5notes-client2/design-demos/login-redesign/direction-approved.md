# 方向确认 · 登录页深 / 浅主题

2026-11-10　用户原话：

> 为v5notes-client2的登录页面设计深/浅两种主题，设置旁添加一个切换按钮深、浅和自动三种模式一个按钮，把B · 版 / 三次套印作为浅色主题，把C · 影 / 写作的波形作为深色主题

## 采用

- **浅色主题 = B · 版 / 三次套印**：奶油纸底、细横纹、三张错位印版、印刷品式登录卡。
- **深色主题 = C · 影 / 写作的波形**：深墨绿暗场、青瓷波形、玻璃登录板。
- 两套主题共用同一份 DOM 与内容，只换设计令牌与两个图层（印版 / 波形）。
- 登录页右上角、设置齿轮左侧，新增**一个**主题按钮，循环 **自动 → 浅色 → 深色**；auto 跟随系统并实时响应系统切换；选择记在 `localStorage` 的 `v5notes-login-theme`。

## 落地位置

- `src/views/LoginView.vue`（结构、主题按钮、展示区）
- `src/styles/login.css`（新增；两套主题的令牌与动效）
- `src/styles/style.css`（移除旧的登录页规则，避免和新样式打架）
- `src/hooks/useLoginTheme.ts`、`src/models/loginTheme.ts`（+ 单测）
- `src/i18n/{zh-CN,zh-TW,en}.ts`（主题词、展示区文案）
- `src/main.ts`（引入 login.css）

## 验证截图

- 桌面 1440×900：`shots/impl-light.png` / `shots/impl-dark.png`
- 1280×800：`shots/impl-light-1280.png` / `shots/impl-dark-1280.png`
- 375×812：`shots/impl-light-375.png` / `shots/impl-dark-375.png`
- 错误态：`shots/impl-light-error.png` / `shots/impl-dark-error.png`；自动模式：`shots/impl-auto.png`
- 真实入口（`/`）：`shots/impl-app-login.png`
- 预览入口：`design-demos/login-redesign/preview-login.html?theme=light|dark|auto&state=error|busy&motion=off`
## 工作区深色主题（2026-11-10 第三轮）

用户原话：

> 根据深色 · C / 写作的波形深色主题，给登录进去的页面也设计一套深色主题

这是**已选定 C 方向的延伸**（同一项目内已确认方向的迭代），不另开三方向门。

### 采用

- 工作区整体沿用 C 的深墨绿地面、青瓷强调、暖纸色文字；登录页仍是同一套主题的入口。
- 深色不是「反相」：编辑器纸面比外壳略亮一档（#0e2a24 对 #0b2621），侧栏更暗（#09211d），选中行用青瓷 13% 底 + 2px 内左线；编辑器右下角保留一层几乎看不见的青瓷雾光（和登录页同一个光源）。
- 浅色主题一行未改：所有深色规则都在 src/styles/dark.css，作用域 html[data-theme="dark"]。

### 主题控制

- 主题成为**应用级**状态：html 上的 data-theme 与 color-scheme，登录页与工作区共用。
- 设置弹窗「通用」新增三态控件：**自动 / 浅色 / 深色**；登录页右上角的单按钮循环仍在，两者读写同一个状态。
- 存储键从 v5notes-login-theme 升级为 v5notes-theme，旧键读取兼容。
- auto 跟随 prefers-color-scheme，系统切换时实时更新。

### 落地位置

- 新增 src/styles/dark.css（工作区 + 编辑器 + 全部弹窗的深色覆盖）
- 新增 src/hooks/useAppTheme.ts；src/models/loginTheme.ts 扩展为应用级键与迁移
- src/main.ts 启动主题；SettingsDialog.vue 加主题控件；LoginView.vue 改用共享状态
- src/i18n/{zh-CN,zh-TW,en}.ts：设置里的主题文案

### 验证截图

- 工作区 1440×900：shots/ws-dark-preview.png（预览）、ws-dark-edit.png（编辑）、ws-dark-settings.png（设置）、ws-dark-history.png、ws-dark-palette.png、ws-dark-trash.png、ws-dark-profile.png
- 1280×800：ws-dark-1280.png；1024×700：ws-dark-1024.png
- 浅色回归：ws-light-settings.png；切换验证：ws-theme-light.png（在设置里点「浅色」后整个工作区变浅）
- 复现：node design-demos/login-redesign/tools/mock-server.mjs，再打开 seed-workspace.html?theme=dark
