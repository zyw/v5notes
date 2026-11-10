# 客户端现状与重构方案

本文聚焦 `v5notes-client/`，用于决定如何重新开发客户端。事实部分来自当前仓库；方案是建议，不代表已经选型或实现。讨论的客户端是 Windows、macOS、Linux 桌面应用，后端仍沿用现有 Java API。如果目标改成纯网页或移动端，需要重新评估部署、跨域、系统集成和交互。

## 一句话结论

当前客户端的笔记业务基本由 `frontend/` 中的 Vue 3 页面直接调用后端完成；ElectronEgg 主要提供窗口、托盘、平台检测和打包。因此，**若目的是摆脱 ElectronEgg、尽量复用现有界面与后端，优先评估 Tauri 2 + Vue 3**。若主要诉求是尽快交付并保留 Chromium 一致性，则用精简的原生 Electron 壳替换 ElectronEgg 更稳妥。是否需要离线笔记和多设备冲突合并，将显著改变工作量，目前代码没有对应的本地数据层。

## 代码分层

| 层 | 位置 | 现状与迁移边界 |
| --- | --- | --- |
| 桌面主进程 | `electron/index.js`、`electron/controller/basic.js` | 窗口大小、最大化/全屏、关闭、平台查询；重写桌面壳时要替换 |
| 桌面扩展 | `electron/addon/`、`electron/preload/` | 托盘关闭隐藏、调试限制、协议唤醒、更新器；分清启用与实际使用 |
| 桌面调用 | `frontend/src/api/ipcMain.ts`、`utils/ipcRenderer.ts`、`utils/platform.ts` | Vue 通过 IPC 调窗口功能；迁移的集中改造点 |
| HTTP 与会话 | `frontend/src/utils/request.ts`、`auth.ts`、`stores/modules/user.ts`、`global.ts` | 客户端 ID、token、请求加解密、服务器地址和用户信息；保留协议，重做存储与错误处理 |
| 笔记业务 | `frontend/src/api/{notes,dir,login,user}/`、`views/`、`components/` | Vue 视图、目录树、搜索、笔记 CRUD、Vditor；可以逐页迁移或保留 |
| 构建 | 根 `package.json`、`frontend/package.json`、`electron/config/builder.json` | ElectronEgg/ee-bin、Vite、electron-builder 两套依赖与打包链 |

运行链路：启动桌面壳 -> 加载打包后的 Vue 静态页面 -> 登录页输入后端地址并 ping -> 以 `clientPassword` 登录 -> 浏览目录/笔记 -> Vditor 编辑 Markdown -> HTTP 保存到后端。笔记内容不经 Electron 主进程或本地数据库；客户端代码没有实现离线同步队列。`electron/jobs/example/`、`service/basic.js` 中的示例/简单服务不是笔记数据的持久化层。

## 用户功能与桌面能力

| 能力 | 当前实现 | 新客户端最低验收 |
| --- | --- | --- |
| 连接与登录 | 登录页填写服务器 URL；`GET /client/ping`；`POST /auth/login`，随后 `/system/user/getInfo` | 自定义服务器、错误反馈、会话过期、客户端用户类型 |
| 目录与列表 | 左侧目录/笔记树、最近笔记、右侧分页列表、搜索弹窗 | 根目录、子目录、最近列表、分页、搜索、重命名及递归删除确认 |
| Markdown | Vditor 即时渲染模式，按钮保存；路由离开时提示 | 长文本、切换笔记、未保存提示、保存失败重试 |
| 文件 | Vditor 图片/附件上传到 `/basics/base/file`，头像上传组件 | multipart 上传、token/clientid、返回 URL 的 Markdown 插入与显示 |
| 窗口 | 登录 `800×600`；主界面 `1200×800`；平台窗口按钮、最小化/最大化/全屏 | 各平台标题栏、窗口状态同步、关闭与退出含义 |
| 托盘 | 关闭主窗口时隐藏到托盘；托盘菜单“显示/退出” | 决定是否继续保留；保留时测试系统退出和后台驻留 |
| 更新/唤醒 | 更新插件配置为各平台 `false`；`ee` 协议的解析代码存在 | 若决定启用更新或深链，另行设计发布、签名和协议行为 |

桌面壳的配置目前 `contextIsolation: false`、`nodeIntegration: true`，渲染进程可直接访问 Electron。更新插件虽然有实现，但 `config.default.js` 的 Windows/macOS/Linux 开关均关闭；不能把它当成已上线的自动更新能力。托盘创建在 `electron/preload/index.js` 中，关闭窗口时的隐藏逻辑在 `addon/tray/index.js`。

## 后端兼容契约

重构不需要改数据库，但必须核实以下协议；控制器、BO/VO 和客户端封装是准绳：

1. **登录**：`POST /auth/login`，请求含 `tenantId`（当前页面为 `000000`）、`username`、`password`、`clientId`、`grantType=clientPassword`、`deviceType=pc_client`。当前 `ClientPasswordAuthStrategy` 要求用户类型为客户端用户；请求头也使用 `clientid`。
2. **会话**：API 请求带 `Authorization: Bearer <token>` 和 `clientid`，401 时重新登录。现有 token、用户信息和服务器 URL 放在浏览器 `localStorage`/Pinia 持久化中。新桌面壳建议将凭据交给平台安全存储，并使清除凭据与退出登录一致。
3. **目录**：`/client/notes/dir` CRUD，`/tree-dir`（仅目录），`/tree`（目录+笔记）。`pid=0` 是根目录；删除目录会递归删除其子目录和笔记，属于破坏性操作。
4. **笔记**：`/client/notes` CRUD，`/list?dirId=...`、`/search?searchValue=...`、`/new-notes`。列表使用 `dirId=0` 表示全部，`1` 表示最近入口；普通目录使用真实 ID。编辑器读取 `/{id}` 后用 PUT 保存 Markdown 内容。
5. **ID 与响应**：后端雪花 ID 超出 JS 安全整数范围时由 `BigNumberSerializer` 序列化为字符串，小值（例如根目录的 `0`）可能为数字。现有客户端现已在 HTTP 响应入口将 ID 字段统一转成**字符串**，且拒绝已失精的数字 ID；分页的 `total`、节点的 `type` 等计数/枚举仍保持数字。新客户端沿用这个约定，并适配响应的 `code`、`msg`、`data` 和分页 `rows`、`total`。
6. **文件与加密**：文件上传是 `POST /basics/base/file` 的 multipart，须带 token 和 `clientid`；Vditor 自定义格式把后端返回的 `data.url` 转为编辑器格式。前后端环境文件有加密开关和配对密钥，迁移时须通过实际登录/上传联调验证，不要仅凭变量名假设加密已生效。

服务端 `ResourcesConfig` 配置了通用 CORS 过滤器，但新壳的 WebView、浏览器与上传请求仍需分别联调，特别是自定义服务 URL、预检请求和图片访问。

## 重构时先处理的现存风险

- **未保存内容**：`router/permission.ts` 在离开编辑页时调用确认框，但 `handleSaveContent()` 不等待用户选择就被调用；`finally` 中会继续导航并清除标记。新流程要明确“保存并离开 / 放弃并离开 / 继续编辑”，保存成功后才能离开。
- **ID 类型（本仓库已调整）**：笔记、目录、用户、文件及左侧菜单的 ID 类型改为字符串；HTTP 响应入口对小值 ID 做字符串规范化。重建客户端时仍需覆盖根节点、雪花 ID、路由参数和 CRUD 的完整链路，不能把 ID 转为 `number`。
- **安全存储与桌面权限**：现有 token 在 localStorage，且 Electron 渲染进程启用了 Node 集成。更换壳时应收窄系统调用入口，凭据与主进程能力分别管理。
- **加密开关细节**：登录调用传 `isEncrypt: true`，请求拦截器却判断 `config.headers?.isEncrypt === 'true'`。这是代码层面的类型不一致，实际表现须联调确认；迁移时应定义明确的布尔配置与协议测试。
- **数据同步范围**：当前每次查询直接访问服务器、保存依赖显式操作；没有离线草稿、失败重试队列和冲突解决。若新产品要求离线优先，这不再只是“换壳”。

## 候选方案

| 方案 | 可复用部分 | 成本与取舍 | 适用条件 |
| --- | --- | --- | --- |
| **A. Tauri 2 + 现有 Vue 3/Vite**（优先评估） | 大部分页面、Vditor、API 模型；重写桌面调用与构建 | 桌面逻辑要用 Tauri 命令/插件与 Rust 配置；WebView 在各系统上不同，编辑器、网络/上传和打包须逐平台验证 | 希望降低 Electron 依赖，愿意维护少量 Rust 与平台构建环境 |
| **B. 原生 Electron + 现有 Vue 3/Vite** | 页面基本不变；窗口和托盘逻辑可移植 | 要自建 preload、IPC、更新/打包配置；仍分发 Electron/Chromium | 交付时间或 Chromium 渲染一致性优先，主要不满意 ElectronEgg |
| **C. 浏览器 Web/PWA** | Vue 页面和 HTTP 调用可复用 | 去掉原生窗口/托盘；服务器地址、跨域、浏览器存储、离线能力需要独立设计；浏览器安装与系统集成能力不同 | 用户接受浏览器体验，桌面驻留不是核心需求 |

**建议的决策方式**：先确定是否必须保留托盘驻留、离线编辑、自动更新和三平台支持。若都要保留且仍用 Vue，做一个小验证：Tauri 2 壳加载现有 Vditor，连接可配置 API，完成登录、图片上传和托盘关闭/退出。验证通过后再选 A；若 WebView/上传或构建成本不合算，选 B。若桌面能力可去掉，选 C 并先验证浏览器跨域及部署方式。这里的建议是选型路径，不是已经获得的实现结论。

## 建议的迁移次序

1. 固定后端契约：记录登录、目录、笔记、文件四组真实请求和响应样例；覆盖大 ID、401、空目录、上传失败。
2. 把 HTTP 调用与系统能力拆开：统一服务器地址、token 与 ID 类型；在 Vue 层仅保留少量明确的窗口/托盘方法，不再散落调用 `ipcRenderer`。
3. 做目标技术的小验证：登录、目录树、Vditor 编辑、保存、上传、不同平台窗口/托盘；在此阶段决定加密配置、凭据存储与跨域请求方案。
4. 迁移页面并修复未保存流程；逐项对照上面的功能矩阵验收。先保留在线模式，离线需求另立数据和冲突处理设计。
5. 最后处理平台打包、签名/更新策略、安装包升级与旧版客户端并存；服务端协议兼容期按实际发布计划确定。

## 资料

- [Tauri 2：在现有前端项目中初始化](https://v2.tauri.app/start/create-project/)
- [Tauri 2：系统托盘](https://v2.tauri.app/learn/system-tray/)
- [Tauri 2：HTTP 客户端插件](https://v2.tauri.app/plugin/http-client/)
- [Tauri 2：更新插件](https://v2.tauri.app/plugin/updater/)
- [Electron：安全建议](https://www.electronjs.org/docs/latest/tutorial/security)
- [MDN：PWA 安装与平台差异](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
