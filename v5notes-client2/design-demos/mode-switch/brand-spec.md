# brand-spec · V5Notes 客户端（v5notes-client2）

> 本设计沿用现有产品，不新建品牌。所有令牌取自 `src/styles/style.css`，不臆造。

## 产品气质
一个安静的桌面 Markdown 笔记客户端。暖白纸面、墨绿单点强调、细线、大留白、衬线正文 + 无衬线界面。像写作工具，不像后台管理。

## 颜色令牌（实测自 style.css）
| 用途 | 值 |
|---|---|
| 纸面 paper | `#fffefa` |
| 画布 canvas | `#f4f2ec` |
| 侧栏底 | `#f5f6f1` |
| 主墨色 ink | `#27342d` |
| 次级墨 ink-2 | `#364c3b` |
| 强调 accent（墨绿）| `#315b4a` |
| 强调悬停 | `#244636` |
| 强调浅底 | `#e9eee8` / `#f1f3ee` |
| 悬停底 | `#edf1eb` |
| 线条 | `#efefe9` / `#e4e6df` / `#dde3da` |
| 次要文字 | `#748177` / `#89958b` |
| 未保存琥珀 | `#ad7640` / 点 `#d39a59` |
| 危险 | `#a7483d` |

## 字体
- 界面：`'DM Sans','PingFang SC','Noto Sans SC',sans-serif`
- 正文阅读：`'Iowan Old Style','Songti SC','Noto Serif SC',Georgia,serif`
- 等宽：`ui-monospace,SFMono-Regular,Menlo,monospace`
- 正文字号默认 17px（13–26 可调）。

## 形状与节奏
- 圆角：控件 7–9px，面板/弹窗 11–16px，胶囊 999px。
- 顶栏高 48–52px；格式条 38–43px。
- 图标：24 视框、1.55–1.7 描边、圆头圆角 join，线性内联 SVG，不用平台字形。

## 资产
- logo：`src/assets/brand-icon.png`（暖白圆角方块 + 墨绿标记）。不得用样式化文字重绘。

## 应用范围
- 仅用于 v5notes-client2 桌面客户端编辑器界面。
