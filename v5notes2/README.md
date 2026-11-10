# V5Notes 后端

`v5notes2` 是 V5Notes 的 API 服务，使用 Java 21 与 Spring Boot 4.1。

## 模块

| 模块 | 说明 |
| --- | --- |
| `note-admin` | 启动模块，入口为 `xin.v5ai.V5Notes2Application` |
| `note-modules/note-notes` | 笔记、目录、回收站和客户端接口 |
| `note-modules/note-basics` | 文件上传与下载 |
| `note-modules/note-system` | 用户、角色、菜单、字典等管理接口 |

## 运行

准备 MySQL 与 Redis，并修改 `note-admin/src/main/resources/application-dev.yml`。

```bash
mvn -DskipTests package
java -jar note-admin/target/v5notes2.jar --spring.profiles.active=dev
```

默认端口 8080。数据库结构在启动时迁移。

仓库说明见根目录 [README.md](../README.md)。
