-- 存储类型字典
INSERT INTO `sys_dict_type` (`dict_id`,`tenant_id`,`dict_name`,`dict_type`,`create_dept`,`create_by`,`create_time`,`update_by`,`update_time`,`remark`)VALUES
    (113,'000000','文件存储器','basics_file_storage',103,1,'2024-04-02 00:28:25',NULL,NULL,'文件存储器');

-- 字典数据
INSERT INTO `sys_dict_data` ( `dict_code`, `tenant_id`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark` )
VALUES ( 139, '000000', 1, '本地磁盘', '100', 'basics_file_storage', '', '', 'Y', 103, 1, '2024-04-02 00:28:25', NULL, NULL, '本地磁盘' );

INSERT INTO `sys_dict_data` ( `dict_code`, `tenant_id`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark` )
VALUES ( 140, '000000', 2, '数据库', '101', 'basics_file_storage', '', '', 'N', 103, 1, '2024-04-02 00:28:25', NULL, NULL, '数据库' );

INSERT INTO `sys_dict_data` ( `dict_code`, `tenant_id`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark` )
VALUES ( 141, '000000', 3, 'FTP服务器', '102', 'basics_file_storage', '', '', 'N', 103, 1, '2024-04-02 00:28:25', NULL, NULL, 'FTP 服务器' );

INSERT INTO `sys_dict_data` ( `dict_code`, `tenant_id`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark` )
VALUES ( 142, '000000', 4, 'SFTP服务器', '103', 'basics_file_storage', '', '', 'N', 103, 1, '2024-04-02 00:28:25', NULL, NULL, 'SFTP 服务器' );

INSERT INTO `sys_dict_data` ( `dict_code`, `tenant_id`, `dict_sort`, `dict_label`, `dict_value`, `dict_type`, `css_class`, `list_class`, `is_default`, `create_dept`, `create_by`, `create_time`, `update_by`, `update_time`, `remark` )
VALUES ( 143, '000000', 5, 'S3对象存储', '104', 'basics_file_storage', '', '', 'N', 103, 1, '2024-04-02 00:28:25', NULL, NULL, 'S3 对象存储' );


-- 文件管理菜单
insert into sys_menu values('118',  '文件管理',     '1',   '10', 'file',              'basics/file/index',            '', 1, 0, 'C', '0', '0', 'basics:file:list',              'upload',        103, 1, sysdate(), null, null, '文件管理菜单');

-- 文件管理相关按钮
insert into sys_menu values('1600', '文件查询', '118', '1', '#', '', '', 1, 0, 'F', '0', '0', 'basics:file:query',        '#', 103, 1, sysdate(), null, null, '');
insert into sys_menu values('1601', '文件上传', '118', '2', '#', '', '', 1, 0, 'F', '0', '0', 'basics:file:upload',       '#', 103, 1, sysdate(), null, null, '');
insert into sys_menu values('1602', '文件下载', '118', '3', '#', '', '', 1, 0, 'F', '0', '0', 'basics:file:download',     '#', 103, 1, sysdate(), null, null, '');
insert into sys_menu values('1603', '文件删除', '118', '4', '#', '', '', 1, 0, 'F', '0', '0', 'basics:file:remove',       '#', 103, 1, sysdate(), null, null, '');

insert into sys_menu values('1604', '文件删除', '118', '4', '#', '', '', 1, 0, 'F', '0', '0', 'basics:file:list',       '#', 103, 1, sysdate(), null, null, '');

insert into sys_menu values('1620', '配置列表', '118', '5', '#', '', '', 1, 0, 'F', '0', '0', 'basics:fileConfig:list',        '#', 103, 1, sysdate(), null, null, '');
insert into sys_menu values('1621', '配置添加', '118', '6', '#', '', '', 1, 0, 'F', '0', '0', 'basics:fileConfig:add',         '#', 103, 1, sysdate(), null, null, '');
insert into sys_menu values('1622', '配置编辑', '118', '6', '#', '', '', 1, 0, 'F', '0', '0', 'basics:fileConfig:edit',        '#', 103, 1, sysdate(), null, null, '');
insert into sys_menu values('1623', '配置删除', '118', '6', '#', '', '', 1, 0, 'F', '0', '0', 'basics:fileConfig:remove',      '#', 103, 1, sysdate(), null, null, '');


insert into sys_menu values('1624', '配置导出', '118', '6', '#', '', '', 1, 0, 'F', '0', '0', 'basics:fileConfig:export',      '#', 103, 1, sysdate(), null, null, '');


DROP TABLE IF EXISTS `basics_file_config`;
CREATE TABLE `basics_file_config` (
     `id`                                     bigint(20)     NOT NULL                                    COMMENT '编号',
     `tenant_id`      varchar(20)         DEFAULT '000000'                                                COMMENT '租户编号',
     `name`                                   varchar(63)    NOT NULL                                    COMMENT '配置名',
     `storage`                                tinyint        NOT NULL                                    COMMENT '存储器',
     `remark`                                 varchar(255)   DEFAULT NULL                                COMMENT '备注',
     `master`                                 bit(1)         NOT NULL                                    COMMENT '是否为主配置',
     `config`                                 varchar(4096)  NOT NULL                                    COMMENT '存储配置',
     `del_flag`                               char(1)                     default '0'                                 comment '删除标志（0代表存在 2代表删除）',
     `create_dept`                            bigint(20)                  default null                                COMMENT '创建部门',
     `create_by`                              varchar(64)                 NULL DEFAULT NULL                           COMMENT '创建者',
     `create_time`                            datetime                    NOT NULL DEFAULT CURRENT_TIMESTAMP          COMMENT '创建时间',
     `update_by`                              varchar(64)                 NULL DEFAULT NULL                           COMMENT '更新者',
     `update_time`                            datetime                    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
     PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB COMMENT='文件配置表';

DROP TABLE IF EXISTS `basics_file`;
CREATE TABLE `basics_file` (
  `id`                                      bigint(20)        NOT NULL                                              COMMENT '文件编号',
  `tenant_id`      varchar(20)         DEFAULT '000000'                                                COMMENT '租户编号',
  `config_id`                               bigint(20)        DEFAULT NULL                                          COMMENT '配置编号',
  `name`                                    varchar(256)      DEFAULT NULL                                          COMMENT '文件名',
  `path`                                    varchar(512)      NOT NULL                                              COMMENT '文件路径',
  `url`                                     varchar(1024)     NOT NULL                                              COMMENT '文件 URL',
  `type`                                    varchar(128)      DEFAULT NULL                                          COMMENT '文件类型',
  `size`                                    int               NOT NULL                                              COMMENT '文件大小',
  `del_flag`                                char(1)                     default '0'                                 comment '删除标志（0代表存在 2代表删除）',
  `create_dept`                             bigint(20)                  default null                                COMMENT '创建部门',
  `create_by`                               varchar(64)                 NULL DEFAULT NULL                           COMMENT '创建者',
  `create_time`                             datetime                    NOT NULL DEFAULT CURRENT_TIMESTAMP          COMMENT '创建时间',
  `update_by`                               varchar(64)                 NULL DEFAULT NULL                           COMMENT '更新者',
  `update_time`                             datetime                    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB COMMENT='文件路径表';


DROP TABLE IF EXISTS `basics_file_content`;
CREATE TABLE `basics_file_content` (
  `id`                                      bigint(20) NOT NULL                                                     COMMENT '编号',
  `tenant_id`      varchar(20)         DEFAULT '000000'                                                COMMENT '租户编号',
  `config_id`                               bigint(20) NOT NULL                                                     COMMENT '配置编号',
  `path`                                    varchar(512) NOT NULL                                                   COMMENT '文件路径',
  `content`                                 mediumblob NOT NULL                                                     COMMENT '文件内容',
  `del_flag`                                char(1)                     default '0'                                 comment '删除标志（0代表存在 2代表删除）',
  `create_dept`                             bigint(20)                  default null                                COMMENT '创建部门',
  `create_by`                               varchar(64)                 NULL DEFAULT NULL                           COMMENT '创建者',
  `create_time`                             datetime                    NOT NULL DEFAULT CURRENT_TIMESTAMP          COMMENT '创建时间',
  `update_by`                               varchar(64)                 NULL DEFAULT NULL                           COMMENT '更新者',
  `update_time`                             datetime                    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB COMMENT='文件内容表';
