# V5Notes2 登录页 · 第四轮 Spec（产品即画面）

## 为什么重做
第三轮三版被否：**太空太素、没有设计感；太像普通后台登录，没有产品气质**。
用户选择的新方向：**把「笔记工作台」本身做成画面**。

所以这一轮不是再做三种留白版式，而是三种「产品场景」的取景与气质：
- 画面里必须有真实工作台（侧栏、笔记树、编辑器、笔记正文），像真的在被人使用；
- 登录表单是唯一主角，场景是它身后的世界，层级不能含混；
- 三种取景必须不同（裁切、层级、明暗），不是同一张图换颜色。

## 共用场景
`../refs/scene-block-source.html` 是可复用的工作台画块：1440×900 原生像素，浅色 `.v5sc` / 深色 `.v5sc.dark` 两套主题变量。
- 复制其中 `<style id="v5scene-css">` 与 `<div class="v5sc">…</div>` 到你的页面；
- 用外层容器 `transform: scale()`、`overflow: hidden` 做缩放与裁切；
- 画块必须 `aria-hidden="true"`、`pointer-events: none`、内部 `a[href]` 改成 `<span>` 或 `tabindex="-1"`（它是背景，不可交互）；
- 参考图 `../refs/scene-editor.png`（保真度基准，别做得比它糙）；
- Logo 占位符 `__LOGO_DATA_URI__`，写完跑 `python3 ../round-3/inject-logo.py <你的 html>`。

## 内容（三版一致）
- 品牌：真实 Logo、V5Notes2、云笔记 · 管理控制台。
- 标题：欢迎回来 / Welcome back；说明：使用管理员账号进入工作台。 / Sign in with your administrator account.
- 字段：账号、密码（显隐）、验证码（图形码 + 换一张）、记住账号。
- 主按钮：登录 / Sign in。
- 第三方：微信、MaxKey、TopIAM、Gitee、GitHub（点击给 inline 提示，不跳转）。
- 语言：简体中文 / English，全量切换（含 document.title、placeholder、页脚）。
- 页脚：Copyright © 2018-2026 疯狂的狮子Li All Rights Reserved.；版本 v6.1.0。
- 无注册、无忘记密码、无邮箱/Passkey；不新增任何营销文案与指标。

## 视觉令牌（与既有系统一致）
- 浅色：画布 #f4f7f5，白面 #ffffff，发丝线 #e6ebe7 / #edf1ee，主色 #1c5a48（hover #236a55），浅底 #e8f2ec / 文字 #17624a，标题 #15241e，正文 #2b3a32，次要 #5f7067。
- 深色（dir-3 用，取自 _theme-dark.scss）：底 #0c1411，面 #111a16，边 rgba(255,255,255,.09)，标题 #e9f2ec，正文 #cdd9d2，次要 #8ea79b，强调 #4fbf94，浅底 rgba(79,191,148,.16)。
- 字体：MiSans, "HarmonyOS Sans SC", "PingFang SC", "Noto Sans SC", sans-serif；等宽只用于真正的元信息（≤3 处）。
- 圆角 8/10/12/16；阴影克制；橙色只来自 Logo。

## 尺寸与响应式
- 桌面 1440×900 一屏完成，不出现滚动条。
- 手机 375×812：场景收缩成顶部画面带或隐藏式背景，表单接管整屏；允许纵向滚动，但首屏要看到完整输入意图。
- 控件高 46–48；正文 ≥14px，标签 ≥12px，对比度 ≥4.5:1。

## 每个方向必须自己验的
1. 桌面 1440×900：`scrollWidth=1440 / scrollHeight=900`。
2. 真 375（不是 shot.sh 的裁切）：`cd /tmp && node cdp-shot.mjs "file://<abs>" "<abs png>" 375 812 2`，`sw` 必须 375；桌面同法 1440 900 1。
3. 交互：空值 inline 校验并聚焦首错、密码显隐、验证码刷新、loading 900ms →「正在进入工作台…」、第三方 inline 提示、中英全量切换。
4. 场景完全不可交互、不抢焦点；给读屏隐藏。

## 判断标准
- 第一眼：这是一个有内容的产品，不是一张空页面；表单仍然是视觉焦点。
- 第二眼：字体、间距、对齐、裁切都经得起看；场景不像画的 PPT。
- 第三眼：和这套薄荷工作台是同一个系统。
