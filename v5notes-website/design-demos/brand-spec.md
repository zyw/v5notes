# brand-spec · V5Notes 官网

## 资产（真实文件，不得重绘）
| 资产 | 路径 | 用法 |
|---|---|---|
| App 图标（青绿圆角方块 + 奶油便签 + 铅笔） | assets/brand/brand-icon.png（源 v5notes-client2/src/assets/brand-icon.png，438×430） | 导航、页脚、favicon；浅底深底都可用 |
| 管理后台图标（橙色渐变 + V5Notes 云朵字） | assets/brand/admin-logo.png | 只在「管理后台」语境出现；不要和青绿图标同时抢主位 |

产品名写作 V5Notes（拉丁）。不用文字重绘图标；图标旁可以排 V5Notes 作为产品名。

## 颜色（从产品截图与现有 style.css 实测，不新造色相）
| 语义 | 值 | 说明 |
|---|---|---|
| 纸白 paper | #fbf9f3 ~ #fffefa | 客户端纸面，官方站浅底 |
| 画布 canvas | #f4f2ec | 浅一档的画布 |
| 侧栏底 | #f5f6f1 | |
| 主墨 ink | #27342d | 正文 |
| 次级墨 | #364c3b | |
| 墨绿 accent | #315b4a | 主按钮 / 链接 / 强调（客户端） |
| 强调悬停 | #244636 | |
| 强调浅底 | #e9eee8 | |
| 发丝线 | #e4e6df / #efefe9 | |
| 次要文字 | #6b7b70（正文下限）/ #8a958c（仅非正文） | |
| 深青 teal | #0b4a52 | 取自图标暗部 |
| 青瓷 mint | #2fa9a4 | 取自图标亮部，**只做小面积点睛，≤5%** |
| 琥珀 amber | #ad7640 | 未保存 / 自定义服务器，语义色 |
| 危险 danger | #a7483d | 错误 / 破坏性操作 |
| 管理端薄荷墨绿 | #1c5a48 | 管理后台主色；官网如出现管理端上下文可用 |
| 管理端深底 | #0f3d33 / #17493a | |

## 字体（只用系统字体，不引外链，保证离线可看）
- 中文标题 / 阅读：'Songti SC','Noto Serif SC','Source Han Serif SC',serif
- 中文界面 / 正文：'PingFang SC','Hiragino Sans GB','Noto Sans SC',sans-serif
- 拉丁标题：'Iowan Old Style','Palatino','Georgia',serif（需要衬线时）或 'Avenir Next','Helvetica Neue',sans-serif（无衬线时）
- 等宽 / 小标签：'SF Mono',ui-monospace,Menlo,monospace
- 正文字号 ≥16px（桌面），标签 ≥12px；中文行高 ≥1.7。

## 形状与质感
- 控件圆角 8–10px，面板 12–16px，胶囊 999px。
- 1px 发丝线；阴影只给「浮起的纸」，低透明度墨绿，不用大范围灰阴影。
- 图标一律内联 SVG，1.5–1.7 描边、圆头圆角；不用 emoji、不用平台字形。

## 语气
安静、具体、可核对。像产品作者在说明它怎么工作，不像增长团队在喊口号。
