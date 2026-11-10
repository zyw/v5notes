-- 笔记和目录进入回收站。列和索引使用 IF NOT EXISTS，避免全新安装脚本已经建过时重复执行失败。

ALTER TABLE note_notes
    ADD COLUMN IF NOT EXISTS trash_id bigint;
ALTER TABLE note_directory
    ADD COLUMN IF NOT EXISTS trash_id bigint;

COMMENT ON COLUMN note_notes.trash_id IS '回收站批次ID。正常数据为空';
COMMENT ON COLUMN note_directory.trash_id IS '回收站批次ID。正常数据为空';

CREATE INDEX IF NOT EXISTS idx_note_notes_trash ON note_notes (trash_id);
CREATE INDEX IF NOT EXISTS idx_note_directory_trash ON note_directory (trash_id);

CREATE TABLE IF NOT EXISTS note_trash
(
    id                 bigint       NOT NULL,
    user_id            bigint       NOT NULL,
    object_type        char(1)      NOT NULL,
    object_id          bigint       NOT NULL,
    name               varchar(100) NOT NULL,
    original_parent_id bigint       NOT NULL,
    original_path      varchar(500) NOT NULL,
    note_count         integer      NOT NULL,
    dir_count          integer      NOT NULL,
    create_by          bigint                DEFAULT NULL,
    deleted_time       timestamp    NOT NULL,
    expire_time        timestamp    NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_note_trash_user_time ON note_trash (user_id, deleted_time, id);
CREATE INDEX IF NOT EXISTS idx_note_trash_object ON note_trash (object_type, object_id);

COMMENT ON TABLE note_trash IS '笔记回收站';
COMMENT ON COLUMN note_trash.id IS '回收站记录ID';
COMMENT ON COLUMN note_trash.user_id IS '对象所属用户';
COMMENT ON COLUMN note_trash.object_type IS '1笔记 2目录';
COMMENT ON COLUMN note_trash.object_id IS '笔记ID或目录ID';
COMMENT ON COLUMN note_trash.name IS '删除时的名称';
COMMENT ON COLUMN note_trash.original_parent_id IS '删除时的上级ID，根级为0';
COMMENT ON COLUMN note_trash.original_path IS '删除时的路径';
COMMENT ON COLUMN note_trash.note_count IS '这次一并删除的笔记数';
COMMENT ON COLUMN note_trash.dir_count IS '这次一并删除的目录数，含目录本身';
COMMENT ON COLUMN note_trash.create_by IS '执行删除的人';
COMMENT ON COLUMN note_trash.deleted_time IS '删除时间';
COMMENT ON COLUMN note_trash.expire_time IS '到期清除时间';
