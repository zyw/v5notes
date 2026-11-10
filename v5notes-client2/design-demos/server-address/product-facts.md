# 事实核查（代码层）

> 依据：v5notes-client2 当前工作区（2026-11-10）。官方地址由用户指定：https://v5notes2.v5ai.xin

## 已有机制

| 事实 | 位置 |
| --- | --- |
| 服务器地址存在 localStorage `v5notes-server` | src/hooks/useWorkspace.ts:19 |
| 登录成功后写入 `v5notes-server` | src/hooks/useWorkspace.ts:341 |
| 登录前校验：`new URL(server)` 且协议必须是 http/https | src/hooks/useWorkspace.ts:315-316 |
| 所有 API 用 server 拼基址：`${server.replace(/\/+$/,'')}${path}` | src/service/request/index.ts:48 |
| token / refreshToken 属于某台服务器的账号，换服务器即失效 | src/hooks/useWorkspace.ts:22-23, 71-76 |
| 换账号/换服务器时若有草稿，会先弹确认再清草稿 | src/hooks/useWorkspace.ts:317-329 |
| 登录页右上齿轮可打开同一个设置弹窗（登录前后都能用） | src/views/LoginView.vue:21 / WorkspaceView.vue:17-18,26 |
| 登录页目前有"服务器地址"输入框 | src/views/LoginView.vue:29 |
| 设置弹窗结构已重构为宽版（720px）+ 底部关于条 | src/components/SettingsDialog.vue, src/styles/style.css:338-371 |

## 由需求推导出的实现约束

1. 官方地址是**代码常量**，页面上只出现"官方服务器"字样，不渲染 URL 明文（`页面不可见`）。
2. 勾选"使用官方地址"时地址输入框 disabled，提交值直接取常量。
3. 保存后若服务器地址发生变化，旧 token 一定无效 → 清 token（必要时清草稿）并回到登录页。
4. 登录页移除服务器地址输入框，只保留"当前服务器"状态 + 打开设置入口（齿轮已存在）。
5. 首次启动没有保存地址时，默认使用官方地址（勾选状态）。

## 待用户确认（见 directions.md 末尾）

- 官方地址"不可见"的呈现形态；登录页是否完全移除输入框；改地址是否强制重新登录；首次默认是否勾选官方。
