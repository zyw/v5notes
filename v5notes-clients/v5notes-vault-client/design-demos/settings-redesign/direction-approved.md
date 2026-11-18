# 方向确认

日期：2026-11-17

## 展示过什么

- 三方向完整稿：01 案头（dir-1）、02 工作台（dir-2）、03 书页（dir-3）。
- 六候选缩略图：thumbs.png（含 02 仪器、04 索引、05 白盒）。
- 追加混合稿：dir-4（02 骨架 + 01 目录）、dir-5（01 布局 + 02 面板）、dir-6（02 侧栏 + 01 内容 + 02 面板）。

## 过程记录

1. 用户看过 dir-6 后说：

> 好的，改成06的样子

这里「06」被我误读为六候选编号 06「书页」，先落了书页版本。

2. 用户随即纠正：

> 让你给改成dir-6.html这个样子，你瞎改啥

「06」指的是 **dir-6.html**，不是六候选 06「书页」。

## 最终选定

**dir-6.html**：

- 02 的侧栏：品牌、serif「设置」+ 08、图标导航、绿色 active pill、说明、底部账号块。
- 01 的单列内容：content-meta、lede、四格状态条、820px 单列。
- 02 的面板：8 个面板按顺序纵向排列，面板头 = 编号 + 图标 chip + serif 标题 + 状态，面板内沿用紧凑 row / switch / 输入 / 主题预览。

书页版本（dir-3 落地）已废弃并替换；dir-3 仅保留为设计历史。

## 实现

- `src/views/SettingsView.vue`：side-nav + 820 单列 panel stack，scroll-spy，账户 2 列表单，内容全部复用原逻辑。
- `src/App.vue` / `src/styles/style.css`：settings 全幅 main-fill。
- 验证：build 通过；92 tests 通过；1280/1032 截图；0 JS error。
