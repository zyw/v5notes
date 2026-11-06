# v5notes2 迁移方案（基于 RuoYi-Vue-Plus 6.1.0）

> 目标：把现有 `v5notes` 后端（基于 RuoYi-Vue-Plus **5.2.2**）迁移到最新 **RuoYi-Vue-Plus 6.1.0** 骨架，产物目录命名 `v5notes2`，保留笔记业务、客户端登录/文件能力，同时给旧客户端与 `v5notes-client2` 留出兼容边界。
>
> 本文是基于两边源码逐项核对后给出的**方案**，不代表已实施。目标源码位置：`/Users/jingyuan-mb01/javaspace/ruoyi/RuoYi-Vue-Plus-v6.1.0`。

## 一、结论（能不能做）

**可以做，但不能“整目录替换”，必须“用 6.1.0 新骨架重建 + 移植 v5notes 自定义业务”。**

原因：这不是小版本升级，而是跨代升级，框架层有破坏性变更：

| 维度 | 现 v5notes（5.2.2） | 目标 RuoYi-Vue-Plus（6.1.0） |
| --- | --- | --- |
| 版本号 | 5.2.2 | 6.1.0 |
| Java | 17 | **21** |
| Spring Boot | 3.2.9 | **4.1.2** |
| Sa-Token | 1.38.0 | **1.46.0**（loginId 分隔符等变化） |
| MyBatis-Plus | 3.5.7 | 3.5.18 |
| Excel | Alibaba EasyExcel（`com.alibaba.excel`） | **Apache Fesod（`org.apache.fesod.sheet`）** |
| 多租户 | 有 `v5cn-common-tenant` | **已移除**（无 TenantHelper / tenant 配置） |
| 分页返回 | `TableDataInfo<T>` | **`PageResult<T>`**（`R<PageResult<T>>`） |
| 幂等注解 | `common-idempotent` 模块 | 合并进 `common-redis`（`org.dromara.common.redis.annotation.RepeatSubmit`） |
| 模块前缀 | `v5cn-*` | `ruoyi-*` |
| 文件模块 | 自带 `v5cn-basics`（`/basics/base/file`） | 无 basics，改为 `ruoyi-system` 的 OSS（`/resource/oss/upload`） |
| DB 名称/端口 | `v5notes-prod` / 8081 | `ry-vue` / 8080 |

因此推荐策略：**新目录 `v5notes2/` = 复制 6.1.0 原样骨架 → 加回一个 notes 业务模块与 client 登录/文件兼容层 → 用新库迁移数据 → 双跑验证后切换**。旧 `v5notes/` 一直保留，作为回滚与对照。

## 二、需要迁移 / 替换 / 丢弃的资产清单

### 2.1 必须迁移的 v5notes 自定义资产

| 资产 | 位置（旧） | 说明 |
| --- | --- | --- |
| 笔记业务模块 | `v5notes/v5cn-modules/v5cn-notes` | 22 个 Java + 2 个 Mapper XML，核心业务，全部迁移为 `ruoyi-notes` |
| 客户端密码登录策略 | `v5cn-admin/.../web/service/impl/ClientPasswordAuthStrategy.java` | 需按 6.1.0 的 `IAuthStrategy`（`login(String, SysClientVo)`）重写 |
| 客户端用户类型 | `v5cn-common-core/.../enums/UserType.java` 的 `CLIENT_USER("cli_user")` | 6.1.0 只有 `SYS_USER`/`APP_USER`，需补回 `CLIENT_USER`（兼容存量用户 `user_type='cli_user'`） |
| 客户端角色常量 | `UserConstants.CLIENT_USER_ROLE = "role_cli_user"` | 如保留“按角色放行上传”才需要；建议上传端点改为仅需登录 |
| 客户端登录/上传所需 SQL | `script/sql/notes_mysql.sql`、`basics_file_mysql.sql` | 笔记表、菜单、`sys_client`（clientPassword/pc_client）、user_type 字典 |
| 现有业务数据 | 线上库 `v5notes-prod` | `note_directory`、`note_notes`、`sys_user` 等 |

### 2.2 用 6.1.0 能力替代、无需迁移

| 旧实现 | 新实现 |
| --- | --- |
| `v5cn-basics`（`/basics/base/file`） | 在 `ruoyi-admin` 增加**兼容控制器** `/basics/base/file`，内部转调 `ISysOssService.upload`，响应适配旧字段；文件落 `sys_oss` |
| `v5cn-common-idempotent` | 改 import 为 `org.dromara.common.redis.annotation.RepeatSubmit` |
| `v5cn-common-tenant` / `TenantEntity` | 删除依赖；`NoteNotes/NoteDirectory` 改继承 `BaseEntity`（`org.dromara.common.mybatis.core.domain.BaseEntity`） |
| `v5cn-common-coze` | 6.1.0 用 `ruoyi-common-ai`（v5notes 未用可不管） |
| `v5cn-common-sse` / `websocket` / `ratelimiter` | 6.1.0 无对应模块；确认 notes 代码未使用即可丢弃（当前 notes 未使用） |
| `v5cn-modules/v5cn-system`、`v5cn-job`、`v5cn-generator`、`v5cn-ai` | 用 6.1.0 的 `ruoyi-system`、`ruoyi-job`、`ruoyi-gen`、`ruoyi-ai` 原版 |

### 2.3 需要新建

- `v5notes2/ruoyi-modules/ruoyi-notes`：移植后的笔记模块（artifactId `ruoyi-notes`，包名沿用 `org.dromara.notes`）。
- `v5notes2/ruoyi-admin/.../web/controller/ClientFileCompatController.java`：`/basics/base/file` 兼容上传（可选兼容下载）。
- `v5notes2/script/sql/notes2.sql`：按 6.1.0 表结构改写的笔记/菜单/字典/客户端数据脚本。
- `v5notes2/docker/` 或复用 `script/docker`：v5notes2 的部署编排。

## 三、目标目录结构

```text
v5notes2/                              # 新后端（= 6.1.0 骨架副本）
├── pom.xml                            # artifactId=v5notes2, revision=6.1.0
├── ruoyi-admin/                       # 启动模块（V5Notes2Application）
│   ├── src/main/java/org/dromara/web/service/impl/ClientPasswordAuthStrategy.java
│   ├── src/main/java/org/dromara/web/controller/ClientFileCompatController.java   # 新增
│   └── src/main/resources/application*.yml   # 改库名/端口/加密密钥/名称
├── ruoyi-api/                         # 系统 API 模型（6.1.0 原版）
├── ruoyi-common/                      # 6.1.0 原版（不动）
├── ruoyi-extend/                      # 6.1.0 原版
├── ruoyi-modules/
│   ├── ruoyi-system/                   # 6.1.0 原版
│   ├── ruoyi-job/ ruoyi-gen/ ruoyi-ai/ ruoyi-workflow/ ruoyi-demo/
│   └── ruoyi-notes/                    # 新增：移植的笔记模块
└── script/sql/notes2.sql               # 新增：笔记相关 SQL
```

> 命名建议：**保留 6.1.0 的 `ruoyi-*` 模块名**，只把根 `artifactId`/`name`/`启动类名` 改成 v5notes2。这样后续跟随上游升级的 diff 最小。若坚持把模块也改名成 `v5cn2-*`，属于纯机械重命名，会增加后续升级成本，不推荐。

## 四、关键代码适配点（旧 → 新）

### 4.1 笔记模块编译级适配

| 旧写法 | 新写法 |
| --- | --- |
| `NoteNotes extends TenantEntity` | `extends BaseEntity`（`org.dromara.common.mybatis.core.domain.BaseEntity`），删除 tenant import |
| `TableDataInfo<XxxVo>` 作为返回 | `PageResult<XxxVo>`（`org.dromara.common.core.domain.PageResult`）；`TableDataInfo.build(page)` → `PageResult.build(page.getRecords(), page.getTotal())` |
| `import org.dromara.common.idempotent.annotation.RepeatSubmit` | `import org.dromara.common.redis.annotation.RepeatSubmit` |
| `import com.alibaba.excel.annotation.ExcelProperty/ExcelIgnoreUnannotated` | `import org.apache.fesod.sheet.annotation.ExcelProperty/ExcelIgnoreUnannotated` |
| `pom` 依赖 `v5cn-common-*` / `v5cn-common-tenant` / `v5cn-common-idempotent` | 改为 `ruoyi-common-core/doc/mybatis/translation/oss/log/excel/sms/security/web/sensitive/encrypt`；**删除 tenant、idempotent** |
| `org.dromara.notes.*` 包名 | 保持不变（与 6.1.0 的 `org.dromara` 一致，无需改包） |

### 4.2 客户端密码登录策略（重点）

6.1.0 的 `IAuthStrategy` 与 5.2.2 不同：

- 接口方法变为 `LoginVo login(String body, SysClientVo client)`；bean 名仍是 `grantType + "AuthStrategy"`；
- `PasswordLoginBody` 位置变为 `org.dromara.system.api.model.PasswordLoginBody`；
- `SysLoginService.checkLogin(LoginType, username, Supplier)`，**去掉了 tenantId 参数**；
- 6.1.0 **没有 `TenantHelper`**，登录不再做 `TenantHelper.dynamic`。

移植后的 `ClientPasswordAuthStrategy` 要点：

```java
@Service("clientPassword" + IAuthStrategy.BASE_NAME)
@RequiredArgsConstructor
public class ClientPasswordAuthStrategy implements IAuthStrategy {
    private final SysLoginService loginService;
    private final SysUserMapper userMapper;

    @Override
    public LoginVo login(String body, SysClientVo client) {
        PasswordLoginBody loginBody = JsonUtils.parseObject(body, PasswordLoginBody.class);
        ValidatorUtils.validate(loginBody);
        SysUserVo user = loadUserByUsername(loginBody.getUsername());
        loginService.checkLogin(LoginType.PASSWORD, user.getUserName(),
            () -> !BCrypt.checkpw(loginBody.getPassword(), user.getPassword()));
        LoginUser loginUser = loginService.buildLoginUser(user);
        if (!UserType.CLIENT_USER.getUserType().equals(loginUser.getUserType())) {
            throw new UserException("user.not.type.error");
        }
        loginUser.setClientKey(client.getClientKey());
        loginUser.setDeviceType(client.getDeviceType());
        SaLoginParameter model = IAuthStrategy.buildLoginParameter(client);
        LoginHelper.login(loginUser, model);
        LoginVo vo = new LoginVo();
        vo.setAccessToken(StpUtil.getTokenValue());
        vo.setExpireIn(StpUtil.getTokenTimeout());
        vo.setClientId(client.getClientId());
        return vo;
    }
}
```

注意：
1. `UserType` 需补 `CLIENT_USER("cli_user")`。
2. 客户端仍会发送 `tenantId`、`deviceType`；6.1.0 的 `LoginBody` 没有这两个字段。需确认 `JsonUtils` 忽略未知字段；若不忽略，则在 `LoginBody` 增加可选 `tenantId`/`deviceType` 字段或新建 `ClientLoginBody`（**不要**恢复租户逻辑，只做兼容占位）。
3. `sys_client` 记录：`grant_type` 必须含 `clientPassword`，`device_type='pc_client'`，`client_id` 与各客户端一致（client2 默认 `d9df3c0228c05e5c61db46348bcadf6e`）。

### 4.3 文件上传兼容（保证旧笔记图片不失效）

- 旧客户端与 client2 都调用 `POST /basics/base/file`，返回 `{url, id, path}`（头像还用到 `id`）。
- 6.1.0 只有 `POST /resource/oss/upload`，返回 `{url, fileName, ossId}`。
- 方案：在 `ruoyi-admin` 增加兼容控制器：

```java
@RestController
@RequestMapping("/basics/base/file")
public class ClientFileCompatController {
    private final ISysOssService ossService;
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public R<Map<String,Object>> upload(@RequestPart("file") MultipartFile file) {
        SysOssVo oss = ossService.upload(file, null);
        return R.ok(Map.of("url", oss.getUrl(), "id", String.valueOf(oss.getOssId()),
                           "path", oss.getFileName()));
    }
}
```
- **历史图片 URL 兼容（关键风险）**：旧笔记内容里的图片 URL 指向旧文件服务（`basics_file.url`，形如旧域名 + `/basics/base/file/{configId}/get/...`）。切到 OSS 后旧 URL 会 404。二选一：
  - **A（推荐，省事）**：迁移旧文件数据+物理文件，保留旧下载路由 `/basics/base/file/{configId}/get/**` 的兼容实现（读旧 `basics_file`+`basics_file_content` 或直读磁盘目录），保证旧 URL 仍可访问；
  - **B**：把旧文件迁入 OSS 并批量改写笔记内容里的 URL（需全文替换 + 域名映射，风险高）。
  - 若旧文件就是本地磁盘存储（`storage=100`），最简单是保留原 `/mnt/uploadfile` 挂载并加一个静态/透传路由。

### 4.4 加密密钥（保证 client2 登录不失败）

- client2 内置公钥为旧 v5notes 公钥（`MFwwDQYJ...KoR8mX0rGKL...`），对应旧服务端 `api-decrypt.privateKey = MIIBVAIBADAN...`。
- 6.1.0 默认是**另一对**密钥（`MIGfMA0... / MIICdw...`）。若直接用 6.1.0 默认值，client2 登录解密会失败。
- 方案：
  - **A（推荐，零客户端改动）**：把 v5notes2 的 `api-decrypt.publicKey/privateKey` 配置成旧 v5notes 的那一对；
  - B：轮换密钥，同时改 client2 `VITE_API_PUBLIC_KEY` 并重新发版（还要改旧 Electron 客户端）。
- 注意 `api-decrypt.enabled: true` 与 `headerFlag: encrypt-key` 两边一致。

### 4.5 配置适配（`ruoyi-admin/src/main/resources`）

| 项 | 旧 | 新 |
| --- | --- | --- |
| 启动类 | `V5NotesApplication` | 改名 `V5Notes2Application`（原 `DromaraApplication` 改名） |
| 数据源 | `v5notes-prod` / `v5notes-dev`，配置里有 ENC(...) 加密连接串 | 指向新库 `v5notes2`（或 `v5notes-prod` 新实例），开发用明文 `root/root` 或改 ENC |
| 端口 | 8081 | 8080（注意 docker/nginx 映射与旧客户端填写的服务器地址） |
| 多租户 | `tenant.enable:false` + excludes | **整段删除**（6.1.0 无 tenant） |
| 加密 | 旧 keypair | 复用旧 keypair（见 4.4） |
| 产品名 | `v5notes.name/version` | 改为 `v5notes2` |
| springdoc | 云笔记分组 | 保留/改名 |

### 4.6 权限与安全（顺手修复旧版问题）

- 旧 `NoteNotesServiceImpl.queryById/updateByBo/deleteWithValidByIds`、`NoteDirectoryServiceImpl` 同 ID 操作**未按 userId 校验归属**，存在越权。迁移时建议补：
  - `queryById`：`eq(userId, LoginHelper.getUserId())` 校验；
  - `updateByBo/delete`：先查归属再操作；
  - 目录树继续用数据权限或显式 userId 过滤（6.1.0 数据权限机制已变化，需实测）。
- 客户端接口 `/client/notes/**` 需登录（Sa-Token 默认校验，沿用）。
- `/client/ping` 保持 `@SaIgnore`。
- 文件兼容上传只需 `@SaCheckLogin`（或配置 client 角色），避免依赖 `role_cli_user` 是否在库。

## 五、SQL 与数据迁移

### 5.1 表结构差异（必须先比对）

- 6.1.0 的 `sys_menu` 比旧版多 `query_param / active_menu / ext`，旧 notes 菜单 SQL 用显式列名，需**只保留 6.1.0 存在的列**（去掉 `tenant_id`）。
- 6.1.0 的 `sys_dict_type/sys_dict_data` **没有 tenant_id 列**；旧 notes/basics 字典插入需去掉 `tenant_id`。
- `note_directory / note_notes`：`tenant_id` 列可保留（有默认值 `000000`），但实体改 `BaseEntity` 不再写入；新建库时建议直接去掉 `tenant_id` 与 `dept_id` 之外无关列，保持与 `BaseEntity` 对齐。
- `sys_user/sys_role/sys_dept/sys_post/sys_menu/sys_role_menu/sys_user_role` 等系统表：**逐表对比 `ry_vue_5.X.sql` 与 `ry_vue.sql`**，生成列映射（这是 Phase 4 的核心交付物）。

### 5.2 推荐：新建库 + 数据搬迁（不原地升级）

1. 用 6.1.0 `script/sql/ry_vue.sql` 初始化新库 `v5notes2`；
2. 执行 `notes2.sql`：建 `note_directory`、`note_notes`，插入笔记菜单（对齐新 `sys_menu` 列）、`user_type` 字典（`cli_user`）、`sys_client`（clientPassword/pc_client）；
3. 从旧库按显式列 `INSERT ... SELECT` 迁移：`sys_user`（`user_type` 保留 `cli_user`）、`sys_role/sys_user_role`、`sys_dept/sys_post`、`sys_menu/sys_role_menu`（notes/file 菜单）、`note_directory`、`note_notes`；
4. 文件：见 4.3（保留旧文件表/路由或迁 OSS）；
5. 记录迁移前后行数做一致性校验。

> 为什么不原地升级：5.2.2→6.1.0 系统表列变化大（移除 tenant、menu 增列、oss 取代 file），原地 ALTER 风险高且难回滚。新库迁移可保留旧库作为回滚基线。

## 六、分阶段实施计划

### Phase 0：准备（0.5 天）
- [ ] 从 6.1.0 复制骨架到 `v5notes2/`，仅保留 `ruoyi-*`；改根 `artifactId=ruoyi-vue-plus`→`v5notes2`、`name`、启动类名。
- [ ] 新增 git 分支（如 `feature/v5notes2`），旧 `v5notes/` 不动。
- [ ] 确认本机 JDK 21 + Maven（已具备：Java 21.0.11、Maven 3.9.9）。
- 验收：`cd v5notes2 && mvn -q -DskipTests compile` 通过（原样骨架）。

### Phase 1：骨架可运行（0.5 天）
- [ ] 新库 `v5notes2` 导入 `ry_vue.sql`；改 `application-dev.yml` 数据源/Redis。
- [ ] 删 tenant 配置；端口改 8080。
- 验收：启动成功，管理端账号能登录，`/client/ping` 返回 200。

### Phase 2：notes 模块移植（2–3 天）
- [ ] 建 `ruoyi-modules/ruoyi-notes`，迁移 22 个 Java + 2 XML，按 4.1 改包/注解/分页/Excel/依赖。
- [ ] `ruoyi-modules/pom.xml` 加 `<module>ruoyi-notes</module>`；`ruoyi-admin/pom.xml` 加依赖。
- [ ] 管理端接口：`/notes/notes/**`、`/notes/directory/**` 按 6.1.0 规范返回 `R<PageResult>`。
- [ ] 客户端接口：`/client/notes/**`、`/client/notes/dir/**` 保持路径不变；列表类返回顶层 `PageResult`（`{rows,total}`）以兼容旧客户端。
- 验收：编译通过；Swagger 可见；admin 可增删改查目录/笔记；client 接口 CRUD 正常。

### Phase 3：客户端兼容层（1–2 天）
- [ ] 移植 `ClientPasswordAuthStrategy`（4.2）+ 补 `UserType.CLIENT_USER`。
- [ ] `sys_client` 增加 clientPassword/pc_client 记录；验证 client2 登录。
- [ ] 增加 `/basics/base/file` 兼容上传（4.3），验证头像/编辑器图片上传。
- [ ] 复用旧加密 keypair（4.4）。
- 验收：client2 登录、树、打开、编辑、保存、上传全链路通过；旧 Electron 客户端至少登录/列表/上传通过。

### Phase 4：SQL/数据迁移 + 权限（2 天）
- [ ] 完成系统表列映射脚本；`notes2.sql` 建表+菜单+字典+client。
- [ ] 按 5.2 迁移数据；行数校验；抽样检查笔记内容与图片可访问。
- [ ] 修复按 ID 越权（4.6）。 
- 验收：迁移后 admin/client 读到的数据与旧库一致；越权用例被拒。

### Phase 5（可选）：管理后台前端升级（2–3 天）
- 旧 `v5notes-admin` 基于 plus-ui 5.x，与 6.1.0 后端不兼容（分页包装、OSS 接口、user_type、menu 列、tenant 移除）。建议改用 `plus-ui-v6.1.0-Vue`，再移植 `views/notes/**`、`api/notes/**`、文件管理页（`api/basics/**` → OSS）。
- 若暂不升级：v5notes2 只服务 client/client2，管理功能先用旧 v5notes 后台管理旧库，会导致“两个后台两套库”，仅作过渡。

### Phase 6：联调、切换、回滚（1 天）
- [ ] 回归矩阵（见第七节）全绿。
- [ ] 灰度切换：旧客户端地址指向 v5notes2；观察日志与错误。
- [ ] 保留旧 v5notes 服务与旧库，随时可切回。

## 七、验证清单

**客户端接口（client2 + 旧 client）**
- [ ] `GET /client/ping` 200
- [ ] `POST /auth/login`（clientPassword/pc_client，AES+RSA 加密）→ access_token
- [ ] `GET /client/notes/dir/tree` 树结构、ID 为字符串、type 数字
- [ ] `GET /client/notes/{id}` 返回 content；`PUT /client/notes` 保存
- [ ] `GET /client/notes/list` 与 `/new-notes` 返回 `{rows,total}`
- [ ] `GET /client/notes/search`
- [ ] 目录 CRUD、递归删除
- [ ] `POST /basics/base/file` 上传，返回 `{url,id,path}`；旧图片 URL 可访问
- [ ] 401 时客户端清除 token 并重新登录

**管理端接口**：笔记/目录 list/get/add/edit/remove/export、tree、tree-dir。

**数据迁移**：各表行数一致；抽样笔记 content 一致；图片抽样可打开。

**安全**：client 用户不能读/改他人笔记（越权用例）。

**构建/部署**：`mvn -DskipTests package` 成功；docker compose 启动；健康检查。

## 八、风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| Spring Boot 4 / Java 21 生态兼容 | 部分依赖（snailjob、satoken、oss 等）版本需匹配 | 直接用 6.1.0 的 BOM 版本，不自升级依赖 |
| 系统表结构差异大 | 数据迁移丢列/报错 | Phase 4 逐表列映射 + 事务化迁移脚本 + 行数校验 |
| 历史图片 URL 失效 | 旧笔记图片打不开 | 保留旧文件下载路由 / 迁 OSS 并改写（4.3） |
| 加密密钥不一致 | client2 登录失败 | 复用旧 keypair（4.4） |
| 客户端分页返回格式变化 | 旧客户端列表空白 | client 列表接口保持顶层 `{rows,total}` |
| tenant 移除 | 旧租户字段/过滤失效 | v5notes 实际单租户（000000），去掉即可；确认无跨租户依赖 |
| 按 ID 越权 | 数据泄露 | Phase 4 修归属校验 |
| 管理后台不兼容 | 管理页打不开 | Phase 5 用 plus-ui v6.1.0 迁移，或暂用旧后台过渡 |

## 九、待确认的决策点

1. **范围**：v5notes2 只做后端，还是连管理后台（`v5notes-admin`→plus-ui v6.1.0）一起升级？
2. **数据库**：新库迁移（推荐）还是原地 ALTER 升级？
3. **文件存储**：保留旧文件服务/路由，还是迁 OSS 并改写历史 URL？
4. **加密密钥**：复用旧 keypair（推荐，客户端零改动）还是轮换？
5. **模块命名**：保留上游 `ruoyi-*`（推荐）还是全量改名 `v5cn2-*`？
6. **客户端兼容**：是否要求旧 Electron 客户端也继续可用？（决定是否保留 `/basics/base/file` 与顶层分页）

## 十、已确认决策（2026-11-06）

1. **范围**：后端 + 管理后台都迁移。管理后台以 `plus-ui-v6.1.0-Vue` 为基础，产物命名 **v5notes-admin2**。
2. **数据库**：**新库迁移**（旧库保留作回滚），数据迁移脚本见 `v5notes2/script/sql/migrate_data_from_old.sql`。
3. **文件存储**：继续使用 **`basics_file` 存储**（本地磁盘/DB 等），**不使用 OSS**；因此移植 `v5cn-basics` 为 `ruoyi-basics`，保留 `/basics/base/file` 等原有端点与旧图片 URL。
4. **客户端**：不要求旧 Electron 客户端兼容；`v5notes-client2` 保持可用。
5. **加密密钥**：复用旧 v5notes 的 RSA 密钥对（backend `api-decrypt` 与 admin2 `.env` 已对齐），client2 无需改动。
6. **模块命名**：v5notes2 保留上游 `ruoyi-*` 模块名，仅根 artifactId/名称改为 v5notes2。

## 十一、落地产物（本仓库）

- `v5notes2/`：6.1.0 骨架 + `ruoyi-notes` + `ruoyi-basics` + `ClientPasswordAuthStrategy` + `script/sql/notes2.sql` + `script/sql/migrate_data_from_old.sql` + `docker/`。
- `v5notes-admin2/`：plus-ui 6.1.0 骨架 + 笔记/文件管理页面与 API。



## 十二、实施进度（2026-11-06）

已完成落地（本仓库）：

- **v5notes2 后端**：由 RuoYi-Vue-Plus 6.1.0 骨架复制，根 artifactId/启动类改为 v5notes2/V5Notes2Application。
  - 移植 `ruoyi-notes`（笔记+目录，管理端 + 客户端接口，路径不变）与 `ruoyi-basics`（`basics_file` 文件存储，保留 `/basics/base/file`）。
  - 新增 `ClientPasswordAuthStrategy`（clientPassword/pc_client）；`UserType` 补 `CLIENT_USER("cli_user")`；`LoginBody` 兼容 tenantId/deviceType。
  - 分页 `TableDataInfo→PageResult`（管理端 `R<PageResult>`，客户端列表保持顶层 `{rows,total}`）；EasyExcel→Fesod；RepeatSubmit 迁到 common-redis；TenantEntity→BaseEntity。
  - 客户端树接口改为显式按 `userId` 过滤，并给客户端 `GET /client/notes/{id}`、`/client/notes/dir/{id}` 增加归属校验（缓解越权）。
  - 配置：`application*.yml` 库名 `v5notes2`、名称 V5Notes2、复用旧 v5notes RSA 密钥对（兼容 client2 登录）。
  - SQL：`script/sql/notes2.sql`（6.1.0 表结构，无 tenant_id；笔记/文件表、菜单、字典、sys_client、本地文件主配置）；`script/sql/migrate_data_from_old.sql`（旧库→新库数据迁移）。
  - 部署：`docker/`（compose + Dockerfile + nginx + init.sql + env.example）；`maven-settings.xml`（Maven 镜像/本地仓库）。
  - 构建验证：`mvn -s maven-settings.xml -DskipTests -Dmaven.test.skip=true package` → **BUILD SUCCESS**，产出 `ruoyi-admin/target/v5notes2.jar`（含 ruoyi-notes / ruoyi-base-file / ruoyi-admin-file 与 ClientPasswordAuthStrategy）。
- **v5notes-admin2 管理前端**：由 plus-ui-v6.1.0-Vue 复制改名，移植笔记/目录/文件管理页面与 API；`pnpm build` **通过**。
  - 降级点：旧 admin 的 `editor-md`(vditor) / `preview-md` 在 v6 无对应依赖，暂降级为原生 textarea 编辑与 `<pre>` 预览（保留加载/保存/Ctrl+S）。

尚需注意 / 后续：

- **数据库脚本未在本机执行验证**：环境无 MySQL/Docker，需在目标 MySQL 8 上按 `ry_vue.sql → notes2.sql →（可选）migrate_data_from_old.sql` 顺序执行并核对。
- 管理端 Markdown 富文本编辑/预览为降级实现，如需恢复可接入 markdown 渲染器或 vditor。
- 客户端按 ID 的 update/delete 归属校验仍建议补强（本次已补树过滤与读取校验）。
- 旧 Electron 客户端不再保证兼容（按决策）。


## 十三、追加能力（2026-11-06）

1. **管理端 Markdown 渲染已恢复**：`v5notes-admin2` 增加 `vditor` 依赖，`editor-md.vue` 用 Vditor 实时渲染编辑（IR 模式、工具栏、图片上传走 `/basics/base/file`、Ctrl/Cmd+S 保存 `updateNotes`），`preview-md.vue` 用 `Vditor.preview` 渲染。`pnpm build` 通过。
2. **客户端写操作归属校验**：`ClientNotesController` / `ClientNotesDirController` 的 add/edit/remove 全部校验目标对象与父目录的 `userId` 归属，越权返回 `R.fail`；对不存在记录亦按无权处理。
3. **Flyway 双数据库支持**：参考 baize-ai，`ruoyi-admin` 引入 `flyway-core` / `flyway-database-postgresql` / `flyway-mysql` / `spring-boot-starter-flyway`；`application.yml` 增加 `spring.flyway`（`locations: db/migration/common + db/migration/${v5notes.db-dialect}`、`table: flyway_schema_history`、`baseline-on-migrate: true`）与 `v5notes.db-dialect`（默认 mysql，可用 `V5NOTES_DB_DIALECT` 覆盖）。
   - 迁移脚本：`db/migration/mysql/{V1__base_schema,V2__v5notes_schema}.sql`、`db/migration/postgresql/{V1__base_schema,V2__v5notes_schema}.sql`。V1 基础 schema 来自官方 ry_vue（MySQL）与 postgres_ry_vue（PG），V2 来自 notes2.sql（PG 已做类型/语法转换）。
   - 注意：全新库自动执行 V1+V2；若已有库已手工建过 V2 的表，需将 `spring.flyway.baseline-version` 设为 2 或手工 baseline，避免 V2 的 DROP TABLE 重建。

最终验证：后端 `mvn -DskipTests -Dmaven.test.skip=true package` → BUILD SUCCESS（`v5notes2.jar` 含 flyway 依赖与两方言迁移）；管理端 `pnpm build` → EXIT 0。


## 十四、阶段性完成度（截至 2026-11-06）

| 阶段 | 代码/脚本 | 运行验证 | 说明 |
| --- | --- | --- | --- |
| Phase 0 准备 | 95% | — | 骨架复制、改名完成；git 功能分支未单独创建（仍在 dev 工作区） |
| Phase 1 骨架可运行 | 100% | 0% | 配置（库名/端口/名称/加密）已改；本机无 MySQL/Docker，未实际建库启动 |
| Phase 2 notes 模块移植 | 100% | 未联调 | 23 Java 移植完成，编译+打包通过；Swagger/admin/client 运行未联调 |
| Phase 3 客户端兼容层 | 100% | 未联调 | clientPassword 策略、UserType、sys_client SQL、basics 文件上传、旧加密密钥已就绪 |
| Phase 4 SQL/数据迁移 + 权限 | 80% | 未执行 | notes2.sql、migrate_data_from_old.sql、越权修复完成；数据迁移/行数校验未在真实库执行 |
| Phase 5 管理后台升级 | 100% | 构建通过 | v5notes-admin2 完成，含笔记/文件页面、Markdown 渲染 |
| Phase 6 联调/切换/回滚 | 0% | 0% | 需真实 MySQL/PG 与桌面客户端联调后执行 |

**总体判断**：代码与构建层面约完成 **85%**；按“可在目标环境上线验收”口径约 **55%**，主要差 Phase 1/4/6 的数据库执行与端到端联调（本机无 MySQL/Docker）。

额外超出原计划并已完成：Flyway（MySQL+PG）、管理端 Markdown 渲染、客户端写操作归属校验。


## 十五、模块与包名重构（2026-11-06）

按需求对 v5notes2 后端做了模块/包名重构，并裁剪掉无关业务模块：

**1) 模块重命名（ruoyi → note）**
- 顶层：`ruoyi-admin→note-admin`、`ruoyi-api→note-api`、`ruoyi-common→note-common`、`ruoyi-extend→note-extend`、`ruoyi-modules→note-modules`
- 子模块：`ruoyi-common-*→note-common-*`、`ruoyi-system→note-system`、`ruoyi-notes→note-notes`、`ruoyi-basics→note-basics`、`ruoyi-base-file→note-base-file`、`ruoyi-admin-file→note-admin-file`、`ruoyi-snailjob-server→note-snailjob-server`
- 所有 `pom.xml` 的 artifactId、module 引用、依赖引用同步改名；groupId 改为 `xin.v5ai`。

**2) 移除模块**
- `note-modules`：删除 ai / demo / workflow / gen / job。
- `note-extend`：删除 monitor-admin / snailai-server（保留 snailjob-server）。
- `note-common`：删除 common-ai / common-liteflow / common-elasticsearch / common-mcp / common-mqtt。
- `note-api`：删除 workflow 包。
- 同步清理 root/module poms 中的 module 声明、dependency、dependencyManagement 与 gen profile。

**3) 包名 org.dromara → xin.v5ai**
- 源码目录 `src/*/java/org/dromara` → `src/*/java/xin/v5ai`；Java package/import、Mapper XML namespace、YAML 的 `mapperPackage/typeAliasesPackage`、AutoConfiguration.imports 全部改为 `xin.v5ai`。
- 注意：第三方库 `org.dromara.sms4j` 保持原 groupId/包名（不属于本项目包）。

**验证**：`mvn -DskipTests -Dmaven.test.skip=true package` → **BUILD SUCCESS**，产物 `note-admin/target/v5notes2.jar`（130 MB，包含 note-notes/note-base-file/note-admin-file/note-system 等，class 包名为 `xin.v5ai.*`）。HTTP 接口契约未变，管理端/客户端无需改动。


## 十六、刷新令牌（Refresh Token，2026-11-06）

**后端 v5notes2**
- 新增 `RefreshTokenStore`（Redis 存 `auth:refresh:<sha256(token)> → userId\nclientId`，TTL 30 天，一次性消费；当前访问令牌会话记录哈希用于登出撤销）。
- 新增 `AuthTokenService`：登录成功后追加刷新令牌；`refresh(refreshToken)` 校验并轮换，重新构建 `LoginUser` 并用 `IAuthStrategy.buildLoginParameter(client)` 生成新访问令牌。
- `AuthController`：登录响应包含 `refresh_token` / `refresh_expire_in`；新增 `POST /auth/refresh`（`@ApiEncrypt`，body `{refreshToken}`）返回新的令牌对（刷新令牌轮换）。
- `SysLoginService.logout`：登出时撤销该会话关联的刷新令牌。
- 兼容所有授权类型（password / clientPassword 等），客户端 `v5notes-client2` 仍可用（会拿到 refresh 字段但未强制使用）。

**管理前端 v5notes-admin2**
- `utils/auth.ts` 增加 `Admin-Refresh-Token` 存储；`api/types.ts` 的 `LoginResult` 增加 refresh 字段；登录成功后保存 refresh_token，登出清理。
- `utils/request.ts`：响应 code=401 时，若存在 refresh_token 且非刷新请求，先调用 `/auth/refresh`（并发请求共享同一个 Promise），成功后更新令牌并**自动重放原请求**；刷新失败再走重新登录提示。刷新请求自身标记 `isRefreshTokenRequest` 防止递归。
- `api/login.ts` 增加 `refreshTokenApi` 参考实现。

**验证**：后端 `mvn -o -DskipTests -Dmaven.test.skip=true package` → BUILD SUCCESS；管理端 `pnpm build` → EXIT 0。


## 十七、无感续期与客户端刷新令牌（2026-11-06）

**管理端 v5notes-admin2：过期前主动刷新**
- `utils/auth.ts` 新增访问令牌绝对过期时间存储（`Admin-Token-Expires-At`）：`getTokenExpireAt/setTokenExpireAt/removeTokenExpireAt`。
- 登录成功记录 `Date.now()+expire_in*1000`；`utils/request.ts` 新增 `scheduleTokenRefresh(expireIn)` 与 `startTokenRefresh()`：在令牌过期前 60 秒自动调用 `/auth/refresh`，刷新成功后更新令牌并继续安排下一次续期；刷新失败仍由 401 流程兜底。
- `permission.ts` 每次进入受保护路由（含刷新页面恢复会话）时启动续期。
- 保留原有 401 时“刷新并重放请求”的兜底逻辑；登出清理令牌与过期时间。

**客户端 v5notes-client2：接入刷新令牌**
- 新增 `refreshToken` 状态并持久化到 `localStorage['v5notes-refresh-token']`；登录时保存后端返回的 `refresh_token`。
- `service/request/index.ts`：已认证请求首次 401 时，若有刷新令牌则调用 `/auth/refresh`，成功后重放一次原请求；失败才触发登录过期处理。
- `service/api/index.ts`：新增 `performRefresh`（AES+RSA 加密调用 `/auth/refresh`，与登录同一套加密），并通过回调把新令牌写回工作区状态；`login` 返回值类型加入 `refresh_token/expire_in`。
- 登出、重新登录时清除刷新令牌；会话恢复时旧访问令牌若过期，会自动用刷新令牌续期。


## 十八、清理 test_demo/test_tree 与已删模块前端（2026-11-06）

**数据库初始化脚本（V1 未执行，可直接改）**
- 从 `db/migration/mysql/V1__base_schema.sql`、`db/migration/postgresql/V1__base_schema.sql` 及源脚本 `script/sql/ry_vue.sql`、`postgres/postgres_ry_vue.sql`、`oracle/oracle_ry_vue.sql`、`sqlserver/sqlserver_ry_vue.sql` 中删除 `test_demo`、`test_tree` 的建表、注释、索引/约束与种子数据。
- 删除已删模块对应的菜单/授权数据：测试菜单(0005)及 1500–1511、系统工具(0003)及代码生成(115/116、1055–1060)、AI会话(0008)、Admin监控(117)、AI控制台(121) 以及相关 `sys_role_menu` 记录。
- 删除已删模块的独立 SQL 脚本：`ry_ai.sql / ry_job.sql / ry_workflow.sql` 及各数据库方言副本；删除 `script/demo/`。

**管理前端 v5notes-admin2（未改动旧 v5notes-admin）**
- 删除页面/API：`views/{ai,demo,workflow,tool}`、`api/{ai,demo,workflow,tool}`、`views/monitor/admin`、`views/monitor/snailai`。
- 删除仅工作流使用的组件：`components/Process`、`components/BpmnDesign`、`components/BpmnView`，并清理 `types/components.d.ts` 中对应声明。
- 保留：notes、basics、system、monitor 的 online/cache/operlog/logininfo/snailjob（snailjob-server 模块保留）。

**验证**
- 后端 `mvn -o -DskipTests -Dmaven.test.skip=true package` → BUILD SUCCESS；jar 内 V1 迁移脚本中 `test_demo/test_tree` 计数为 0。
- 管理端 `pnpm build` → EXIT 0；无对已删页面/API/组件的残留引用。
- `v5notes-admin/` 未改动。


## 十九、同步「文档管理」到 v5notes2（2026-11-06）

旧 `v5notes` 有一个独立「文档管理」页面（旧 `v5notes-admin/src/views/docs/index.vue`，菜单 id 8，基于 basics 文件库）。此前 v5notes2 **未同步**，现已补齐：

**管理端 v5notes-admin2**
- 新增 [src/views/docs/index.vue](v5notes-admin2/src/views/docs/index.vue)：文件类型分组（全部/MarkDown/PDF/文档/图片/其他）、按名称/类型搜索、分页列表、上传、下载、删除；数据来自 `/basics/admin/file`，上传走 `/basics/base/file`（与会话令牌/客户端一致）。
- 说明：旧页的“重命名/移动”原本就是前端 TODO、后端无对应接口，本次未实现（避免假功能）。

**后端 v5notes2**
- `FileInfoSearchBo` 增加 `name` 字段，`FileInfoServiceImpl` 的查询条件增加按文件名模糊搜索，文档管理搜索可用。

**菜单数据**
- 在 `script/sql/notes2.sql` 增加菜单 id 8「文档管理」（component `docs/index`，parent 0），并为 role_id=1 授权；同步追加到 Flyway 的 `db/migration/mysql/V2__v5notes_schema.sql` 与 `postgresql/V2__v5notes_schema.sql`。

**验证**
- 管理端 `pnpm build` → EXIT 0（产出 `docs-*.js` chunk）。
- 后端 `mvn -o -DskipTests -Dmaven.test.skip=true package` → BUILD SUCCESS（130 MB）。


## 二十、修复 Flyway V2 首次启动失败（2026-11-06）

**现象**：首次启动 Flyway V1 成功，V2 报 `Column 'update_time' cannot be null`（`basics_file_config`）。

**原因**：V2 种子数据 `INSERT INTO basics_file_config ... VALUES (..., sysdate(), NULL, NULL)` 把 `update_time` 显式写成 NULL，而该列是 `NOT NULL DEFAULT CURRENT_TIMESTAMP`。

**修复**：MySQL 脚本改为 `sysdate(), NULL, sysdate()`，PostgreSQL 改为 `now(), NULL, now()`；已同步 `script/sql/notes2.sql`、`db/migration/mysql/V2__v5notes_schema.sql`、`db/migration/postgresql/V2__v5notes_schema.sql`，并重新打包。

**恢复方式（V2 失败后数据库已有部分 DDL/数据）**：开发库建议直接重建后重启：
```sql
DROP DATABASE IF EXISTS \`v5notes2-dev\`;
CREATE DATABASE \`v5notes2-dev\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```
重启应用即可重新执行 V1+V2。不要对已失败的 V2 直接 repair 重跑（V2 无完整回滚，dict/client 等插入可能主键冲突）。

**说明**：日志中的 `Integer display width is deprecated` 是 MySQL 8 对 `int(11)` 写法的告警，不影响迁移。


## 二十一、移除 gen_table / gen_table_column（2026-11-06）

- 已在 [V1__base_schema.sql(mysql)](v5notes2/note-admin/src/main/resources/db/migration/mysql/V1__base_schema.sql) 与 [V1__base_schema.sql(postgresql)](v5notes2/note-admin/src/main/resources/db/migration/postgresql/V1__base_schema.sql) 中删除 `gen_table`、`gen_table_column` 的建表、约束/注释/索引与数据。
- 同步清理源脚本 `script/sql/ry_vue.sql`、`postgres/postgres_ry_vue.sql`、`oracle/oracle_ry_vue.sql`、`sqlserver/sqlserver_ry_vue.sql`。
- 代码生成模块（note-gen）此前已移除，后端无相关 Java 引用。
- 已重新打包，jar 内 V1 的 `gen_table` 计数为 0。

注意：若某环境已执行过旧版 V1，修改 V1 会改变 Flyway 校验和，需要重建库（或 flyway repair 后重新 baseline），否则启动会报 checksum 不一致。


## 二十二、修复删除 gen_table 时误删 sys_oss 建表（2026-11-06）

**现象**：V1 迁移报 `Table 'v5notes2-dev.sys_oss_config' doesn't exist`（V1 第 686 行）。

**原因**：先前用正则删除 `gen_table`/`gen_table_column` 建表块时，终止符写成了 `);`；但 MySQL 建表实际以 `) engine=innodb ...;` 结尾（括号后不是分号），导致正则从 gen_table 一直匹配到后方第一个 `);`，**误删了 `sys_oss` 与 `sys_oss_config` 的建表**。

**修复**：从原始 6.1.0 备份恢复 MySQL V1，重新只删除 `test_demo/test_tree/gen_table/gen_table_column` 建表块（终止符按 `^) ENGINE = InnoDB ...;` 匹配）与已删模块菜单，保留 `sys_oss`、`sys_oss_config`。已同步 `script/sql/ry_vue.sql`，并重新打包。

**验证**：MySQL V1 建表数 24→20（仅少 test_demo/test_tree/gen_table/gen_table_column），`sys_oss`/`sys_oss_config` 各 1；jar 内 V1 test/gen 计数 0。PostgreSQL 及其它方言此前未受影响。

**恢复**：重建开发库后重启（同前）：
```sql
DROP DATABASE IF EXISTS `v5notes2-dev`;
CREATE DATABASE `v5notes2-dev` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```


## 二十三、RSA 密钥升级到 2048 位（2026-11-06）

**现象**：启动报 `RSA公钥格式错误或密钥长度低于1024位` / `RSA密钥长度不能低于1024位，当前为512位`。

**原因**：6.1.0 的 `EncryptUtils` 强制 RSA ≥ 1024 位；之前为兼容 client2 复用了旧 v5notes 的 **512 位**密钥。

**修复**：生成 2048 位 RSA 密钥对（X.509 公钥 / PKCS#8 私钥，Base64 DER），并统一替换：
- 后端 `application.yml` 的 `api-decrypt.publicKey/privateKey`
- `v5notes-admin2/.env.development`、`.env.production` 的 `VITE_APP_RSA_PUBLIC_KEY/PRIVATE_KEY`
- `v5notes-client2` 的 `defaultLoginKey`（登录/刷新请求加密公钥）

三处必须使用同一对密钥。已重新打包后端与两个客户端（均构建成功）。

**恢复**：因上次 V1 仍然失败，需再次重建开发库后重启（同前）：
```sql
DROP DATABASE IF EXISTS `v5notes2-dev`;
CREATE DATABASE `v5notes2-dev` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```


## 二十四、管理端恢复“用户类型”设置（2026-11-06）

迁移 plus-ui v6 时丢失了旧 v5notes-admin 用户表单里的“用户类型”下拉。已恢复：

- `v5notes-admin2/src/views/system/user/index.vue`：新增/编辑表单增加「用户类型」下拉，绑定 `user_type` 字典（`sys_user` / `cli_user`），默认 `sys_user`，必填校验；通过 `useDict('user_type')` 加载。
- `v5notes-admin2/src/api/system/user/types.ts`：`UserForm` 增加 `userType` 字段。
- 后端无需改动：`SysUserBo.userType` 已在新增/修改接口链路中传递并落库。

现在可以在管理端新建/编辑客户端用户（选择“客户端用户”即 `cli_user`）。验证：`pnpm build` → EXIT 0。


## 二十五、用户新增/编辑改为侧滑抽屉（方向 C，2026-11-06）

- 新增共享组件 [FormDrawer](v5notes-admin2/src/components/FormDrawer/index.vue)：680px 抽屉外壳，统一标题/关闭、滚动内容区、底部取消/保存与提示；支持 `#hero` 自定义身份头。
- [用户管理页](v5notes-admin2/src/views/system/user/index.vue)：新增/编辑弹窗改为 `FormDrawer`；顶部深绿成员身份头（头像、昵称、用户类型、部门），表单改为标签在上、分「基本信息 / 组织与身份 / 角色与岗位 / 备注」，与 `user/view.vue` 详情抽屉同 680px。
- 用户类型 `userType` 字段继续保留；导入、重置密码、确认等轻操作仍用弹窗，符合“复杂编辑走抽屉、轻操作走弹窗”的规则。
- 验证：`pnpm build` EXIT 0；`oxlint` 0 warnings 0 errors。
- 后续：按同一 FormDrawer 规范逐步迁移角色、菜单、部门、客户端等复杂编辑表单，短表单不迁移。


## 二十六、文件管理/配置管理对齐 v5notes（2026-11-06）

对比旧 v5notes 后修正了 v5notes2 与旧版不一致的实质问题：

- **上传落库对齐**：`FileUpload`、`ImageUpload` 改回旧版逻辑——上传到 `/basics/admin/file/upload`，使用 `@/api/basics/file` 的 `listByIds/delFile`，不再走 `/resource/oss/upload` 和 `sys_oss`。这样上传文件会出现在「文件管理」列表并可通过其删除。
- **配置管理路由**：补回旧版隐藏路由 `/basics/file-config`（`views/basics/file/config.vue`），「配置管理」按钮不再 404。
- **图片预览**：恢复文件列表缩略图的 `preview-src-list`，可点击预览。
- **重复菜单**：删除 RuoYi 6.1.0 模板自带的 OSS「文件管理 / 文件配置管理」菜单及按钮（V3 迁移 + 旧初始化脚本），侧边栏只保留 basics 文件管理。
- **预览开关配置键**：对齐旧版 `sys.file.previewListResource`（原模板为 `sys.oss.previewListResource`），V3 同时做存量数据更新。
- **清理模板页面**：删除 admin2 未使用的 `views/system/oss`、`api/system/ossConfig`；`api/system/oss` 仍保留给编辑器/头像等旧逻辑使用。
- 说明：之前若已通过系统 OSS 上传过文件，它们不会出现在 basics 文件管理列表中；之后新上传会走 basics_file。


## 二十七、修复本地上传目录不存在（2026-11-06）

**现象**：上传报 `IOException: No such file or directory`，`LocalFileClient.upload` 写入 `/mnt/uploadfile` 失败（macOS 无 `/mnt`）。

**修复**：
- `LocalFileClient.upload` 写入前自动创建父目录。
- `LocalFileClient.doInit` 支持 `__USER_HOME__` / `${user.home}` / `${user.dir}` 占位符。
- 直接修改 V2（MySQL/PostgreSQL）与 `script/sql/notes2.sql` 的默认 `basePath` 为 `__USER_HOME__/v5notes/upload`，未新增 V4 迁移。
- 已有数据库可执行：`UPDATE basics_file_config SET config = REPLACE(config, '/mnt/uploadfile', '__USER_HOME__/v5notes/upload') WHERE storage = 100 AND config LIKE '%/mnt/uploadfile%';`

重启后默认文件会写入当前系统用户目录下的 `v5notes/upload`；生产环境如仍要 `/mnt/uploadfile`，在「配置管理」改回并确保目录存在即可。
