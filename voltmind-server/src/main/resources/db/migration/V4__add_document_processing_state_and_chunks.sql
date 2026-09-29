ALTER TABLE kb_document
    DROP CHECK chk_kb_document_status;

ALTER TABLE kb_document
    MODIFY COLUMN status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
        COMMENT '处理状态：PENDING待处理，INDEXING处理中，PARSED解析完成，INDEXED向量化完成，FAILED处理失败',
    ADD COLUMN processing_version BIGINT NOT NULL DEFAULT 0 COMMENT '文档处理版本号，用于拒绝过期任务结果'
        AFTER chunk_count,
    ADD COLUMN processing_error_code VARCHAR(64) NULL COMMENT '最近一次处理失败错误码'
        AFTER processing_version,
    ADD COLUMN processing_error_message VARCHAR(1000) NULL COMMENT '最近一次处理失败安全摘要'
        AFTER processing_error_code,
    ADD CONSTRAINT chk_kb_document_status
        CHECK (status IN ('PENDING', 'INDEXING', 'PARSED', 'INDEXED', 'FAILED')),
    ADD CONSTRAINT chk_kb_document_processing_version
        CHECK (processing_version >= 0);

CREATE TABLE kb_document_chunk (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '文档分块主键',
    document_id BIGINT NOT NULL COMMENT '所属文档ID',
    processing_version BIGINT NOT NULL COMMENT '生成该分块的文档处理版本号',
    chunk_index INT NOT NULL COMMENT '分块在当前文档版本中的顺序，从0开始',
    content MEDIUMTEXT NOT NULL COMMENT '分块正文内容',
    content_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '分块正文SHA-256摘要',
    page_number INT NULL COMMENT '原文页码，从1开始，无法定位时为空',
    section VARCHAR(512) NULL COMMENT '原文章节标题，无法识别时为空',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    PRIMARY KEY (id),
    CONSTRAINT uk_kb_document_chunk_doc_version_index
        UNIQUE (document_id, processing_version, chunk_index),
    CONSTRAINT fk_kb_document_chunk_document FOREIGN KEY (document_id)
        REFERENCES kb_document (id) ON DELETE CASCADE,
    CONSTRAINT chk_kb_document_chunk_processing_version CHECK (processing_version > 0),
    CONSTRAINT chk_kb_document_chunk_index CHECK (chunk_index >= 0),
    CONSTRAINT chk_kb_document_chunk_page_number CHECK (page_number IS NULL OR page_number >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    COMMENT='文档解析分块内容表';
