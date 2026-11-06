# v5notes-client2

新桌面客户端，在线读写现有后端 Markdown 笔记。首次运行输入服务器地址、用户名和密码；需要服务端配置与现有客户端一致的 `clientid`，如不同请设置 `VITE_CLIENT_ID`。若服务器更换了登录 RSA 公钥，请设置 `VITE_API_PUBLIC_KEY`。登录 token 仅保存在当前窗口内存，服务器地址保存在本机浏览器存储中。

```sh
npm install
npm run dev
npm test
npm run build
npm run tauri dev
```

首期显式保存：按钮或 Ctrl/Cmd+S；切换笔记及桌面关闭时有保存、放弃、取消三项选择。服务端仍无版本校验，多个客户端并发编辑可能互相覆盖。浏览器标签关闭使用浏览器原生的未保存提示。

在独立 `v5md` 仓库执行 `npm run build` 后，开发时可设置 `V5MD_LOCAL_ROOT=/绝对路径/v5md npm run dev`（或 `npm run build`）验证编辑器的 `/` 菜单、块操作柄和排序。未设置时使用锁定的 `@v5md/vue@0.0.1`。正式分发前须发布并锁定包含新能力的包版本，不得在此应用的 `v-model` 外层拼接 Markdown 实现块操作。


## 刷新令牌
登录返回的 `refresh_token` 会持久化到本机存储；访问令牌过期（服务端返回 401）时，客户端会自动调用 `/auth/refresh` 续期并重放原请求，失败才提示重新登录。令牌仅保存在本机，不保存密码。
