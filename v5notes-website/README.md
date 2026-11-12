# V5Notes 官方网站

Vite 单页官网，双主题：浅色「白」（原研哉 / 安静）与深色「深墨工程」（Linear 现实参照）。导航右侧一个按钮循环 **自动 → 浅色 → 深色**。

## 开发与构建

    pnpm install
    pnpm dev       # http://127.0.0.1:5176
    pnpm build     # 产物在 dist/
    pnpm preview   # http://127.0.0.1:4175
    pnpm check     # node --check src/main.js

要求 Node ≥ 22.12，pnpm 10。`package.json` 按给定配置：Vite 8.0.12、dev 5176、preview 4175、`check`、engines 与 pnpm 10.24；包名用 `v5notes-website`（给定模板里是 `baize-website`，要保留原名改一行即可）。

## 目录

    index.html          页面结构（Vite 入口）
    src/main.js         移动端菜单、滚动高亮、主题三态切换
    src/style.css       两套主题的令牌与全部样式
    public/assets/      产品截图与品牌图标，构建时原样复制
    shots/              1440 / 390、浅 / 深 / 自动 的交付截图
    design-demos/       六候选、三方向初稿、方向确认与事实清单
    dist/               pnpm build 的产物

## 主题系统

- 一个按钮，三态循环：自动 / 浅色 / 深色；当前态用图标 + 文字标出。
- 自动跟随系统 `prefers-color-scheme`，系统切换时实时响应。
- 选择记在 `localStorage` 的 `v5notes-site-theme`；`index.html` 头部内联脚本在绘制前定主题，不闪白。
- 同一套版式与内容，两套令牌：
  - 浅色：纸白 `#fbf9f3`、墨绿 `#315b4a`、宋体标题、8px 白边图版 + 图注。
  - 深色：`#0b1411` 底、`#101d18` 面板、青瓷 `#4fbf94`、无衬线粗标题、12px 圆角产品窗 + 微光。
- 首屏客户端截图随主题切换（浅色 `client-home.jpg`，深色 `client-home-dark.jpg`）。
- URL 参数可强制主题、方便分享与截图：`?theme=light`、`?theme=dark`、`?theme=auto`。
- 切换只换颜色、字体关系与图版处理，不改变版式，避免跳版。

## 内容

导航：写作 · 编辑器 · 回退 · 管理 · 部署 · 技术栈。

区块：首屏 → 为什么自托管 → 写作 → 核心编辑器 v5md → 回退（历史 / 回收站 / 草稿）→ 管理后台 → 三端 → 部署 → 技术栈与开源 → CTA → 页脚。

文案事实来自仓库 README、三端源码和 `images/` 截图；v5md 事实来自其仓库 README / CHANGELOG。没有编造数据、评价或 logo 墙。

## 已验证

- `pnpm check`、`pnpm build` 通过；`dist/index.html`、CSS、JS 与 public 资源均正确产出。
- dev（5176）与 preview（4175）：浅色、深色均正常渲染，8 张图片全部加载，0 控制台报错。
- 主题按钮：CDP 实测 `自动 → 浅色 → 深色 → 自动`，label / localStorage / meta theme-color 同步。
- 自动模式：模拟系统深色 / 浅色，页面实时跟随。
- 导航在 1440 / 1280 / 1100 / 1024 / 940 / 900 / 860 / 768 / 390 下无溢出，≤860 收成菜单。
- `design_lint.py` 因本机未装 Python playwright 跳过；构建时用同脚本的采集逻辑做过等价检查（0 红灯）。

> 截图提示：headless Chrome 的 `--virtual-time-budget` 会让 CSS 入场动画停在开头，截生产页时用 CDP 真实时间或直接看浏览器。