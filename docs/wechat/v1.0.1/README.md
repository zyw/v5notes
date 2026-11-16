# V5Notes · 微信公众号宣传物料（新版）

> 用最新版 `wechat-mp` 技能重新生成。两版（深色科技 / 浅色清新）× 两种格式（贴图套图 / 长文），共 4 个可直接发布的公众号样例；内容参考 V5Notes 文档、代码与 2.0.1 发布说明。
>
> **官方地址（贴图每张页脚、结尾卡与两篇文章均已加入）**：官网 https://v5notes-website.v5ai.xin/ ｜ 开源 https://github.com/zyw/v5notes

## 一、立项卡（Brief）

| 项 | 内容 |
| --- | --- |
| 主题 / 项目 | **V5Notes** —— 可私有部署的 Markdown 云笔记（2.0.1） |
| 一句话定位 | 把想法留在自己的服务器上：桌面写作、后台管人、数据落在自己的库里，2.0.1 起支持实时消息 |
| 目标读者 | V1：开发者 / 技术决策者 / 自托管爱好者；V2：个人、家庭与小团队、泛技术用户 |
| 内容体裁 | 项目推荐（含「2.0.1 更新」与「边界」声明） |
| 品牌 | V5Notes · 栏目「自托管笔记」；品牌色**墨绿** `#315b4a` + 暖白纸 `#fffefa`/`#f4f2ec` |
| 两版语气 | V1 硬核、讲边界与实现；V2 轻快、讲场景与体验 |

**核心卖点**：数据自主（Markdown 原文件 + 自托管 MySQL/PG/Redis）· 三态写作（@v5md、大纲查找、168 语言高亮、KaTeX）· 30 天回收站 + 历史版本 · 管理后台与审计 · 三语界面 · 令牌安全（RSA 登录、30 天一次性刷新令牌）· **2.0.1 实时消息**。

## 二、四个样例

| 版本 | 贴图套图（图片消息 / 小绿书） | 长文（图文消息） |
| --- | --- | --- |
| V1 深色科技版 | [v1-dark/overview.png](v1-dark/overview.png) · 8 张 1080×1440 | [v1-dark/article/article.md](v1-dark/article/article.md) · [article.html](v1-dark/article/article.html) |
| V2 浅色清新版 | [v2-light/overview.png](v2-light/overview.png) · 8 张 1080×1440 | [v2-light/article/article.md](v2-light/article/article.md) · [article.html](v2-light/article/article.html) |

每个版本目录内含四件套：贴图 `cards/card-01..08.png` + [文案.md](v1-dark/文案.md)（标题备选 / 摘要 / 配文 / 逐图文案）；文章 `article/article.md` + `article/article.html` + `article/cover.png` + `article/images/fig1..3.png` + [发布清单.md](v1-dark/发布清单.md)；另附 `overview.png` 拼版总览。

## 三、两版差异（A/B 选型）

| 维度 | V1 深色科技版 | V2 浅色清新版 |
| --- | --- | --- |
| 背景 | 深墨绿黑渐变 + 冷光 | 暖白纸面 + 极淡点阵 |
| 强调色 | 薄荷绿 `#5fd3a6` | 墨绿 `#315b4a` |
| 标题 | 更技术（「数据，拿回来；消息，不断线」） | 更利益点（「笔记存在谁家？」） |
| 读者 | 开发者 / 自托管玩家 | 个人 / 家庭 / 小团队 |
| 侧重 | 架构、边界、2.0.1 令牌与消息实现 | 场景、上手三步、删改有退路 |

## 四、目录结构

    docs/wechat/new/
    ├─ build.mjs              # 品牌定制构建驱动（复用 wechat-mp 模板/组件，注入墨绿主题）
    ├─ v1-dark.spec.json / v2-light.spec.json
    ├─ assets/img/            # 精选真实产品截图（源素材）
    ├─ v1-dark/  v2-light/    # 产物：cards/ + article/ + 文案 + 发布清单 + overview

## 五、重新生成

    node docs/wechat/new/build.mjs --spec docs/wechat/new/v1-dark.spec.json  --out docs/wechat/new/v1-dark
    node docs/wechat/new/build.mjs --spec docs/wechat/new/v2-light.spec.json --out docs/wechat/new/v2-light

## 六、自检结论（对照 publish-checklist）

- [x] 四个样例齐全：V1 贴图 / V1 文章 / V2 贴图 / V2 文章。
- [x] 每个样例带：标题备选、摘要、正文（Markdown / 逐图文案）、配图与发布清单。
- [x] 文章正文均 ≥800 字：V1 中文 1007 字（非空白 1676）、V2 中文 947 字（非空白 1345）；两篇各 **3 张配图**。
- [x] 所有 PNG 尺寸正确：贴图 1080×1440、封面 1080×460、正文图宽 1080（逐张目检）。
- [x] 文章 Markdown 与 HTML 同源同内容；全内联样式，无 `<style>` / `<script>` 外链。
- [x] 图注连续（图1 / 图2 / 图3），无重复；摘要 52 / 53 字（≤54）；贴图标题 ≤20 字；配文 ≤100 字。
- [x] 贴图页脚、结尾卡与文章均含官网与 GitHub 地址。
- [x] 内容参考真实文档与代码，未虚构；截图来自真实运行界面。
- [x] 结尾卡二维码使用官网二维码素材 `assets/img/qr.png`（替换了原占位棋盘图），清晰可扫。