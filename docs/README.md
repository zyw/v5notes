# V5Notes 项目文档

本目录记录当前仓库的结构和开发入口。内容根据仓库代码与配置整理；与上游 RuoYi-Vue-Plus 或 ElectronEgg 的通用说明相比，以本仓库为准。

## 阅读顺序

1. [项目结构与核心流程](architecture.md)：三端职责、笔记数据、接口和改动位置。
2. [开发与部署](development.md)：依赖、构建命令、配置入口、Docker 现状。
3. [客户端现状与重构方案](client-redevelopment.md)：桌面端能力盘点、技术选型、迁移边界与验收清单。
4. [v5notes-client2 设计稿](superpowers/specs/2026-10-31-v5notes-client2-design.md)：Markdown 优先的块编辑体验、与 `v5md`/后端的接口及验证标准。
5. [查找替换设计方案](superpowers/specs/2026-11-07-find-replace-sidebar-design.md)：查找放进 v5notes 现有右侧大纲栏；大小写、全词和正则由 v5md 完成。
6. [笔记版本历史设计](superpowers/specs/2026-11-08-note-revision-design.md)：保存正文快照、历史预览与可再撤回的恢复，含完整表结构。
7. [笔记回收站设计](superpowers/specs/2026-11-08-note-trash-design.md)：删除笔记和目录先进入回收站，保留 30 天，彻底删除时才清除正文版本。
8. [Vault 双客户端设计](vault-client-design.md)：云端客户端与 `v5notes-vault-client` 拆分；后端独立模块 `note-vault-sync`（`/vault/v1`）。
9. [Vault 客户端插件系统](vault-client-plugin-design.md)：`manifest` + 生命周期；主题一等（Theme API）；网络仅 `network:safe`；发布不对第三方开放。

## 项目概览

V5Notes 是可私有部署的云笔记项目，包含 Java API 服务、管理后台和 Electron 桌面客户端。管理后台负责用户及权限、目录及笔记管理；客户端提供连接服务器、登录、目录树、搜索与 Markdown 编辑。后端沿用 RuoYi-Vue-Plus 的系统管理、文件、代码生成等模块。

| 目录 | 作用 | 主要技术 |
| --- | --- | --- |
| `v5notes/` | Maven 多模块后端 | Java 17、Spring Boot 3.2.9、MyBatis-Plus、Sa-Token |
| `v5notes-admin/` | 管理后台 | Vue 3、Vite 5、Element Plus、Pinia |
| `v5notes-client/` | 桌面壳与客户端页面 | Electron、ElectronEgg；`frontend/` 中为 Vue 3 + Vite |
| `docker/` | 顶层一键部署配置 | Compose、MySQL、Redis、预构建服务镜像 |
| `v5notes/script/sql/` | 后端 SQL 脚本 | 基础表、文件、笔记等 |

文档所述路径均相对于仓库根目录。项目入口的原始介绍和截图见 [根目录 README](../README.md)。
