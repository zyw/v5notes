# 方向确认

- **用户原话**：「左侧有科技感的动图背景，文字描述笔记特点。这样的登录页面」
- **确认时间**：2026-11-07 22:44（Asia/Shanghai）
- **采用方向**：左侧科技感动效背景 + 笔记特点文案，右侧登录表单
- **动效**：深绿黑底（#06120e）上，节点缓慢漂移、按距离连线、数据脉冲沿连线流动；三条细流线缓慢起伏；44px 网格向上流动；薄荷光斑缓慢位移；每 11s 一道光带斜扫。鼠标移动时附近节点与指针连线。`prefers-reduced-motion` 下自动降级。
- **文案**：标题「把零散的笔记，收成一棵树。」；说明「目录、Markdown 与权限，让团队的每一条笔记都有归处。」；三条特点：目录树 / Markdown / 权限。
- **落地（2026-11-07 23:00）**：
  - `src/views/login.vue` 按此设计重写；动效拆为 `src/components/LoginTechBackground/index.vue`。
  - 按用户后续要求：品牌 V5Notes2 → **V5Notes**；版权 疯狂的狮子Li → **V5科技**；`VITE_APP_TITLE` 同步；注册页版权同步。
  - 实现截图：`shots/impl-login.png`、`shots/impl-login-m375.png`、`shots/impl-motion.gif`。
