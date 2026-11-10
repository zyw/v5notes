# 方向确认 · V5Notes2 加载体验

- **展示**：dir-1.png / dir-2.png / dir-3.png（三版完整稿，均 1440×1024，五状态 + 深浅两态可切）+ thumbs.png（六格缩略图，含 A2/B2/C2 备选）
- **用户选择原话**：「使用方向 1 · 同步进度舱」
- **确认时间**：2026-11-07（Asia/Shanghai）
- **采用方向**：1 · 同步进度舱（最佳设计师 · 线性式真实阶段清单 + 精确读秒）
- **执行范围（锁定）**：
  - L0 启动屏：居中舱体 —— 真 logo lockup → 真进度环(SVG dasharray) → 当前阶段 + 技术子行 → 五阶段行进清单(带每段实测耗时) → 「步骤 x/5 · 已用 x.xs」等宽读数。深色底 #1c5a48→#0f3d33（承接已批准抽屉头），浅色 #f4f7f5 画布 + 白舱体。8s 超时兜底（环变琥珀 #d9a33b + 重新加载/网络诊断）。
  - 事件契约：booting→routing→skeleton→partial→(timeout|fail)；progress/stage/done/timeout/fail。
  - L1 路由：2px 薄荷进度条（替代 NProgress #29d 蓝条）。
  - L3 局部 / L2 骨架 / L4 按钮 / L5 失败：按设计方案分层落地。
- **产物**：`dir-1.html`（设计稿）→ 落到真实代码 `index.html` + `permission.ts` + 骨架/错误态组件。
- **落地清单**见 `设计方案.md` §5。
