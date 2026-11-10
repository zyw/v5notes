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
