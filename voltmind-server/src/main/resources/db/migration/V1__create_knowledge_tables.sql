CREATE TABLE kb_knowledge_base (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(128) NOT NULL,
    description TEXT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    CONSTRAINT uk_kb_knowledge_base_name UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE kb_document (
    id BIGINT NOT NULL AUTO_INCREMENT,
    knowledge_base_id BIGINT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(128) NOT NULL,
    file_size BIGINT NOT NULL,
    storage_key VARCHAR(512) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    chunk_count INT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    CONSTRAINT uk_kb_document_storage_key UNIQUE (storage_key),
    CONSTRAINT fk_kb_document_knowledge_base FOREIGN KEY (knowledge_base_id)
        REFERENCES kb_knowledge_base (id) ON DELETE RESTRICT,
    CONSTRAINT chk_kb_document_file_size CHECK (file_size >= 0),
    CONSTRAINT chk_kb_document_chunk_count CHECK (chunk_count >= 0),
    CONSTRAINT chk_kb_document_status CHECK (status IN ('PENDING', 'INDEXING', 'INDEXED', 'FAILED')),
    INDEX idx_kb_document_kb_status_created (knowledge_base_id, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
