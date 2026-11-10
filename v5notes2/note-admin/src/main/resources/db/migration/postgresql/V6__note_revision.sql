-- 笔记正文版本。已有笔记的 content_hash 留空，由应用在读取或保存时补齐。

ALTER TABLE note_notes
    ADD COLUMN IF NOT EXISTS content_hash char(64);

COMMENT ON COLUMN note_notes.content_hash IS '当前正文 SHA-256，十六进制小写。NULL 表示尚未计算';

CREATE TABLE IF NOT EXISTS note_revision
(
    id           bigint       NOT NULL,
    note_id      bigint       NOT NULL,
    user_id      bigint       NOT NULL,
    content_hash char(64)     NOT NULL,
    content      text         NOT NULL,
    excerpt      varchar(200) NOT NULL DEFAULT '',
    size         integer      NOT NULL,
    create_dept  bigint                DEFAULT NULL,
    create_by    bigint                DEFAULT NULL,
    create_time  timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_note_revision_note_time ON note_revision (note_id, create_time, id);

COMMENT ON TABLE note_revision IS '笔记版本';
COMMENT ON COLUMN note_revision.id IS '版本ID';
COMMENT ON COLUMN note_revision.note_id IS '笔记ID';
COMMENT ON COLUMN note_revision.user_id IS '笔记所属用户';
COMMENT ON COLUMN note_revision.content_hash IS '该快照正文 SHA-256，十六进制小写';
COMMENT ON COLUMN note_revision.content IS '正文全文快照';
COMMENT ON COLUMN note_revision.excerpt IS '列表摘要，最多 120 个 Unicode 码位';
COMMENT ON COLUMN note_revision.size IS '正文 UTF-8 字节数';
COMMENT ON COLUMN note_revision.create_dept IS '创建部门';
COMMENT ON COLUMN note_revision.create_by IS '创建者';
COMMENT ON COLUMN note_revision.create_time IS '版本时间';
