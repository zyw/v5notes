# 登录页 · 第四轮（把笔记工作台做成画面）

第三轮三版被否：**太空太素、没有设计感；太像普通后台登录，没有产品气质**。第四轮换判断标准：登录页背后必须是**真实的产品工作台**（侧栏、笔记树、编辑器、笔记正文），登录表单仍是主角。

| # | 方向 | 取景 | 桌面 | 手机（真 375） |
|---|---|---|---|---|
| dir-1 | 台面 The Desk | 工作台画块不缩放，裁在左侧 62%；右侧 38% 白色表单栏 | [dir-1.png](shots/dir-1.png) | [dir-1-m375.png](shots/dir-1-m375.png) |
| dir-2 | 玄关 The Foyer | 完整工作台铺满；一张 460 宽登录浮页压在内容区上 | [dir-2.png](shots/dir-2.png) | [dir-2-m375.png](shots/dir-2-m375.png) |
| dir-3 | 夜窗 The Night Window | #0c1411 深色场；右侧暗色工作台窗口越界裁切，左侧深色表单栏 | [dir-3.png](shots/dir-3.png) | [dir-3-m375.png](shots/dir-3-m375.png) |

## 场景画块
`refs/scene-block-source.html`：1440×900 原生像素，`.v5sc`（浅）/ `.v5sc.dark`（深）两套变量；缩放、裁切由使用方决定。`refs/scene-editor.png` 是保真度基准。
场景内容是一篇**示例笔记**（「开始之前：三件小事」），明确标注「示例笔记」，不含任何业务指标。

## 共同内容与交互
账号 / 密码 / 验证码 / 记住账号 / 登录；微信、MaxKey、TopIAM、Gitee、GitHub；中英全量切换；空值 inline 校验并聚焦首错；提交 900ms loading →「正在进入工作台…」；第三方 inline 提示。无注册、无忘记密码。

## 已核验
- 桌面 1440×900：三版 `scrollWidth=1440 / scrollHeight=900`。
- 手机真 375×812（CDP Emulation，2x）：`scrollWidth=375`；高度 908 / 966 / 975，允许纵向滚动。
- 场景层 `aria-hidden="true"`、`pointer-events:none`，内部无可聚焦元素。
- 注意：`round-3/shot.sh` 的 mobile 模式会把视口钳到 500px 再裁切，不要用它验收手机；用 `node /tmp/cdp-shot.mjs <html> <png> 375 812 2`。

## 下一步
选定方向后落到 `src/views/login.vue`：保留 Element Plus 表单、验证码接口、social 与 i18n 逻辑，把场景画块作为静态背景组件（不参与交互）。
