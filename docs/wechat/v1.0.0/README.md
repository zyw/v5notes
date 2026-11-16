# V5Notes · 微信公众号宣传物料

> 用 `wechat-mp` 技能生成。两版（深色科技 / 浅色清新）× 两种格式（贴图套图 / 长文），共 4 个可直接发布的公众号样例。
>
> **官方地址（贴图每张页脚、末尾卡片与两篇文章均已加入）**：官网 https://v5notes-website.v5ai.xin/ ｜ 开源 https://github.com/zyw/v5notes

## 一、立项卡（Brief）

| 项 | 内容 |
| --- | --- |
| 主题 / 项目 | **V5Notes** —— 可私有部署的 Markdown 云笔记 |
| 一句话定位 | 把想法留在自己的服务器上：桌面写作、后台管人、数据落在自己的库里 |
| 目标读者 | V1：开发者 / 技术决策者 / 自托管爱好者；V2：个人、家庭与小团队、泛技术用户 |
| 内容体裁 | 项目推荐（开源项目推荐，含「边界」声明） |
| 品牌 | V5Notes · 栏目「自托管笔记」；品牌色**墨绿** `#315b4a` + 暖白纸 `#fffefa`/`#f4f2ec` |
| 两版语气 | V1 硬核、讲边界；V2 轻快、讲场景 |

**核心卖点（3–6）**
1. 数据自主：一篇一份 Markdown，API / MySQL·PostgreSQL / Redis / 文件都由你部署。
2. 写作体验：目录笔记混排、编辑/预览/源码三态、大纲、查找、命令面板、专注模式、Ctrl/Cmd+S。
3. 删得安心：回收站 30 天可恢复，历史版本可预览恢复。
4. 管理后台：用户/部门/岗位/角色/菜单/字典/参数/通知 + 登录/操作日志、在线用户、缓存监控。
5. 多语言：简体 / 繁体 / 英文三语界面，后端按 `Content-Language` 返回提示。
6. 安全：访问令牌 + 刷新令牌（默认 30 天、一次性轮换），客户端不保存密码。

> 事实来源：仓库 `README.md`、`images/` 实拍截图、`v5notes-website/design-demos/brand-spec.md`、`v5notes-client2/design-demos/mode-switch/brand-spec.md`。均取自真实产品，未虚构数据。

## 二、四个样例

| 版本 | 贴图套图（图片消息 / 小绿书） | 长文（图文消息） |
| --- | --- | --- |
| V1 深色科技版 | [v1-dark/overview.png](v1-dark/overview.png) · 8 张 1080×1440 | [v1-dark/article/article.md](v1-dark/article/article.md) · [article.html](v1-dark/article/article.html) |
| V2 浅色清新版 | [v2-light/overview.png](v2-light/overview.png) · 8 张 1080×1440 | [v2-light/article/article.md](v2-light/article/article.md) · [article.html](v2-light/article/article.html) |

每个版本目录内含四件套：
- 贴图：`cards/card-01..08.png`（1080×1440）+ [文案.md](v1-dark/文案.md)（标题备选、摘要、配图描述、逐图文案脚本）
- 文章：`article/article.md` / `article/article.html`（同源同内容）+ `article/cover.png`（1080×460）+ `article/images/fig1..3.png`
- 发布清单：[发布清单.md](v1-dark/发布清单.md)（贴图 / 文章逐项打勾）
- 总览图：`overview.png`（8 张卡片拼版，便于快速审阅）

## 三、两版差异（A/B 选型）

| 维度 | V1 深色科技版 | V2 浅色清新版 |
| --- | --- | --- |
| 背景 | 深墨绿黑渐变 + 冷光 | 暖白纸面 + 极淡点阵 |
| 强调色 | 薄荷绿 `#5fd3a6` | 墨绿 `#315b4a` |
| 标题 | 更技术、更具体（「直到你想把数据拿回来」） | 更利益点、更好懂（「笔记存在谁家？」） |
| 读者 | 开发者 / 自托管玩家 | 个人 / 家庭 / 小团队 |
| 主视觉 | 深色编辑器实拍、数据分层、权限后台 | 浅色编辑器、回收站、后台工作台 |

两版共用同一主题与同一份事实，只换视觉主题与语气。

## 四、目录结构

    docs/wechat/
    ├─ build.mjs              # 品牌定制构建驱动（复用 wechat-mp 模板/视觉组件，注入墨绿主题）
    ├─ v1-dark.spec.json      # V1 内容与版式定义
    ├─ v2-light.spec.json     # V2 内容与版式定义
    ├─ assets/img/            # 从 images/ 精选的真实产品截图（源素材）
    ├─ v1-dark/               # V1 产物：cards/ + article/ + 文案 + 发布清单 + overview
    └─ v2-light/              # V2 产物：同上

## 五、重新生成

依赖：macOS 上的 Chrome（脚本自动探测，可用 CHROME_BIN 指定）与 Node.js。

    node docs/wechat/build.mjs --spec docs/wechat/v1-dark.spec.json  --out docs/wechat/v1-dark
    node docs/wechat/build.mjs --spec docs/wechat/v2-light.spec.json --out docs/wechat/v2-light

改文案 / 版式只改对应 `*.spec.json` 后重跑即可；主题令牌集中在 `build.mjs` 的 DARK_CSS / LIGHT_CSS。

## 六、自检结论（对照 publish-checklist C 节）

- [x] 四个样例齐全：V1 贴图、V1 文章、V2 贴图、V2 文章。
- [x] 每样例带：标题备选、摘要、正文（Markdown / 逐图文案）、配图与发布清单。
- [x] 两版差异清晰（主题 / 语气 / 标题风格不同，并非简单换色）。
- [x] 所有 PNG 尺寸正确：贴图 1080×1440、封面 1080×460、正文配图宽 1080（逐张目检）。
- [x] 文章 Markdown 与 HTML 同源同内容；内联样式，无 `<style>`/`<script>` 外链。
- [x] 图注编号连续（图1 / 图2 / 图3），无跳号、无重复。
- [x] 摘要 47 / 50 字（≤54）；贴图标题 ≤20 字；配文 ≤100 字。
- [x] 无虚构事实；截图来自真实运行界面，演示数据仅作示意。
- [x] 文件按约定目录归档，命名清晰可交付。