# V5Notes 官方网站 · 设计初稿

三方向真实初稿（同一套内容，三种视觉与骨架），按 `/huashu-design` 的方向门流程产出。
选定后再把最终版落到 `v5notes-website/` 根目录（index.html + assets）。

## 三版

| 版本 | 方向 | 首屏 | 整页 | 手机 |
|---|---|---|---|---|
| dir-1 | 白 · 原研哉（安静 / 纸白 / 图版） | `shots/dir-1-hero.png` | `shots/dir-1-full.png` | `shots/dir-1-390.png` |
| dir-2 | 深墨工程 · Linear.app 参照（中性偏冷 / 产品优先） | `shots/dir-2-hero.png` | `shots/dir-2-full.png` | `shots/dir-2-390.png` |
| dir-3 | 留 · 佐藤可士和（大胆 / 巨字 / 三色） | `shots/dir-3-hero.png` | `shots/dir-3-full.png` | `shots/dir-3-390.png` |

直接在浏览器打开：`design-demos/dir-1.html` / `dir-2.html` / `dir-3.html`。

## 每版一句话

- **dir-1 白**：首屏几乎全空，一句宋体大字 + 一张 60% 宽的客户端图版，图注像书里的图版；全站靠留白、错位版心和 1px 发丝线分段。form：笔记从一张白纸开始。
- **dir-2 深墨工程**：近黑墨绿底、78px 大标题、整幅产品窗、左侧 200px sticky 索引 + 右侧内容，部署区三个 tab 可切换。form：自托管是工程行为，页面像一份可核对的基础设施文档。
- **dir-3 留**：半版墨绿上巨字「留」占满高度，另半版纸白信息区；全站三色、2px 墨线、满幅色块切章节。form：产品的核心动词是「留」——留想法、留版本、留数据。

## v5md 核心编辑器（2026-11-10 追加）

三版都在「写作」之后、导航第 2 项加入「核心编辑器 v5md」一节：六条卖点、支持内容一行、MIT 开源条、编辑器截图（`../assets/screens/v5md-editor.png`，来自 v5md 官方 playground），技术栈同步加一行。文案与事实见 `v5md-section.md`。

## 共用输入

- `spec.md`：全站文案（三版逐字一致）、区块结构、硬约束。
- `v5md-section.md`：核心编辑器一节的逐字文案、事实与三版放置方式。
- `product-facts.md`：从 README / 源码 / 截图核实的事实，以及不能写的东西。
- `brand-spec.md`：真实资产、色板、字体、语气。
- `directions.md`：六个候选（三大逻辑各两个）与挑三张的理由。
- `card-1/2/3.md`：每版的设计卡（令牌、版式、动效、禁止项）。
- `thumbs.png`：六张缩略图总览（含三个备选：Irma Boom 书页、Bear 居中、Dark Editorial）。
- `../refs/`：linear.app / obsidian.md / raycast.com / bear.app 的实测截图（现实参照）。
- `../assets/screens/`：images/ 下的产品截图，转成 jpg 供网页引用。

## 验证

- 1440×900 与 390×844 均已截图；三版无横向滚动。
- 锚点、图片路径、外链已核对：无死链、无缺图。
- `design_lint.py check` 因本机未装 Python playwright 而跳过；构建时用同脚本的采集 JS + 同阈值等价检查过（0 红灯）。
- 待选定方向后：补 index.html 落地、再跑一次真实 lint、记外观账。