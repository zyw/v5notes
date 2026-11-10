# product-facts · V5Notes 官网（先核实，再设计）

核实日期：2026-11-10　来源：仓库 README.md / README.en.md、v5notes2、v5notes-admin2、v5notes-client2 源码、images/ 截图、git log。

## 一句话
V5Notes 是一套可以私有部署的 Markdown 云笔记：桌面客户端写作，管理后台管人和权限，Java API 把目录、正文、历史版本和文件收在用户自己的数据库里。

## 硬事实（写文案只能用这些）
| 事实 | 依据 |
|---|---|
| 三端：桌面客户端 v5notes-client2、管理后台 v5notes-admin2、API v5notes2 | README 目录表 |
| 客户端 Vue 3.5 + TypeScript + Vite 6 + Tauri 2，Windows / macOS / Linux | README 技术栈；src-tauri |
| 管理后台 Vue 3.5 + TypeScript + Vite 8 + Element Plus 2.14 + Pinia + UnoCSS + vue-i18n | README |
| 后端 Java 21 + Spring Boot 4.1.2 + MyBatis-Plus 3.5 + Sa-Token 1.46 + Flyway + Redisson + Hutool | README |
| 数据 MySQL 8.4 或 PostgreSQL；Redis 7.4；上传文件本地存储 | README |
| 部署：Docker Compose、可执行 Jar + Nginx、PostgreSQL、桌面安装包 | README |
| 管理后台 Docker 默认 http://localhost:8988，API http://localhost:8080 | README |
| 首次管理员 admin / admin123，登录需验证码，进入后应改密码 | README |
| 桌面端只接受「客户端用户」（cli_user）账号 | README |
| 三种写作模式：所见即所得 / 源码 / 预览，⌘1 / ⌘2 / ⌘3 | 命令面板截图、README |
| 预览与编辑复用同一个编辑器实例，Markdown 状态与撤销历史保留 | README、AGENTS.md |
| 切到预览前必须先保存成功，失败留在编辑态 | README、AGENTS.md |
| 目录与笔记同一棵树；搜索、新建、重命名、删除在树里完成 | README、截图 |
| 专注模式收起侧栏 | README、截图 |
| 右侧大纲 + 正文查找 | README、截图 |
| 命令面板 ⌘K：切换模式、字号、导出 HTML / PDF / PDF 图片版 / Markdown / 长图 | 命令面板截图 |
| Ctrl/Cmd + S 保存；未保存时切换笔记或关窗口先询问 | README |
| 本地草稿：断网 / 刷新不丢未保存内容 | README、models/draft.ts |
| 回收站保留 30 天，可恢复；彻底删除才清正文版本 | README、回收站截图 |
| 删除目录会连同子目录和笔记一起进入回收站 | README、AGENTS.md |
| 历史版本：每次保存留快照，可预览并恢复 | README、历史版本截图 |
| 访问令牌 + 刷新令牌；刷新令牌默认 30 天、一次性轮换；客户端不保存密码 | README |
| 登录 RSA 加密；接口加解密密钥成对 | README |
| 管理后台：用户、部门、岗位、角色、菜单、字典、参数、通知、客户端配置 | README |
| 在线用户、登录日志、操作日志、缓存监控 | README、admin 截图 |
| 文件走本地存储 | README |
| 三端界面支持简体中文 / 繁體中文 / English | README |
| 桌面端应用内更新读取 GitHub Releases 的 latest.json | README、.github workflow |
| 许可证 Apache License 2.0 | LICENSE |
| 版本 v2.0.0 | client2/admin2 package.json、admin 登录页 |
| 仓库 github.com/zyw/v5notes | .github/workflows/publish-update-feed.yml |

## 不能写的东西
- 不能编造用户数、下载量、uptime、客户评价、logo 墙、融资、奖项。
- 不能把管理后台截图里的演示数字（7 篇、26 次、47 次登录）当卖点数据。
- 不能承诺「端到端加密」「零知识」——产品没有这个说法。
- 不能写「永久免费」「无限空间」——没有依据。
- 不能写「支持 iOS / Android」——桌面端只有 Windows / macOS / Linux。
- 不能写「实时协作」——当前没有。

## 视觉素材（全部来自 images/，已转成 jpg 放 assets/screens/）
| 文件 | 内容 | 适合 |
|---|---|---|
| client-home.jpg | 客户端空状态「选择一篇笔记开始阅读」 | 首屏 / 白纸意象 |
| client-login-light.jpg / -dark.jpg | 登录页三次套印 / 深色波形 | 品牌气质、双主题 |
| client-source.jpg | 源码模式，内容为「欢迎使用 Markdown 笔记」 | 三种模式、写作 |
| client-palette.jpg | 命令面板（竖图） | 命令面板 |
| client-history.jpg | 历史版本弹窗（内容为欢迎笔记） | 回退 |
| client-trash.jpg | 回收站，剩余 30 天 | 回退 |
| client-settings.jpg | 设置弹窗 | 主题 / 设置 |
| client-home-dark.jpg | 深色工作区 | 暗色对照 |
| admin-home.jpg / admin-home-dark.jpg | 管理后台工作台 | 管理 |
| admin-users.jpg | 成员管理 | 管理 |
| admin-notes.jpg | 笔记管理 | 管理 |
| admin-history.jpg | 历史版本抽屉 | 管理 |
| admin-login.jpg | 管理后台登录 | 入口 |

注意：client-edit.jpg / client-preview.jpg 里的示例笔记正文是另一个产品（v5ai-nb）的介绍，**不要整幅当首屏或大图**；只能用裁剪（侧栏、工具栏）或不使用。

## v5md（2026-11-10 追加，已核实）
| 事实 | 依据 |
|---|---|
| v5md 是 V5Notes 的核心编辑器，开源 MIT，仓库 github.com/zyw/v5md，主页 v5md.v5ai.xin，当前 v0.0.3 | v5md README / CHANGELOG |
| 所见即所得 Markdown 编辑器；Markdown 字符串是唯一数据源，无私有 JSON / HTML 模型 | v5md README |
| 标记按需显形；中文输入法友好（组合输入不重绘 DOM）；粘贴富文本转 Markdown | v5md README |
| 六个包：@v5md/vue、@v5md/react、@v5md/view、@v5md/core、plugin-typography、plugin-export（ESM） | v5md README |
| 支持标题、粗斜体、下划线、删除线、高亮、链接、列表、任务列表、引用、代码块（语法高亮）、表格、图片（拖拽缩放）、KaTeX、Mermaid、frontmatter；撤销重做、查找替换（正则/全词）、源码模式、大纲跳转、导出 | v5md README |
| V5Notes 客户端用 @v5md/vue 驱动正文编辑 | v5notes-client2/package.json、src/components/EditorPane.vue |
| 不能写：AI 补全、实时协作、移动端 App | 无依据 |
