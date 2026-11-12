# 登录页重设计 · 共同规格

日期 2026-11-10　画布 1440 × 900（另验 1280 × 800、375 × 812）　落点 `v5notes-client2/src/views/LoginView.vue` + `src/styles/style.css`
单文件 HTML、无外链资源、macOS 桌面客户端（Tauri）满窗渲染，不画 macOS 红绿灯（那是系统窗口，叠在真实应用上会重影）。

## 1 · 起点与要解决的问题

现有登录页（用户截图 2026-11-10）：左侧「V5 / NOTES」+ 两行衬线标题「把想法／留在这里。」+ 一行副标；右侧一张白卡（连接工作区 / 服务器行 / 用户名 / 密码 / 进入笔记）。背景是一层静态径向渐变。

骨架成立，两个不足：
1. **左侧只有口号，没有把「云笔记」的特色讲出来**——用户原话「左侧 V5Note 云笔记的特色」，要看到这个产品独有的事，不是通用 slogan。
2. **背景是死的**——用户原话「背景有漂亮的动画效果」，要真的有动效，且不吵、不糊字。

右侧表单的字段、文案、状态、右上设置齿轮全部保留，不新增业务功能。这是「美化 + 左侧特色 + 背景动画」，不是重做流程。

## 2 · 产品事实（写设计时必须遵守，不得加戏）

| 事实 | 依据 |
| --- | --- |
| 桌面 Markdown 笔记客户端，本地 + 自建服务器（官方地址不对页面渲染明文） | README、`useWorkspace.ts` |
| 三种写作模式：所见即所得 / 源码 / 预览，快捷键 ⌘1/2/3 | `EditorModeDock.vue`、`useWorkspace` |
| 左侧一棵目录树同时装目录和笔记，笔记点开即读 | `WorkspaceSidebar.vue`、`TreeItem.vue` |
| 历史版本可查看与恢复 | `NoteHistoryDialog.vue`、i18n `history` |
| 本地草稿：断网/刷新也不丢未保存内容 | `models/draft.ts`、AGENTS.md |
| 专注写作：收起侧栏，编辑器占满窗口 | `.workspace.focus-mode`、i18n `focus: '专注写作'` |
| 回收站、图片库、大纲、命令面板 | 组件目录 |

一句话：**这是一个把「写」放在第一位的桌面笔记工具，结构是「一棵树 + 三种模式 + 可回退的历史」。**

## 3 · 品牌与设计令牌（从现有代码与 logo 实采，不发明）

```
--paper:      #fffefa   纸面（卡片、正文底）
--canvas:     #f4f2ec   画布
--canvas-2:   #edf0e8   画布偏冷一档
--ink:        #27342d   主墨
--ink-2:      #364c3b   次级墨
--muted:      #6b7b70   次要文字（在 paper 上对比 ≥ 4.5）
--muted-2:    #8a958c   更弱（仅用于非正文）
--accent:     #315b4a   墨绿强调（主按钮/链接/强调字）
--accent-deep:#244636   强调悬停
--accent-soft:#e9eee8   强调浅底
--line:       #e4e6df   发丝线
--line-soft:  #efefe9   更浅发丝线
--teal:       #0b4a52   深青（取自 logo 底色 #004858~#025e63）
--mint:       #2fa9a4   青瓷（取自 logo 亮部 #18979d~#26bfbb，**只许小面积**：≤ 画面 5%）
--amber:      #ad7640   未保存/自定义服务器（语义色，沿用现有）
--danger:     #a7483d   错误
```

**色彩推导**：主色不是新发明的——墨绿取自现有 UI（`style.css`），深青/青瓷取自 `src/assets/brand-icon.png` 实测；纸色沿用 `#fffefa`。整套压到「暖纸中性 + 墨绿 + 深青 + 一点青瓷」，青瓷只做点睛，不做大面积铺底。

**字体**（只用 macOS 系统字体，不引外链）：
- 衬线/标题：`'Songti SC', 'Noto Serif SC', 'Source Han Serif SC', serif`
- 界面/正文：`'PingFang SC', 'Helvetica Neue', -apple-system, sans-serif`
- 拉丁小标签/数字：`'Avenir Next', 'Helvetica Neue', sans-serif`；编号可用 `'SF Mono', ui-monospace, Menlo, monospace`
- logo 必须用 `src/assets/brand-icon.png` base64 内嵌，不得用文字重绘。

**形状**：控件 8–10px，卡片 14–18px，胶囊 999px；线 1px；阴影只在「浮起的纸」上（0 20–50px 低透明度墨绿）。

## 4 · 内容（三个方向共用，只换设计不换内容）

左侧：
- 眉标：`V5 / NOTES`
- 主标题：`把想法，留在这里。`（可拆成两行，句号保留）
- 副标：`连接你的笔记空间，继续写作。`
- 特色事实（按方向的容量选 3 条，最多 4 条；文案照抄）：
  - `三种模式` / `所见即所得、源码、预览，随时切换`
  - `目录与笔记同屏` / `一棵树装下所有稿子`
  - `草稿与版本` / `断网不丢，每次保存都能回退`
  - `专注写作` / `收起侧栏，只剩正文`
- 示例笔记（只作为「写的东西」的样本，不加虚假统计）：
  - 标题：`十月的一个下午`
  - 正文三行：`把窗子开到最大，让风经过桌面。` / `写下来的东西，才算真正想过。` / `回退到昨天那一版，只留第三段。`
  - 元信息：`第 3 稿 · 10 月 12 日`

右侧登录（字段/文案与现有 i18n 完全一致）：
- 卡片眉标：`连接工作区`
- 服务器行：圆点 + `服务器 · localhost:8080` + `更改`
- `用户名` 输入框（已填 `zyw`）
- `密码` 输入框（已填，圆点显示）
- 主按钮：`进入笔记`（左侧圆形箭头标记保留，现有组件形态）
- 状态：`正在连接…`（busy）、错误 `用户不存在/密码错误`（error）
- 右上角：设置齿轮（`设置`），36×36，不抢视觉

## 5 · 布局约束

- 桌面 1440×900：登录区落在**右侧**，宽 340–380px，右外边距 88–112px，垂直居中或与左侧版心上沿对齐；左上安全区 56–72px（macOS 拖动区，别放可点元素）；齿轮在右上 44px 处。
- 左区占剩余宽度，内容左边界 88–120px。左区必须**真的呈现特色**：不是三条 icon+title 的通用 feature list（那是默认答案）；优先让产品自己被看见（一页笔记、三种模式的叠影、目录树、历史），文字只做注脚。
- 1440 下不允许出现横向滚动；1280×800 不破版；375×812 单列、登录卡在下、背景动效保留但降密度。
- 可点区域 ≥ 40×40（桌面；输入框高 ≥ 46）。

## 6 · 动效规格（这次的重点之一）

- 每个方向一套**有主张的背景动效系统**，周期 12–40s 为主，局部脉冲 0.6–1.2s；一眼能看出在动，但静止截图也不空。
- 不允许：整屏闪烁、噪点抖动 > 3Hz、彩虹渐变流动、粒子乱飞。背景运动不能压过文字：正文区域背后只用低对比运动（ΔL 小、低 alpha），必要时在文字后加柔和的纸色 scrim。
- 层级：canvas/SVG 背景在最底；内容居中；登录卡最上。滚动/鼠标视差只在桌面且幅度 ≤ 6px。
- `prefers-reduced-motion: reduce` 时全部静止（保留构图）。
- 性能：canvas DPR ≤ 2；页面隐藏时暂停；不用 WebGL / 第三方库。

### 6.1 确定性时间（截图必须可复现）

所有动效由同一个时间量 `T` 驱动：
- 默认 `T = performance.now()/1000`（活）
- URL 带 `?t=2.4` 时冻结在 2.4s：canvas 只画这一帧；CSS/WAAPI 动画 `document.getAnimations().forEach(a => { a.currentTime = t*1000; a.pause() })`；入口动效也要落到该时刻的终态（用于截图对比）。
- 另支持 `?state=error`、`?state=busy`、`?reduce=1`。
- 载入字体后再截图（`document.fonts.ready`）。

## 7 · 可读性与无障碍（硬底线）

- 正文 ≥ 14px，标签 ≥ 12px；中文正文行高 ≥ 1.7；正文对比度 ≥ 4.5:1（`#6b7b70` 在 `#fffefa` 上 ≈ 4.6，别再浅）。
- 表单：`label for`/`aria-label`、`autocomplete`、错误 `role="alert"`、按钮 `:disabled` 状态、`:focus-visible` 2px 墨绿环 + 2px offset。
- 键盘：Tab 顺序 服务器「更改」→ 用户名 → 密码 → 按钮 → 齿轮；Enter 提交。
- 不用 emoji；不用平台字形图标，图标一律内联 SVG（1.5–1.7 描边、圆头）。
- 不编造数据、评价、logo 墙；不写「01/02/03」编号除非真的是序列。

## 8 · 交付物

每个方向一份 `dir-N.html`（单文件，内嵌 logo，无外链），截图存 `shots/`：
- `dir-N-hero.png`：1440×900，`?t=2.4`
- `dir-N-t0.png`：1440×900，`?t=0.3`（看入场）
- `dir-N-t4.png`：1440×900，`?t=4.2`（看背景漂移后的样子）
- `dir-N-error.png`：1440×900，`?t=2.4&state=error`
- `dir-N-375.png`：375×812
截图命令（每个方向用独立 profile，避免并发锁）：
```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars --no-first-run \
  --user-data-dir="$PWD/.tmp-chrome-dirN" --window-size=1440,900 --virtual-time-budget=2500 \
  --screenshot="$PWD/design-demos/login-redesign/shots/dir-N-hero.png" \
  "file://$PWD/design-demos/login-redesign/dir-N.html?t=2.4"
```

## 9 · 判断标准

1. 单看这张 1440 截图，像一个认真做过的桌面产品登录页，而不是 AI 模板。
2. 左侧不解释也能看出「这是个写笔记的地方」，且能看到三种模式/目录/历史里的至少两样。
3. 背景动效有主张、能看见、但不干扰读字；冻结在任意时刻都好看。
4. 登录卡仍是熟悉的那一列，用户能一眼找到用户名、密码、进入笔记。
5. 三个方向骨架不同、温度不同，不是同一版换色。
