# 第三方登录部署说明

## 参数开关

| 键 | 含义 |
|---|---|
| `client.thirdPartyLogin.enable` | 客户端是否开启第三方登录 |
| `client.account.registerUser` | 是否允许社交自动开户（及邮箱注册） |

## 回调地址

**只改两个基址，不要靠 `type.*.redirect-uri` 区分端。**

| 配置 | 用途 |
|---|---|
| `justauth.address` | 管理端：`app=admin`（默认） |
| `justauth.client-address` | 笔记客户端：`app=client` |
| `justauth.type.*.redirect-uri` | **兜底**：仅当上面两个基址都未配置时才用；已配基址时可省略或忽略 |

拼装结果：`{base}/social-callback?source={provider}`。

| 场景 | `client-address` 示例 |
|---|---|
| 仅 API + 桌面端（推荐） | `https://oauth.example.com`（仓库 `v5notes-oauth-landing/`） |
| 打包 Tauri 且平台允许自定义 scheme | `v5notes://app` |

向 OAuth 平台登记时，按实际用到的端分别登记拼装后的完整 URL（不是 YAML 里那条 `redirect-uri`）。  
两端都用同一平台时，登记 **admin 与 client 两套** redirect。  
微信开放平台网站应用通常只接受 http(s)，不能直接登记 `v5notes://`。

### 仅桌面端时的 HTTPS 中转

仓库根目录 `v5notes-oauth-landing/` 是极简静态落地页：接收  
`/social-callback?source&code&state`，再唤起 `v5notes://app/social-callback?...`。  
把该目录挂到公网 HTTPS，并将 `justauth.client-address` 指到该源即可；详见目录内 README。

笔记客户端（Tauri）**不**在浏览器 SPA 换票，也**不**写唤起 `v5notes://` 的代码；HTTP 回调页的唤起由 `v5notes-oauth-landing` 负责，客户端只处理 deep link 换票。

## 平台凭证

环境变量（示例）：

- `V5NOTES_ZHIHU_CLIENT_ID` / `V5NOTES_ZHIHU_CLIENT_SECRET`（知乎开放平台 app_id / app_key）
- `V5NOTES_GITEE_CLIENT_ID` / `V5NOTES_GITEE_CLIENT_SECRET`
- `V5NOTES_GITHUB_CLIENT_ID` / `V5NOTES_GITHUB_CLIENT_SECRET`
- `V5NOTES_GOOGLE_CLIENT_ID` / `V5NOTES_GOOGLE_CLIENT_SECRET`

## 代理

若 API 部署在国内、需访问 Google / GitHub 换票，按 JustAuth 文档为对应平台配置 `httpConfig` 代理（见 JustAuth Google 指南）。
