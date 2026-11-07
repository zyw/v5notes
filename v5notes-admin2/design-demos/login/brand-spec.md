# V5Notes2 云笔记 · 品牌素材与界面上下文

采集日期：2026-11-07
来源：用户工作区中的 v5notes-admin2 代码、已批准的设计稿与实际登录页截图
素材完整度：本次页面设计所需的核心资产已齐；不引入外部产品 Logo

## 核心资产

### Logo
- 实际资产：../../src/assets/logo/logo.png
- 格式与尺寸：PNG，96×94
- 使用方式：保留橙色渐变图标原样，不改色、不拉伸；已内嵌到独立 HTML 原型
- 使用位置：登录页左上角品牌标记

### 产品 UI
- 参考截图：../admin-redesign/implemented-login.png（当前登录页）
- 工作台截图：../home/shots/impl-index.png（仅用于方向 3 的低对比、强模糊背景；不作为内容展示）
- 处理原则：不把截图中的演示指标当成真实业务数据。首页截图只作失焦的界面肌理，具体文字不可读。

## 视觉令牌
从 src/assets/styles/tokens/_theme.scss、design-demos/admin-redesign/落地规范-方向2.md 提取：
- Primary：#1c5a48（薄荷墨绿）
- Primary deep：#0f3d33
- Canvas：#f4f7f5
- Surface：#ffffff
- Soft selection：#e8f2ec
- Border：#e6ebe7
- Title：#15241e
- Body：#2b3a32
- Muted：#5f7067
- Brand mark orange：来自真实 PNG，不另行取色或扩展为 UI 强调色
- Radius：常用 8–14px；阴影保持轻
- 字体：MiSans, HarmonyOS Sans SC, PingFang SC, Noto Sans SC, sans-serif

## 产品信息
- 名称：V5Notes2 云笔记 · 管理控制台
- 从代码确认的登录字段：账号、密码、验证码；支持记住账号；支持微信、MaxKey、TopIAM、Gitee、GitHub 第三方入口；现有页面可切换语言。
- 当前注册开关关闭，故不新增注册链接、忘记密码入口或未经确认的认证方式。

## 气质
清楚、安静、轻盈、可信。主色与登录状态延续已批准的“薄荷工作台”，橙色只由现有应用图标承担。
