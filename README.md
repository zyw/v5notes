# V5Notes

[简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md)

私有部署的云笔记。笔记以 Markdown 保存，可在管理后台和桌面客户端中阅读、编辑，并在同一台服务器上同步。

## 项目组成

| 目录 | 作用 |
| --- | --- |
| `v5notes2` | 后端 API。Java 21、Spring Boot 4.1，提供登录、笔记、目录、回收站、文件和管理接口。 |
| `v5notes-admin2` | 管理后台。Vue 3、TypeScript、Element Plus、Vite。 |
| `v5notes-client2` | 桌面客户端。Vue 3 与 Tauri，在线读写 Markdown 笔记。 |

三端界面均支持简体中文、繁体中文和英文。客户端请求会带上 `Content-Language`，后端按该语言返回提示。

## 本地运行

先准备 MySQL 与 Redis，并按 `v5notes2/note-admin/src/main/resources/application-dev.yml` 填写连接。

```bash
# 后端，默认端口 8080。数据库结构在启动时迁移。
cd v5notes2
mvn -DskipTests package
java -jar note-admin/target/v5notes2.jar --spring.profiles.active=dev
```

```bash
# 管理后台
cd v5notes-admin2
pnpm install
pnpm dev
```

```bash
# 桌面客户端
cd v5notes-client2
npm install
npm run dev
npm run tauri dev
```

## 使用

1. 启动后端。
2. 打开管理后台，创建可登录的用户。
3. 在客户端填入服务器地址、用户名和密码。

客户端需要与服务端一致的 `clientid`。若不一致，构建前设置 `VITE_CLIENT_ID`。若服务器更换了登录用 RSA 公钥，设置 `VITE_API_PUBLIC_KEY`。

## 仓库

- GitHub: https://github.com/zyw/v5notes
- Gitee: https://gitee.com/zyw/v5notes
