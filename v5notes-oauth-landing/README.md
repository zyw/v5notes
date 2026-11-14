# V5Notes OAuth 落地页

给「只公网部署 API + 桌面端」场景用的 **HTTPS 中转页**：接收第三方 OAuth 回调，再唤起 `v5notes://` 桌面应用。

不必部署完整笔记客户端 SPA。唤起 `v5notes://` **只在本落地页完成**；客户端只处理 deep link 换票。

## 目录

```text
v5notes-oauth-landing/
  index.html                 # 说明页
  social-callback/index.html # 真正的回调落地页
  assets/brand-icon.png
  nginx.conf.example
```

## 回调约定

第三方跳回：

```text
https://你的域名/social-callback?source={provider}&code=…&state=…
```

页面会打开：

```text
v5notes://app/social-callback?source={provider}&code=…&state=…
```

与 `v5notes-client2` 的 deep link / `readSocialCallbackParams` 一致。

## 后端配置

```yaml
justauth:
  address: https://admin.example.com          # 管理端（可不对外）
  client-address: https://oauth.example.com   # 本落地页源，不要末尾斜杠
```

各 OAuth 应用登记客户端 redirect，例如：

- `https://oauth.example.com/social-callback?source=zhihu`
- `https://oauth.example.com/social-callback?source=gitee`
- `https://oauth.example.com/social-callback?source=github`
- `https://oauth.example.com/social-callback?source=google`

## 部署

把本目录静态文件挂到 `client-address` 对应域名即可（Nginx / CDN / 对象存储静态站均可）。

注意：`/social-callback`（无尾斜杠）必须能落到 `social-callback/index.html`，见 `nginx.conf.example`。

本地预览：

```bash
cd v5notes-oauth-landing
python3 -m http.server 8088
# 打开 http://127.0.0.1:8088/social-callback/?source=gitee&code=demo&state=demo
```
