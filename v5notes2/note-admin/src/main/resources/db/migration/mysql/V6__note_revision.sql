-- 笔记正文版本。已有笔记的 content_hash 留空，由应用在读取或保存时补齐。

ALTER TABLE note_notes
    ADD COLUMN content_hash char(64) NULL COMMENT '当前正文 SHA-256，十六进制小写。NULL 表示尚未计算' AFTER content;

CREATE TABLE IF NOT EXISTS note_revision
(
    id           bigint(20)   NOT NULL COMMENT '版本ID',
    note_id      bigint(20)   NOT NULL COMMENT '笔记ID',
    user_id      bigint(20)   NOT NULL COMMENT '笔记所属用户',
    content_hash char(64)     NOT NULL COMMENT '该快照正文 SHA-256，十六进制小写',
    content      mediumtext   NOT NULL COMMENT '正文全文快照',
    excerpt      varchar(200) NOT NULL DEFAULT '' COMMENT '列表摘要，最多 120 个 Unicode 码位',
    size         int          NOT NULL COMMENT '正文 UTF-8 字节数',
    create_dept  bigint(20)            DEFAULT NULL COMMENT '创建部门',
    create_by    bigint(20)            DEFAULT NULL COMMENT '创建者',
    create_time  datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '版本时间',
    PRIMARY KEY (id),
    KEY idx_note_revision_note_time (note_id, create_time, id)
) ENGINE = InnoDB COMMENT = '笔记版本';
