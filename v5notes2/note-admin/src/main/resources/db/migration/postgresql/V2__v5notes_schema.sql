-- =============================================================================
-- v5notes2 业务脚本（Flyway V2 · PostgreSQL 方言，由 script/sql/notes2.sql 转换而来）
-- -----------------------------------------------------------------------------
-- 执行前置：V1__base_schema.sql 已创建 RuoYi-Vue-Plus 6.1.0 基础表
-- 内容：笔记/文件表、菜单、字典、sys_client、basics_file_config
--
-- PostgreSQL 转换要点：
--   mediumtext -> text、mediumblob -> bytea、bit(1) -> boolean、
--   去掉 ENGINE 子句、sysdate() -> CURRENT_TIMESTAMP / now()、
--   b'1' -> true、去掉 ON UPDATE CURRENT_TIMESTAMP（改为普通 default now()）、
--   内联 KEY 索引改为独立 CREATE INDEX、内联 COMMENT 改为 COMMENT ON。
-- =============================================================================
-- -----------------------------------------------------------------------------
-- 1、云笔记业务表
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS note_directory;
CREATE TABLE note_directory
(
    id          bigint       NOT NULL,
    user_id     bigint       NOT NULL,
    dept_id     bigint       NOT NULL DEFAULT 0,
    name        varchar(100) NOT NULL,
    pid         bigint       NOT NULL DEFAULT 0,
    del_flag    char(1)      NOT NULL DEFAULT '0',
    descr       varchar(255)          DEFAULT NULL,
    create_dept bigint                DEFAULT NULL,
    create_by   bigint                DEFAULT NULL,
    create_time timestamp             DEFAULT CURRENT_TIMESTAMP,
    update_by   bigint                DEFAULT NULL,
    update_time timestamp             DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);
CREATE INDEX idx_note_directory_user ON note_directory (user_id);
CREATE INDEX idx_note_directory_pid ON note_directory (pid);
COMMENT ON TABLE note_directory IS '目录表';
COMMENT ON COLUMN note_directory.id          IS 'ID';
COMMENT ON COLUMN note_directory.user_id     IS '目录所属用户ID';
COMMENT ON COLUMN note_directory.dept_id     IS '所属部门ID';
COMMENT ON COLUMN note_directory.name        IS '目录名称';
COMMENT ON COLUMN note_directory.pid         IS '父目录ID';
COMMENT ON COLUMN note_directory.del_flag    IS '删除标志（0代表存在 2代表删除）';
COMMENT ON COLUMN note_directory.descr       IS '描述';
COMMENT ON COLUMN note_directory.create_dept IS '创建部门';
COMMENT ON COLUMN note_directory.create_by   IS '创建者';
COMMENT ON COLUMN note_directory.create_time IS '创建时间';
COMMENT ON COLUMN note_directory.update_by   IS '更新者';
COMMENT ON COLUMN note_directory.update_time IS '更新时间';

DROP TABLE IF EXISTS note_notes;
CREATE TABLE note_notes
(
    id          bigint       NOT NULL,
    user_id     bigint       NOT NULL,
    dept_id     bigint       NOT NULL DEFAULT 0,
    name        varchar(100) NOT NULL,
    dir_id      bigint       NOT NULL DEFAULT 0,
    content     text,
    del_flag    char(1)               DEFAULT '0',
    create_dept bigint                DEFAULT NULL,
    create_by   bigint                DEFAULT NULL,
    create_time timestamp             DEFAULT CURRENT_TIMESTAMP,
    update_by   bigint                DEFAULT NULL,
    update_time timestamp             DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);
CREATE INDEX idx_note_notes_user ON note_notes (user_id);
CREATE INDEX idx_note_notes_dir ON note_notes (dir_id);
CREATE INDEX idx_note_notes_update_time ON note_notes (update_time);
COMMENT ON TABLE note_notes IS '笔记表';
COMMENT ON COLUMN note_notes.id          IS '笔记ID编号';
COMMENT ON COLUMN note_notes.user_id     IS '笔记所属用户';
COMMENT ON COLUMN note_notes.dept_id     IS '所属部门ID';
COMMENT ON COLUMN note_notes.name        IS '笔记名';
COMMENT ON COLUMN note_notes.dir_id      IS '所属目录ID';
COMMENT ON COLUMN note_notes.content     IS '笔记内容';
COMMENT ON COLUMN note_notes.del_flag    IS '删除标志（0代表存在 2代表删除）';
COMMENT ON COLUMN note_notes.create_dept IS '创建部门';
COMMENT ON COLUMN note_notes.create_by   IS '创建者';
COMMENT ON COLUMN note_notes.create_time IS '创建时间';
COMMENT ON COLUMN note_notes.update_by   IS '更新者';
COMMENT ON COLUMN note_notes.update_time IS '更新时间';

-- -----------------------------------------------------------------------------
-- 2、基础文件模块业务表（替代 6.1.0 的 OSS，保留旧 /basics/base/file 端点）
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS basics_file_config;
CREATE TABLE basics_file_config
(
    id          bigint        NOT NULL,
    name        varchar(63)   NOT NULL,
    storage     smallint      NOT NULL,
    remark      varchar(255)           DEFAULT NULL,
    master      boolean       NOT NULL,
    config      varchar(4096) NOT NULL,
    del_flag    char(1)                DEFAULT '0',
    create_dept bigint                 DEFAULT NULL,
    create_by   bigint                 DEFAULT NULL,
    create_time timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_by   bigint                 DEFAULT NULL,
    update_time timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);
COMMENT ON TABLE basics_file_config IS '文件配置表';
COMMENT ON COLUMN basics_file_config.id          IS '编号';
COMMENT ON COLUMN basics_file_config.name        IS '配置名';
COMMENT ON COLUMN basics_file_config.storage     IS '存储器(100本地 101数据库 102FTP 103SFTP 104S3)';
COMMENT ON COLUMN basics_file_config.remark      IS '备注';
COMMENT ON COLUMN basics_file_config.master      IS '是否为主配置';
COMMENT ON COLUMN basics_file_config.config      IS '存储配置(JSON)';
COMMENT ON COLUMN basics_file_config.del_flag    IS '删除标志（0代表存在 2代表删除）';
COMMENT ON COLUMN basics_file_config.create_dept IS '创建部门';
COMMENT ON COLUMN basics_file_config.create_by   IS '创建者';
COMMENT ON COLUMN basics_file_config.create_time IS '创建时间';
COMMENT ON COLUMN basics_file_config.update_by   IS '更新者';
COMMENT ON COLUMN basics_file_config.update_time IS '更新时间';

DROP TABLE IF EXISTS basics_file;
CREATE TABLE basics_file
(
    id          bigint        NOT NULL,
    config_id   bigint                 DEFAULT NULL,
    name        varchar(256)           DEFAULT NULL,
    path        varchar(512)  NOT NULL,
    url         varchar(1024) NOT NULL,
    type        varchar(128)           DEFAULT NULL,
    size        integer       NOT NULL,
    del_flag    char(1)                DEFAULT '0',
    create_dept bigint                 DEFAULT NULL,
    create_by   bigint                 DEFAULT NULL,
    create_time timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_by   bigint                 DEFAULT NULL,
    update_time timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);
CREATE INDEX idx_basics_file_config ON basics_file (config_id);
CREATE INDEX idx_basics_file_path ON basics_file (path);
COMMENT ON TABLE basics_file IS '文件路径表';
COMMENT ON COLUMN basics_file.id          IS '文件编号';
COMMENT ON COLUMN basics_file.config_id   IS '配置编号';
COMMENT ON COLUMN basics_file.name        IS '文件名';
COMMENT ON COLUMN basics_file.path        IS '文件路径';
COMMENT ON COLUMN basics_file.url         IS '文件 URL';
COMMENT ON COLUMN basics_file.type        IS '文件类型';
COMMENT ON COLUMN basics_file.size        IS '文件大小';
COMMENT ON COLUMN basics_file.del_flag    IS '删除标志（0代表存在 2代表删除）';
COMMENT ON COLUMN basics_file.create_dept IS '创建部门';
COMMENT ON COLUMN basics_file.create_by   IS '创建者';
COMMENT ON COLUMN basics_file.create_time IS '创建时间';
COMMENT ON COLUMN basics_file.update_by   IS '更新者';
COMMENT ON COLUMN basics_file.update_time IS '更新时间';

DROP TABLE IF EXISTS basics_file_content;
CREATE TABLE basics_file_content
(
    id          bigint       NOT NULL,
    config_id   bigint       NOT NULL,
    path        varchar(512) NOT NULL,
    content     bytea        NOT NULL,
    del_flag    char(1)               DEFAULT '0',
    create_dept bigint                DEFAULT NULL,
    create_by   bigint                DEFAULT NULL,
    create_time timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_by   bigint                DEFAULT NULL,
    update_time timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);
CREATE INDEX idx_basics_file_content_cfg ON basics_file_content (config_id);
CREATE INDEX idx_basics_file_content_path ON basics_file_content (path);
COMMENT ON TABLE basics_file_content IS '文件内容表';
COMMENT ON COLUMN basics_file_content.id          IS '编号';
COMMENT ON COLUMN basics_file_content.config_id   IS '配置编号';
COMMENT ON COLUMN basics_file_content.path        IS '文件路径';
COMMENT ON COLUMN basics_file_content.content     IS '文件内容';
COMMENT ON COLUMN basics_file_content.del_flag    IS '删除标志（0代表存在 2代表删除）';
COMMENT ON COLUMN basics_file_content.create_dept IS '创建部门';
COMMENT ON COLUMN basics_file_content.create_by   IS '创建者';
COMMENT ON COLUMN basics_file_content.create_time IS '创建时间';
COMMENT ON COLUMN basics_file_content.update_by   IS '更新者';
COMMENT ON COLUMN basics_file_content.update_time IS '更新时间';

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
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, '云笔记');

-- 3.2 目录管理（权限 notes:directory:*）
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657039948210177, '目录管理', 7, 1, 'directory', 'notes/directory/index', '', 'N', 'Y', 'C', '0', '0',
        'notes:directory:list', 'tab', '', '', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, '目录菜单');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657039948210178, '目录查询', 1849657039948210177, 1, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:directory:query', '#', '', '', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1849657039948210179, '目录新增', 1849657039948210177, 2, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:directory:add', '#', '', '', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1849657039948210180, '目录修改', 1849657039948210177, 3, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:directory:edit', '#', '', '', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1849657039948210181, '目录删除', 1849657039948210177, 4, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:directory:remove', '#', '', '', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1849657039948210182, '目录导出', 1849657039948210177, 5, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:directory:export', '#', '', '', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, '');

-- 3.3 笔记管理（权限 notes:notes:*）
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265904642, '笔记管理', 7, 2, 'notes', 'notes/notes/index', '', 'N', 'Y', 'C', '0', '0',
        'notes:notes:list', 'finish', '', '', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, '笔记菜单');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1849657043265904643, '笔记查询', 1849657043265904642, 1, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:notes:query', '#', '', '', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1849657043265904644, '笔记新增', 1849657043265904642, 2, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:notes:add', '#', '', '', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1849657043265904645, '笔记修改', 1849657043265904642, 3, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:notes:edit', '#', '', '', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1849657043265904646, '笔记删除', 1849657043265904642, 4, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:notes:remove', '#', '', '', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1849657043265904647, '笔记导出', 1849657043265904642, 5, '', '', '', 'N', 'Y', 'F', '0', '0',
        'notes:notes:export', '#', '', '', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, '');

-- 3.4 文件管理一级菜单（basics:file:*），挂到"系统管理"目录下
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (118, '文件管理', 1761400000000000001, 12, 'file', 'basics/file/index', '', 'N', 'Y', 'C', '0', '0',
        'basics:file:list', 'upload', '', '', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, '文件管理菜单');

INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1600, '文件查询', 118, 1, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:file:query', '#', '', '',
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1601, '文件上传', 118, 2, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:file:upload', '#', '', '',
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1602, '文件下载', 118, 3, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:file:download', '#', '', '',
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1603, '文件删除', 118, 4, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:file:remove', '#', '', '',
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1604, '文件列表', 118, 5, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:file:list', '#', '', '',
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1605, '文件导出', 118, 6, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:file:export', '#', '', '',
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, '');

-- 3.5 文件配置（权限 basics:fileConfig:*）
INSERT INTO sys_menu (menu_id, menu_name, parent_id, order_num, path, component, query_param, is_frame, is_cache,
                      menu_type, visible, status, perms, icon, active_menu, ext,
                      create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1620, '配置列表', 118, 7, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:fileConfig:list', '#', '', '',
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1621, '配置添加', 118, 8, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:fileConfig:add', '#', '', '',
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1622, '配置编辑', 118, 9, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:fileConfig:edit', '#', '', '',
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1623, '配置删除', 118, 10, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:fileConfig:remove', '#', '', '',
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1624, '配置导出', 118, 11, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:fileConfig:export', '#', '', '',
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, ''),
       (1625, '配置查询', 118, 12, '', '', '', 'N', 'Y', 'F', '0', '0', 'basics:fileConfig:query', '#', '', '',
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, '');

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
VALUES (1851976902360236033, '用户类型', 'user_type', 1761000000000000103, 1761100000000000001, now(), NULL, NULL,
        'pc管理端用户、客户端用户');

INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default,
                           create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1851977152646938626, 0, 'PC管理端用户', 'sys_user', 'user_type', '', 'default', 'N',
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, 'PC管理端用户'),
       (1851977265763123201, 1, '客户端用户', 'cli_user', 'user_type', '', 'default', 'N',
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, '此用户可以是PC客户端、APP客户端、小程序客户端等');

-- 4.2 文件存储器 basics_file_storage：本地磁盘/数据库/FTP/SFTP/S3
INSERT INTO sys_dict_type (dict_id, dict_name, dict_type, create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (113, '文件存储器', 'basics_file_storage', 1761000000000000103, 1761100000000000001, now(), NULL, NULL,
        '文件存储器');

INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default,
                           create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (139, 1, '本地磁盘', '100', 'basics_file_storage', '', '', 'Y', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, '本地磁盘'),
       (140, 2, '数据库', '101', 'basics_file_storage', '', '', 'N', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, '数据库'),
       (141, 3, 'FTP服务器', '102', 'basics_file_storage', '', '', 'N', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, 'FTP 服务器'),
       (142, 4, 'SFTP服务器', '103', 'basics_file_storage', '', '', 'N', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, 'SFTP 服务器'),
       (143, 5, 'S3对象存储', '104', 'basics_file_storage', '', '', 'N', 1761000000000000103, 1761100000000000001, now(), NULL, NULL, 'S3 对象存储');

-- 4.3 补充授权类型 / 设备类型字典项（客户端登录需要 clientPassword、pc_client）
INSERT INTO sys_dict_data (dict_code, dict_sort, dict_label, dict_value, dict_type, css_class, list_class, is_default,
                           create_dept, create_by, create_time, update_by, update_time, remark)
VALUES (1851901153796288514, 0, '客户端密码认证', 'clientPassword', 'sys_grant_type', 'el-check-tag', 'default', 'N',
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, '客户端密码认证'),
       (1851635425633472514, 5, 'PC客户端', 'pc_client', 'sys_device_type', '', 'default', 'N',
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, 'PC客户端');

-- -----------------------------------------------------------------------------
-- 5、sys_client（显式列名，含 6.1.0 新增的 access_path / ip_whitelist）
-- -----------------------------------------------------------------------------
-- 5.1 云笔记客户端（clientPassword / pc_client）：v5notes-client2 与旧 Electron 客户端使用
DELETE FROM sys_client WHERE client_id IN ('d9df3c0228c05e5c61db46348bcadf6e', 'e5cd7e4891bf95d1d19206ce24a7b32e');
INSERT INTO sys_client (id, client_id, client_key, client_secret, grant_type, device_type, access_path, ip_whitelist,
                        active_timeout, timeout, status, del_flag, create_dept, create_by, create_time, update_by, update_time)
VALUES (1851635079091687426, 'd9df3c0228c05e5c61db46348bcadf6e', 'client', 'client123', 'clientPassword', 'pc_client',
        NULL, NULL, -1, 604800, '0', '0', 1761000000000000103, 1761100000000000001, now(), NULL, NULL);

-- 5.2 管理端 PC 客户端（password / pc）：plus-ui v6 管理后台使用
INSERT INTO sys_client (id, client_id, client_key, client_secret, grant_type, device_type, access_path, ip_whitelist,
                        active_timeout, timeout, status, del_flag, create_dept, create_by, create_time, update_by, update_time)
VALUES (1762000000000000001, 'e5cd7e4891bf95d1d19206ce24a7b32e', 'pc', 'pc123', 'password,social', 'pc',
        NULL, NULL, 1800, 604800, '0', '0', 1761000000000000103, 1761100000000000001, now(), NULL, NULL);

-- -----------------------------------------------------------------------------
-- 6、文件存储主配置（本地磁盘，storage=100）
--    说明：config 的 @class 必须指向 xin.v5ai.basics.file.core.client.local.LocalFileClientConfig；
--          domain 需要替换为实际部署域名；basePath 与旧部署 /mnt/uploadfile 保持一致以便历史文件可访问。
-- -----------------------------------------------------------------------------
DELETE FROM basics_file_config WHERE id = 1;
INSERT INTO basics_file_config (id, name, storage, remark, master, config, del_flag, create_dept, create_by, create_time, update_by, update_time)
VALUES (1, '本地磁盘', 100, '默认本地磁盘存储',
        true,
        '{"@class":"xin.v5ai.basics.file.core.client.local.LocalFileClientConfig","basePath":"/mnt/uploadfile","domain":"http://127.0.0.1:8080"}',
        '0', 1761000000000000103, 1761100000000000001, now(), NULL, now());

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
        1761000000000000103, 1761100000000000001, now(), NULL, NULL, '文档管理');
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT 1, 8
WHERE NOT EXISTS (SELECT 1 FROM sys_role_menu rm WHERE rm.role_id = 1 AND rm.menu_id = 8);
