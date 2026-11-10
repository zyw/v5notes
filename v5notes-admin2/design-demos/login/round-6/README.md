# 登录页 · 第六轮（左侧科技动效 + 笔记特点）

用户指定方向：「左侧有科技感的动图背景，文字描述笔记特点。这样的登录页面」。已按此落地到管理端真实登录页。

## 已落地
- 页面：`src/views/login.vue`
- 动效组件：`src/components/LoginTechBackground/index.vue`
- 文案：`src/lang/zh_CN.ts` / `src/lang/en_US.ts` 的 `login.scene`、`login.welcome` 等
- 文案变更（按用户要求）：
  - 品牌 `V5Notes2` → `V5Notes`
  - 版权 `疯狂的狮子Li` → `V5科技`
  - `VITE_APP_TITLE` 同步为 `V5Notes云笔记`（标签页标题；其余页面早已使用 V5Notes）
  - 注册页版权同步为 V5科技
- 另外去掉了原登录表单预填的 `admin / admin123`，改为空表单 + 记住账号回填用户名。

## 实现截图
- 桌面：`shots/impl-login.png`（1440×900）
- 手机：`shots/impl-login-m375.png`（真 375×812）
- 动效：`shots/impl-motion.gif`（左栏实时录制的 3.7s 片段）

## 结构
- 左 56%：`#06120e` 深绿黑场。Canvas 绘制节点网络、距离连线、数据脉冲；三条流线；44px 网格向上流动；薄荷光斑与斜扫光带；鼠标经过时附近节点与指针连线。上层为品牌、标题、三条笔记特点、版本信息。
- 右 44%：白面登录表单（账号 / 密码 / 验证码 / 记住账号 / 登录 / 五个第三方入口 / 中英切换 / 版权与版本）。
- 手机（≤920）：左侧收成 392px 顶部画面带，表单接管整屏。
- `prefers-reduced-motion` 下关闭 Canvas 与 CSS 动效，保留静态渐变背景。

## 设计原型
`dir-1.html` 是同一设计的独立原型（Logo 已内嵌，可直接打开）；`shots/dir-1*.png` 为原型截图。

## 验证
- `pnpm build` 通过；`oxlint` 0 warning / 0 error。
- 1440×900、1440×800、1280×720、1024×800、375×812 均无横向溢出；桌面一屏无滚动条。
- 实测：中英全量切换、密码显隐、验证码刷新、空值校验（错误文案 + 聚焦首错）、提交 loading；场景层 `aria-hidden`、不参与键盘焦点。
