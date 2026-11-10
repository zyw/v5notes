# 设置弹窗改版 · 2026-11-10

用户诉求：美化设置弹出框（截图为改版前的实际界面：内容在底部被动作条切断、分组只靠细线、连接卡信息层级弱）。

## 方向

延续客户端「暖白纸 + 鼠尾草绿 + 衬线标题」的纸感语言，把弹窗从**一张长表单**改成**一张纸上的三个分组卡**：

- 头部三段式：小字眉标（PREFERENCES）→ 衬线标题 → 一句说明；右上角圆形关闭按钮。
- 内容区三张卡：连接（特殊卡，浅绿渐变 + 状态胶囊）/ 通用 / 工作区。卡片头部带 24px 图标片和一条渐隐细线，行与行之间用内阴影分隔，悬停才出现 10px 圆角浅色底。
- 连接卡：自定义/官方状态收进右上角胶囊（暖橙 / 鼠尾草绿），服务器地址前加链接图标，URL 用等宽字体；保存按钮为渐变主按钮，禁用态变成浅色块；提示行带信息图标。
- 底部动作条：品牌图标 + 名称 + 内联标语，第二行版本号与「检查更新 / 查看更新说明」；项目主页退成安静的文字链接；「完成」为主按钮。
- 滚动：头部和动作条固定，仅内容区滚动；动作条上方加 12px 渐变遮罩，内容被裁切时有明显的「下面还有」提示，不再出现半行被硬切。

## 改动文件

- `v5notes-client2/src/components/SettingsDialog.vue`：头部、连接卡、分组头、底栏结构与图标；补 `aria-describedby`。
- `v5notes-client2/src/styles/style.css`：`.settings-*` 整段重写（从「设置弹窗：一张轻轻放下的纸」到 `.settings-footer .dialog-error`），并同步 700px / 860px 断点，新增 520px 窄屏规则（连接行换行、语言行下拉占满）。
- `v5notes-client2/src/i18n/{zh-CN,zh-TW,en}.ts`：新增 `settings.subtitle`。

## 预览与截图

- 真实组件预览：`vite dev` 后打开 `http://127.0.0.1:1420/design-demos/settings/preview.html`（支持 `?official=1`、`?locale=en`）。
- 截图脚本：`node design-demos/settings/tools/shot.mjs <client2 绝对路径> <url> <宽> <高> <输出 png> [dpr]`，走 Chrome headless + CDP；`SHOT_MEASURE=1` 会打印弹窗与内容区尺寸，`SHOT_EVAL_FILE=<js>` 可在截图前执行一段脚本（用于保存态、错误态）。
- 对照图脚本：`python3 design-demos/settings/tools/compose.py <client2 绝对路径>`。
- 截图：`shots/settings-redesign-before-after.png`（改前/改后对照）、`settings-redesigned.png`、`-official.png`、`-en.png`、`-short.png`（1280×760）、`-mobile.png`（390×844）、`-dirty.png`（保存可用态）、`-error.png`（地址非法报错态）、`settings-before-current.png`（改前原始截图）。

## 尺寸结论（含 Tauri 下才会出现的「自动启动」行）

- 1440×900：弹窗 760×708（多一行时 766），不滚动。
- 1440×800 / 1280×800：紧凑断点生效，含自动启动行约 685 高，仍不滚动。
- 1280×760：弹窗 664 高，含自动启动行时内容区约 21px 溢出，走独立滚动 + 底部渐变。
- 390×844：内容区滚动，底部渐变提示；连接行换行、语言下拉占满。

## 评审后的修正（第二轮）

- 连接卡的组头和输入行统一 18px 内缩（原来头部 18px、输入 10px，左右各差 8px）。
- 次要文字统一 #66756b（AA：4.50–4.81:1），自定义服务器胶囊改 #8a5a1f（5.19:1）。
- 内容区始终预留 12px 滚动条槽（scrollbar-gutter: stable），右侧内边距相应减 12px：
  卡片、头部关闭按钮、底栏按钮右缘始终对齐，出现滚动时不再左右跳。
- 「完成」= 应用并关闭：有未保存服务器地址时先保存，地址非法则停在弹窗里并显示行内错误。
- 关闭后焦点回到打开设置的那个按钮（onBeforeUnmount 恢复）。
- 开关行整行可点（44px 以上命中区域），语言行不再有 hover 假象；补全主按钮/更新链接/项目链接的绿色焦点环。
- 修复禁用态「保存」被全局 button:disabled 再压一次透明度的问题；补 prefers-reduced-motion 覆盖。
