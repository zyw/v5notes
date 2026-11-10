# 方向卡 2 · 深墨工程（Linear.app 现实参照）

读 spec.md 拿全站文案与素材。本卡只管「长什么样」。

## 一句话
近黑墨绿底上的高精度产品站：大标题一句话，下面直接是一整幅产品窗口；往下读像一份能核对的基础设施文档。

## 令牌
- 底 bg #0b1411；面板 surface #101d18；浮起 surface-2 #14231d；纯黑不用
- 线 rgba(233,238,232,.10)；强线 rgba(233,238,232,.18)
- 文字 #eef2ec；次 #9fb0a6；弱 #6f8177
- 强调青瓷绿 #4fbf94；悬停 #74d3ad；琥珀 #d9a33b（只给「未保存/自定义服务器」这类语义，别装饰）
- 字体：标题 'PingFang SC','Hiragino Sans GB',sans-serif 字重 600；正文同栈；等宽 'SF Mono',ui-monospace,Menlo,monospace
- 字号：H1 78px/1.06 字距 -.03em；section 标题 42px/1.2；导语 20px/1.8；正文 16px/1.8；等宽元数据 12–13px，字距 .04em

## 版式
1. **导航**：固定顶栏 64px，毛玻璃（backdrop-filter blur 16px，底 rgba(11,20,17,.72)），底部 1px 线；左图标＋V5Notes；中 5 个锚点 14px；右 GitHub 文字链＋「下载桌面端」实心青瓷绿胶囊（深色字）。
2. **首屏**（min-height 780px）：左上 H1 两行；右侧同一水平线放一段 20px 灰副标（宽 380px），形成左右对位；下方 40px 两个按钮（实心青瓷＋描边）。再下 64px 是整幅产品窗口 client-home-dark.jpg（宽 1160px，1px 线、radius 14px、外层柔和青瓷辉光 box-shadow 0 40px 120px rgba(79,191,148,.10)）。
3. **首屏下的元数据条**：一条 1px 线，线上 4 个等宽小项：v2.0.0 · Apache 2.0 · MySQL / PostgreSQL · Windows / macOS / Linux。
4. **第 1 段起进入「左索引 + 右内容」**：左 200px sticky 索引（写作 / 回退 / 管理 / 部署 / 技术栈），未激活 #6f8177、激活 #eef2ec 且左侧 2px 青瓷线；右内容 960px。
5. **第 1 段（为什么）**：标题左；4 组对照做成「行」：每行 grid 240px / 1fr，左侧旧情况用 #6f8177、右侧 V5Notes 用正文白；行间 1px 线；行高 96px。
6. **第 2 段（写作）**：标题 + 导语；6 条特性用 2 列 × 3 行，每条：小图标（内联 SVG 1.5 描边，颜色 #4fbf94）＋标题 18px＋说明 15px #9fb0a6；不要卡片背景，靠 1px 线分格。右侧/下方放 client-source.jpg（宽 760px）与 client-palette.jpg（竖图，宽 280px）并排，图注用等宽小字。
7. **第 3 段（回退）**：深色块上两张图并排：client-history.jpg（大，760px）＋ client-trash.jpg（小，360px）；下方 3 条横排。
8. **第 4 段（管理）**：admin-home.jpg 整幅（1080px）；6 格 3×2，深色面板 #101d18、1px 线、radius 12、padding 24；**不要玻璃拟态泛滥**，只有导航毛玻璃一处。
9. **第 5 段（三端）**：三列卡片（客户端 / API / 管理后台），中间用 1px 线与小圆点连成一条横向链路；每张卡有技术栈等宽小字。
10. **第 6 段（部署）**：代码块深色 #0a120f、1px 线、radius 10、mono 14px，关键字/字符串用青瓷与暖白轻轻着色；上方三个 tab（Docker Compose / Jar + Nginx / PostgreSQL）可点击切换代码；地址与备份用两列。
11. **第 7 段（技术栈/开源）**：技术名做成等宽标签网格（不是彩色 pill 墙，统一 1px 线）；右栏 3 条。
12. **CTA**：居中大标题 + 两个按钮 + 一行小字。
13. **页脚**：1px 线，三栏。

## 动效
- 首屏产品窗口随载入上移 16px + 淡入（700ms）；sticky 索引随滚动切换激活态（IntersectionObserver 或 scroll 计算）。
- tab 切换即时；按钮 hover 提亮；卡片 hover 边框提亮一档。
- 不要全站 fade-up。prefers-reduced-motion 静止。

## 禁止
- 不要紫色 / 蓝色渐变，不要 bento 大杂烩，不要玻璃卡片铺满。
- 不要让产品截图加第二层窗口 chrome（截图本身已有 macOS 标题栏）。
- 不要给每个标题加全大写小标签；等宽只用于版本、端口、路径这类真元数据。
