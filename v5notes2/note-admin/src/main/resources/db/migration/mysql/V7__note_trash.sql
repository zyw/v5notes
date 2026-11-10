-- 笔记和目录进入回收站。全新安装脚本若已建 note_trash，这里不重复创建。

ALTER TABLE note_notes
    ADD COLUMN trash_id bigint(20) NULL COMMENT '回收站批次ID。正常数据为空' AFTER content_hash;

ALTER TABLE note_directory
    ADD COLUMN trash_id bigint(20) NULL COMMENT '回收站批次ID。正常数据为空' AFTER pid;

CREATE INDEX idx_note_notes_trash ON note_notes (trash_id);
CREATE INDEX idx_note_directory_trash ON note_directory (trash_id);

CREATE TABLE IF NOT EXISTS note_trash
(
    id                 bigint(20)   NOT NULL COMMENT '回收站记录ID',
    user_id            bigint(20)   NOT NULL COMMENT '对象所属用户',
    object_type        char(1)      NOT NULL COMMENT '1笔记 2目录',
    object_id          bigint(20)   NOT NULL COMMENT '笔记ID或目录ID',
    name               varchar(100) NOT NULL COMMENT '删除时的名称',
    original_parent_id bigint(20)   NOT NULL COMMENT '删除时的上级ID，根级为0',
    original_path      varchar(500) NOT NULL COMMENT '删除时的路径',
    note_count         int          NOT NULL COMMENT '这次一并删除的笔记数',
    dir_count          int          NOT NULL COMMENT '这次一并删除的目录数，含目录本身',
    create_by          bigint(20)            DEFAULT NULL COMMENT '执行删除的人',
    deleted_time       datetime     NOT NULL COMMENT '删除时间',
    expire_time        datetime     NOT NULL COMMENT '到期清除时间',
    PRIMARY KEY (id),
    KEY idx_note_trash_user_time (user_id, deleted_time, id),
    KEY idx_note_trash_object (object_type, object_id)
) ENGINE = InnoDB COMMENT = '笔记回收站';
