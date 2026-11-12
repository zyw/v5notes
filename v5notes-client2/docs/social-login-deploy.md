# 第三方登录部署说明

## 参数开关

| 键 | 含义 |
|---|---|
| `client.thirdPartyLogin.enable` | 客户端是否开启第三方登录 |
| `client.account.registerUser` | 是否允许社交自动开户（及邮箱注册） |

## 回调地址

`application-*.yml`：

- `justauth.address`：管理端前端（admin 回调）
- `justauth.client-address`：笔记客户端回调基址

拼装结果：`{base}/social-callback?source={provider}`。

| 场景 | `client-address` 示例 |
|---|---|
| 本地 Web | `http://127.0.0.1:1420` |
| 生产 Web（部署了 client2） | `https://notes.example.com` |
| 仅 API + 桌面端 | `https://oauth.example.com`（见仓库 `v5notes-oauth-landing/`） |
| 打包 Tauri 且无微信等 https 限制 | `v5notes://app` |

各 OAuth 应用需登记 **admin 与 client 两套** redirect（若两端都用该平台）。  
微信开放平台网站应用通常只接受 http(s)，不能直接登记 `v5notes://`。

### 仅桌面端时的 HTTPS 中转

仓库根目录 `v5notes-oauth-landing/` 是极简静态落地页：接收  
`/social-callback?source&code&state`，再唤起 `v5notes://app/social-callback?...`。  
把该目录挂到公网 HTTPS，并将 `justauth.client-address` 指到该源即可；详见目录内 README。

## 平台凭证

环境变量（示例）：

- `V5NOTES_GITEE_CLIENT_ID` / `V5NOTES_GITEE_CLIENT_SECRET`
- `V5NOTES_WECHAT_OPEN_CLIENT_ID` / `V5NOTES_WECHAT_OPEN_CLIENT_SECRET`
- `V5NOTES_GITHUB_CLIENT_ID` / `V5NOTES_GITHUB_CLIENT_SECRET`
- `V5NOTES_GOOGLE_CLIENT_ID` / `V5NOTES_GOOGLE_CLIENT_SECRET`

## 代理

若 API 部署在国内、需访问 Google / GitHub 换票，按 JustAuth 文档为对应平台配置 `httpConfig` 代理（见 JustAuth Google 指南）。
