# 方向确认

- 2026-11-10 · 用户原话：「1. 方向 1b」「2. 「官方地址不可见」只显示"官方服务器"、不渲染 URL 做」「3. 可以」「4. 确认」
- 采用方向：**1b · 顶部连接卡**
- 官方地址：https://v5notes2.v5ai.xin（只作为代码常量 `OFFICIAL_SERVER`，页面不渲染）
- 登录页：删除服务器地址输入框，改为"服务器 · 官方服务器/自定义地址 + 更改"一行
- 改服务器：强制重新登录（确认后退出登录）；首次安装默认勾选「使用官方地址」
- 实现截图：`shots/implemented-settings-official.png`、`shots/implemented-settings-custom.png`、`shots/implemented-login.png`
