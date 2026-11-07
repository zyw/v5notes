# 方向确认

- **展示**：dir-1.png（方向 1 · 指挥带 Cockpit）、dir-2.png（方向 2 · 内容地图 Atlas）、dir-3.png（方向 3 · 值班室 Signal）+ thumbs.png（六宫格，含 A2 留白工作台 / B2 Bento 网格 / C2 周报简报 三张备选）
- **用户选择原话**：「选择方向 1」
- **确认时间**：2026-11-07（Asia/Shanghai）
- **采用方向**：1 · 指挥带 Cockpit
- **执行范围（锁定）**：
  - 首页整体替换 `src/views/index.vue`，沿用已批准的「薄荷工作台」令牌（`#f4f7f5` 画布 / `#fff` 卡面 / `#1c5a48` 单点 / 发丝线 `#e6ebe7` / 12px 圆角）。
  - 骨架：页头（眉标 + 标题 + 日期范围切换）→ 横向数据带（4 段指标 + 1 段系统状态，段间 1px 竖线，段内嵌 sparkline）→ 主区 8:4（30 天趋势 / 目录 Top 6）→ 底区 1.55:0.78:0.78（最近更新表 / 登录设备环形 / 系统脉搏）。
  - 图表全部用项目已有依赖 `echarts@6.1.0`，数据来自新增聚合接口 `GET /notes/dashboard/overview`。
  - 视觉令牌、字号层级、等宽小标签与 `dir-1.html` 一致；不新增颜色。
- **产物**：`dir-1.html` / `shots/dir-1.png`；落地实现见 `src/views/index.vue` 与 `src/api/notes/dashboard/`。
- **备注**：用户未提混合要求，按方向 1 原案执行。
