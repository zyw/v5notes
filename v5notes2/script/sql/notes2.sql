-- =============================================================================
-- v5notes2 业务脚本：云笔记 + 基础文件模块（适配 RuoYi-Vue-Plus 6.1.0 表结构）
-- -----------------------------------------------------------------------------
-- 执行前置：已导入 script/sql/ry_vue.sql（6.1.0 初始化脚本）
-- 执行顺序：ry_vue.sql -> ry_job.sql(可选) -> note2.sql(本脚本，位于 script/sql/notes2.sql)
--
-- 与 5.2.2 的差异（重要）：
--   1. 6.1.0 已移除多租户：所有表**不含 tenant_id 列**；
--   2. sys_menu 新增 query_param / active_menu / ext 列，故全部使用**显式列名**插入；
--   3. sys_dict_type / sys_dict_data 无 tenant_id 列；
--   4. sys_client 新增 access_path / ip_whitelist 列，同样使用显式列名；
--   5. create_by / update_by 在 6.1.0 为 bigint（用户ID），不再写字符串。
-- =============================================================================
SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- 1、云笔记业务表
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS note_directory;
CREATE TABLE note_directory
(
    id          bigint(20)   NOT NULL COMMENT 'ID',
    user_id     bigint(20)   NOT NULL COMMENT '目录所属用户ID',
    dept_id     bigint(20)   NOT NULL DEFAULT 0 COMMENT '所属部门ID',
    name        varchar(100) NOT NULL COMMENT '目录名称',
    pid         bigint(20)   NOT NULL DEFAULT 0 COMMENT '父目录ID',
    del_flag    char(1)      NOT NULL DEFAULT '0' COMMENT '删除标志（0代表存在 2代表删除）',
    descr       varchar(255)          DEFAULT NULL COMMENT '描述',
    create_dept bigint(20)            DEFAULT NULL COMMENT '创建部门',
    create_by   bigint(20)            DEFAULT NULL COMMENT '创建者',
    create_time datetime              DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by   bigint(20)            DEFAULT NULL COMMENT '更新者',
    update_time datetime              DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_note_directory_user (user_id),
    KEY idx_note_directory_pid (pid)
) ENGINE = InnoDB COMMENT = '目录表';

DROP TABLE IF EXISTS note_notes;
CREATE TABLE note_notes
(
    id          bigint(20)   NOT NULL COMMENT '笔记ID编号',
    user_id     bigint(20)   NOT NULL COMMENT '笔记所属用户',
    dept_id     bigint(20)   NOT NULL DEFAULT 0 COMMENT '所属部门ID',
    name        varchar(100) NOT NULL COMMENT '笔记名',
    dir_id      bigint(20)   NOT NULL DEFAULT 0 COMMENT '所属目录ID',
    content     mediumtext COMMENT '笔记内容',
    del_flag    char(1)               DEFAULT '0' COMMENT '删除标志（0代表存在 2代表删除）',
    create_dept bigint(20)            DEFAULT NULL COMMENT '创建部门',
    create_by   bigint(20)            DEFAULT NULL COMMENT '创建者',
    create_time datetime              DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by   bigint(20)            DEFAULT NULL COMMENT '更新者',
    update_time datetime              DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_note_notes_user (user_id),
    KEY idx_note_notes_dir (dir_id),
    KEY idx_note_notes_update_time (update_time)
) ENGINE = InnoDB COMMENT = '笔记表';

-- -----------------------------------------------------------------------------
-- 2、基础文件模块业务表（替代 6.1.0 的 OSS，保留旧 /basics/base/file 端点）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS basics_file_config;
CREATE TABLE basics_file_config
(
    id          bigint(20)    NOT NULL COMMENT '编号',
    name        varchar(63)   NOT NULL COMMENT '配置名',
    storage     tinyint       NOT NULL COMMENT '存储器(100本地 101数据库 102FTP 103SFTP 104S3)',
    remark      varchar(255)           DEFAULT NULL COMMENT '备注',
    master      bit(1)        NOT NULL COMMENT '是否为主配置',
    config      varchar(4096) NOT NULL COMMENT '存储配置(JSON)',
    del_flag    char(1)                DEFAULT '0' COMMENT '删除标志（0代表存在 2代表删除）',
    create_dept bigint(20)             DEFAULT NULL COMMENT '创建部门',
    create_by   bigint(20)             DEFAULT NULL COMMENT '创建者',
    create_time datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by   bigint(20)             DEFAULT NULL COMMENT '更新者',
    update_time datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id)
) ENGINE = InnoDB COMMENT = '文件配置表';

DROP TABLE IF EXISTS basics_file;
CREATE TABLE basics_file
(
    id          bigint(20)    NOT NULL COMMENT '文件编号',
    config_id   bigint(20)             DEFAULT NULL COMMENT '配置编号',
    name        varchar(256)           DEFAULT NULL COMMENT '文件名',
    path        varchar(512)  NOT NULL COMMENT '文件路径',
    url         varchar(1024) NOT NULL COMMENT '文件 URL',
    type        varchar(128)           DEFAULT NULL COMMENT '文件类型',
    size        int           NOT NULL COMMENT '文件大小',
    del_flag    char(1)                DEFAULT '0' COMMENT '删除标志（0代表存在 2代表删除）',
    create_dept bigint(20)             DEFAULT NULL COMMENT '创建部门',
    create_by   bigint(20)             DEFAULT NULL COMMENT '创建者',
    create_time datetime      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by   bigint(20)             DEFAULT NULL COMMENT '更新者',
    update_time datetime      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_basics_file_config (config_id),
    KEY idx_basics_file_path (path)
) ENGINE = InnoDB COMMENT = '文件路径表';

DROP TABLE IF EXISTS basics_file_content;
CREATE TABLE basics_file_content
(
    id          bigint(20)   NOT NULL COMMENT '编号',
    config_id   bigint(20)   NOT NULL COMMENT '配置编号',
    path        varchar(512) NOT NULL COMMENT '文件路径',
    content     mediumblob   NOT NULL COMMENT '文件内容',
    del_flag    char(1)               DEFAULT '0' COMMENT '删除标志（0代表存在 2代表删除）',
    create_dept bigint(20)            DEFAULT NULL COMMENT '创建部门',
    create_by   bigint(20)            DEFAULT NULL COMMENT '创建者',
    create_time datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_by   bigint(20)            DEFAULT NULL COMMENT '更新者',
    update_time datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_basics_file_content_cfg (config_id),
    KEY idx_basics_file_content_path (path)
) ENGINE = InnoDB COMMENT = '文件内容表';

-- -----------------------------------------------------------------------------
-- 3、菜单（显式列名，兼容 6.1.0 的 query_param / active_menu / ext）
--    菜单ID沿用旧库段位，避免与 6.1.0 种子菜单(1761400xxx...)冲突
-- -----------------------------------------------------------------------------
DELETE FROM sys_role_menu WHERE menu_id IN (7, 118, 1600, 1601, 1602, 1603, 1604, 1620, 1621, 1622, 1623, 1624,
    1849657039948210177, 1849657039948210178, 1849657039948210179, 1849657039948210180, 1849657039948210181, 1849657039948210182,
    1849657043265904642, 1849657043265904643, 1849657043265904644, 1849657043265904645, 1849657043265904646, 1849657043265904647);
DELETE FROM sys_menu WHERE menu_id IN (7, 118, 1600, 1601, 1602, 1603, 1604, 1620, 1621, 1622, 1623, 1624,
    1849657039948210177, 1849657039948210178, 1849657039948210179, 1849657039948210180, 1849657039948210181, 1849657039948210182,
    1849657043265904642, 1849657043265904643, 1849657043265904644, 1849657043265904645, 1849657043265904646, 1849657043265904647);

-- 3.1 云笔记一级菜单
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (7, '云笔记', 0, 6, 'notes', NULL, '', 'N', 'Y', 'M', '0', '0', '', 'log', '', '',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, '云笔记');

-- 3.2 目录管理（权限 notes:directory:*）
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657039948210177, '目录管理', 7, 1, 'directory', 'notes/directory/index', '', 'N', 'Y', 'C', '0', '0',
        'notes:directory:list', 'tab', '', '', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, '目录菜单');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657039948210178, '目录查询', 1849657039948210177, 1, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:directory:query', '#', '', '', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1849657039948210179, '目录新增', 1849657039948210177, 2, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:directory:add', '#', '', '', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1849657039948210180, '目录修改', 1849657039948210177, 3, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:directory:edit', '#', '', '', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1849657039948210181, '目录删除', 1849657039948210177, 4, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:directory:remove', '#', '', '', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1849657039948210182, '目录导出', 1849657039948210177, 5, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:directory:export', '#', '', '', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, '');

-- 3.3 笔记管理（权限 notes:notes:*）
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265904642, '笔记管理', 7, 2, 'notes', 'notes/notes/index', '', 'N', 'Y', 'C', '0', '0',
        'notes:notes:list', 'finish', '', '', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, '笔记菜单');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265904643, '笔记查询', 1849657043265904642, 1, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:notes:query', '#', '', '', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1849657043265904644, '笔记新增', 1849657043265904642, 2, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:notes:add', '#', '', '', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1849657043265904645, '笔记修改', 1849657043265904642, 3, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:notes:edit', '#', '', '', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1849657043265904646, '笔记删除', 1849657043265904642, 4, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:notes:remove', '#', '', '', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1849657043265904647, '笔记导出', 1849657043265904642, 5, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:notes:export', '#', '', '', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, '');

-- 3.4 文件管理一级菜单（basics:file:*），挂到"系统管理"目录下
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (118, '文件管理', 1761400000000000001, 12, 'file', 'basics/file/index', '', 'N', 'Y', 'C', '0', '0',
        'basics:file:list', 'upload', '', '', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, '文件管理菜单');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1600, '文件查询', 118, 1, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:file:query', '#', '', '',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1601, '文件上传', 118, 2, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:file:upload', '#', '', '',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1602, '文件下载', 118, 3, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:file:download', '#', '', '',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1603, '文件删除', 118, 4, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:file:remove', '#', '', '',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1604, '文件列表', 118, 5, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:file:list', '#', '', '',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1605, '文件导出', 118, 6, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:file:export', '#', '', '',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, '');

-- 3.5 文件配置（权限 basics:fileConfig:*）
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1620, '配置列表', 118, 7, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:fileConfig:list', '#', '', '',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1621, '配置添加', 118, 8, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:fileConfig:add', '#', '', '',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1622, '配置编辑', 118, 9, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:fileConfig:edit', '#', '', '',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1623, '配置删除', 118, 10, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:fileConfig:remove', '#', '', '',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1624, '配置导出', 118, 11, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:fileConfig:export', '#', '', '',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, ''),
       (1625, '配置查询', 118, 12, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:fileConfig:query', '#', '', '',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, '');

-- 3.6 超管角色(role_id=1)默认拥有全部菜单
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT 1, menu_id
FROM sys_menu
WHERE menu_id IN (7, 118, 1600, 1601, 1602, 1603, 1604, 1605, 1620, 1621, 1622, 1623, 1624, 1625,
                  1849657039948210177, 1849657039948210178, 1849657039948210179, 1849657039948210180, 1849657039948210181, 1849657039948210182,
                  1849657043265904642, 1849657043265904643, 1849657043265904644, 1849657043265904645, 1849657043265904646, 1849657043265904647)
  AND NOT EXISTS (SELECT 1
                  FROM sys_role_menu rm
                  WHERE rm.role_id = 1
                    AND rm.menu_id = sys_menu.menu_id);

-- -----------------------------------------------------------------------------
-- 4、字典（6.1.0 的 sys_dict_type / sys_dict_data 无 tenant_id 列）
-- -----------------------------------------------------------------------------
DELETE FROM sys_dict_data
WHERE dict_type IN ('user_type', 'basics_file_storage')
   OR (dict_type = 'sys_grant_type' AND dict_value = 'clientPassword')
   OR (dict_type = 'sys_device_type' AND dict_value = 'pc_client');
DELETE FROM sys_dict_type WHERE dict_type IN ('user_type', 'basics_file_storage');

-- 4.1 用户类型 user_type：sys_user / cli_user
INSERT INTO sys_dict_type (dict_id, dict_name, dict_type, create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1851976902360236033, '用户类型', 'user_type', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL,
        'pc管理端用户、客户端用户');

INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default,
                           create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1851977152646938626, 0, 'PC管理端用户', 'sys_user', 'user_type', '', 'default', 'N',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, 'PC管理端用户'),
       (1851977265763123201, 1, '客户端用户', 'cli_user', 'user_type', '', 'default', 'N',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, '此用户可以是PC客户端、APP客户端、小程序客户端等');

-- 4.2 文件存储器 basics_file_storage：本地磁盘/数据库/FTP/SFTP/S3
INSERT INTO sys_dict_type (dict_id, dict_name, dict_type, create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (113, '文件存储器', 'basics_file_storage', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL,
        '文件存储器');

INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default,
                           create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (139, 1, '本地磁盘', '100', 'basics_file_storage', '', '', 'Y', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, '本地磁盘'),
       (140, 2, '数据库', '101', 'basics_file_storage', '', '', 'N', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, '数据库'),
       (141, 3, 'FTP服务器', '102', 'basics_file_storage', '', '', 'N', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, 'FTP 服务器'),
       (142, 4, 'SFTP服务器', '103', 'basics_file_storage', '', '', 'N', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, 'SFTP 服务器'),
       (143, 5, 'S3对象存储', '104', 'basics_file_storage', '', '', 'N', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, 'S3 对象存储');

-- 4.3 补充授权类型 / 设备类型字典项（客户端登录需要 clientPassword、pc_client）
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default,
                           create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1851901153796288514, 0, '客户端密码认证', 'clientPassword', 'sys_grant_type', 'el-check-tag', 'default', 'N',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, '客户端密码认证'),
       (1851635425633472514, 5, 'PC客户端', 'pc_client', 'sys_device_type', '', 'default', 'N',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, 'PC客户端');

-- -----------------------------------------------------------------------------
-- 5、sys_client（显式列名，含 6.1.0 新增的 access_path / ip_whitelist）
-- -----------------------------------------------------------------------------
-- 5.1 云笔记客户端（clientPassword / pc_client）：v5notes-client2 与旧 Electron 客户端使用
DELETE FROM sys_client WHERE client_id IN ('d9df3c0228c05e5c61db46348bcadf6e', 'e5cd7e4891bf95d1d19206ce24a7b32e');
INSERT INTO sys_client (id, client_id, client_key, client_secret, grant_type, device_type, access_path, ip_whitelist,
                        active_timeout, timeout, status, del_flag, create_dept, create_by, create_time, update_by, update_time)
VALUES (1851635079091687426, 'd9df3c0228c05e5c61db46348bcadf6e', 'client', 'client123', 'clientPassword', 'pc_client',
        NULL, NULL, -1, 604800, '0', '0', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL);

-- 5.2 管理端 PC 客户端（password / pc）：plus-ui v6 管理后台使用
INSERT INTO sys_client (id, client_id, client_key, client_secret, grant_type, device_type, access_path, ip_whitelist,
                        active_timeout, timeout, status, del_flag, create_dept, create_by, create_time, update_by, update_time)
VALUES (1762000000000000001, 'e5cd7e4891bf95d1d19206ce24a7b32e', 'pc', 'pc123', 'password,social', 'pc',
        NULL, NULL, 1800, 604800, '0', '0', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL);

-- -----------------------------------------------------------------------------
-- 6、文件存储主配置（本地磁盘，storage=100）
--    说明：config 的 @class 必须指向 xin.v5ai.basics.file.core.client.local.LocalFileClientConfig；
--          domain 需要替换为实际部署域名；basePath 使用 __USER_HOME__/v5notes/upload，由 LocalFileClient 解析为当前用户目录。
-- -----------------------------------------------------------------------------
DELETE FROM basics_file_config WHERE id = 1;
INSERT INTO basics_file_config (id, name, storage, remark, master, config, del_flag, create_dept, create_by, create_time, update_by, update_time)
VALUES (1, '本地磁盘', 100, '默认本地磁盘存储',
        b'1',
        '{"@class":"xin.v5ai.basics.file.core.client.local.LocalFileClientConfig","basePath":"__USER_HOME__/v5notes/upload","domain":"http://127.0.0.1:8080"}',
        '0', 1761000000000000103, 1761100000000000001, sysdate(), NULL, sysdate());

-- -----------------------------------------------------------------------------
-- 7、校验（人工核对）
-- -----------------------------------------------------------------------------
-- SELECT COUNT(*) FROM note_notes;
-- SELECT COUNT(*) FROM note_directory;
-- SELECT menu_id, menu_name, perms FROM sys_menu WHERE menu_id IN (7,118,1600,1849657039948210177,1849657043265904642);
-- SELECT client_id, grant_type, device_type FROM sys_client WHERE client_id IN ('d9df3c0228c05e5c61db46348bcadf6e','e5cd7e4891bf95d1d19206ce24a7b32e');

-- -----------------------------------------------------------------------------
-- 8、文档管理（沿用旧 v5notes 文档管理页面：basics 文件库）
-- -----------------------------------------------------------------------------
DELETE FROM sys_role_menu WHERE menu_id = 8;
DELETE FROM sys_menu WHERE menu_id = 8;
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (8, '文档管理', 0, 7, 'docs', 'docs/index', '', 'N', 'Y', 'C', '0', '0', '', 'log', '', '',
        1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, '文档管理');
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT 1, 8 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sys_role_menu rm WHERE rm.role_id = 1 AND rm.menu_id = 8);

-- -----------------------------------------------------------------------------
-- 9、首页聚合统计接口权限（notes:dashboard:query）
--    GET /notes/dashboard/overview 带 @SaCheckPermission("notes:dashboard:query")，
--    没有这条 F 类型权限记录时，除超管外所有角色打开首页都会 403。
--    默认授予所有现存角色；要收紧时删掉 sys_role_menu 里对应行即可。
-- -----------------------------------------------------------------------------
DELETE FROM sys_role_menu WHERE menu_id = 1849657043265904648;
DELETE FROM sys_menu WHERE menu_id = 1849657043265904648;
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265904648, '首页统计', 7, 0, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:dashboard:query', '#', '', '', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL, '首页聚合统计接口权限');
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT role_id, 1849657043265904648 FROM sys_role WHERE del_flag = '0';
