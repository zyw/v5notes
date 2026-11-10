# 登录页 · 第三轮（三个方向完整稿）

在已批准的「方向 2 · 薄荷工作台」系统内，为 `v5notes-admin2` 的登录页做三个**结构不同**的完整高保真原型。三版内容、字段、交互、文案一致，只比较版式与气质。

| # | 方向 | 一句话结构 | 桌面 | 手机（真 375） |
|---|---|---|---|---|
| dir-1 | 门廊 Shell Echo | 264px 白色品牌轨 + `#f4f7f5` 画布 + 页头 + 表单白卡 | [dir-1.png](shots/dir-1.png) | [dir-1-m375.png](shots/dir-1-m375.png) |
| dir-2 | 深色封面 Cover | 左 56% 深绿大字 + 右 44% 白色整高表单栏 | [dir-2.png](shots/dir-2.png) | [dir-2-m375.png](shots/dir-2-m375.png) |
| dir-3 | 台账 Ledger | 纯白文档页：不居中版心 + 行线表单 + 右下元信息 | [dir-3.png](shots/dir-3.png) | [dir-3-m375.png](shots/dir-3-m375.png) |

## 怎么打开
直接双击对应 `dir-*.html`（单文件、无外链、Logo 已内嵌）。桌面按 1440×900 设计，手机按 375×812 重排；两者在同一文件内响应式。

## 共同内容
- 账号 / 密码 / 验证码（图形码，可刷新）/ 记住账号 / 登录。
- 五个第三方入口：微信、MaxKey、TopIAM、Gitee、GitHub。
- 中英切换（含 `document.title`、placeholder、页脚、第三方名称）。
- 空值 inline 校验并聚焦首个错误字段；提交 loading 900ms →「正在进入工作台…」。
- 无注册、无忘记密码（当前后端注册关闭）；无伪造指标。

## 已核验
- 桌面 1440×900：三版 `scrollWidth=1440 / scrollHeight=900`，无滚动条。
- 手机真 375×812（CDP `Emulation.setDeviceMetricsOverride`，2x 截图）：`scrollWidth=375`，无横向溢出；`scrollHeight` 812 / 825 / 956。
- 语言切换、密码显隐、验证码刷新、空值校验（`aria-invalid=3`）、第三方 inline 提示均已实测。
- 说明：本机未安装 Python 版 playwright，`design_lint.py check` 会自动跳过；改用 Chrome 内的 collect 脚本与人工核对（无外链图、无渐变/emoji、正文 ≥14px、标签 ≥12px、控件 ≥44px）。

## 文件
- `spec.md` 共用内容/令牌/交互/尺寸；`directions.md` 六个候选与三个方向卡。
- `assets/` 真实 Logo；`inject-logo.py` 把 `__LOGO_DATA_URI__` 替换为 data URI；`shot.sh` 桌面截图（注意：其 mobile 模式会把视口钳到 500px，不要用它验收手机）。
- 真 375 截图命令：`cd /tmp && node cdp-shot.mjs "file://<abs html>" "<abs png>" 375 812 2`（脚本在 /tmp，浏览器 CDP 渲染）。

## 下一步
选定方向后：把对应结构落到 `src/views/login.vue`（Element Plus 表单、现有 `/code` 验证码、social 登录、i18n 与 rememberMe 逻辑保持不变，只换结构与视觉），并复用 `_theme.scss` 令牌。
