package com.voltmind.knowledge.service;

import com.voltmind.common.BusinessException;
import com.voltmind.knowledge.dto.DocumentChunkInput;
import com.voltmind.knowledge.entity.Document;
import com.voltmind.knowledge.entity.DocumentChunk;
import com.voltmind.knowledge.entity.DocumentStatus;
import com.voltmind.knowledge.mapper.DocumentChunkMapper;
import com.voltmind.knowledge.mapper.DocumentMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 文档处理状态与 Chunk 的事务边界。
 *
 * <p>本服务不调用 Python，也不实现切片算法；它只提供后续编排需要的原子版本抢占、
 * 当前版本结果持久化和失败回写。版本检查、旧 Chunk 删除、分批插入与状态更新均在
 * 同一事务和同一文档行锁下完成，迟到结果无法覆盖新版本。</p>
 */
@Service
public class DocumentProcessingPersistenceService {
    private static final int INSERT_BATCH_SIZE = 200;
    private static final int MAX_SECTION_LENGTH = 512;

    private final DocumentMapper documentMapper;
    private final DocumentChunkMapper documentChunkMapper;

    public DocumentProcessingPersistenceService(
            DocumentMapper documentMapper,
            DocumentChunkMapper documentChunkMapper) {
        this.documentMapper = documentMapper;
        this.documentChunkMapper = documentChunkMapper;
    }

    /**
     * 原子抢占一次处理：只有 PENDING、FAILED、PARSED 可以开始，并在同一 SQL 中递增版本。
     *
     * @return 本次任务必须携带的处理版本
     */
    @Transactional
    public long startProcessing(long documentId) {
        if (documentMapper.claimNextProcessingVersion(documentId) == 1) {
            return documentMapper.selectById(documentId).getProcessingVersion();
        }

        Document current = documentMapper.selectById(documentId);
        if (current == null) {
            throw new BusinessException("DOCUMENT_NOT_FOUND", "Document does not exist", HttpStatus.NOT_FOUND);
        }
        if (current.getStatus() == DocumentStatus.INDEXING) {
            throw new BusinessException("DOCUMENT_ALREADY_PROCESSING",
                    "Document is already being processed", HttpStatus.CONFLICT);
        }
        throw new BusinessException("INVALID_DOCUMENT_STATUS",
                "Document status does not allow processing", HttpStatus.CONFLICT);
    }

    /**
     * 保存当前版本的完整 Chunk 集合并标记为 PARSED。
     *
     * <p>先锁定文档行并校验版本，再删除旧分块、以每批最多 200 条写入，最后以相同版本
     * 条件更新状态。任一步失败都会回滚，不会保留部分新 Chunk，也不会丢掉旧版本 Chunk。</p>
     */
    @Transactional
    public void saveChunks(long documentId, long processingVersion, List<DocumentChunkInput> chunks) {
        List<DocumentChunk> entities = validateAndMap(documentId, processingVersion, chunks);
        Document document = documentMapper.selectByIdForUpdate(documentId);
        requireCurrentProcessingVersion(document, processingVersion);

        documentChunkMapper.deleteByDocumentId(documentId);
        for (int from = 0; from < entities.size(); from += INSERT_BATCH_SIZE) {
            int to = Math.min(from + INSERT_BATCH_SIZE, entities.size());
            documentChunkMapper.insertBatch(entities.subList(from, to));
        }

        if (documentMapper.completeProcessing(documentId, processingVersion, entities.size()) != 1) {
            throw staleVersion();
        }
    }

    /** 当前版本失败回写；迟到任务不能覆盖新版本状态。 */
    @Transactional
    public void markProcessingFailed(
            long documentId,
            long processingVersion,
            String errorCode,
            String errorMessage) {
        if (errorCode == null || errorCode.isBlank() || errorCode.length() > 64) {
            throw new IllegalArgumentException("Processing error code must contain at most 64 characters");
        }
        if (errorMessage == null || errorMessage.isBlank() || errorMessage.length() > 1000) {
            throw new IllegalArgumentException("Processing error message must contain at most 1000 characters");
        }
        if (documentMapper.failProcessing(documentId, processingVersion, errorCode, errorMessage) != 1) {
            Document current = documentMapper.selectById(documentId);
            if (current == null) {
                throw new BusinessException("DOCUMENT_NOT_FOUND",
                        "Document does not exist", HttpStatus.NOT_FOUND);
            }
            throw staleVersion();
        }
    }

    /** 按文档和处理版本读取 Chunk，始终按 chunk_index 升序。 */
    @Transactional(readOnly = true)
    public List<DocumentChunk> listChunks(long documentId, long processingVersion) {
        return documentChunkMapper.selectOrdered(documentId, processingVersion);
    }

    private List<DocumentChunk> validateAndMap(
            long documentId,
            long processingVersion,
            List<DocumentChunkInput> chunks) {
        if (processingVersion <= 0) {
            throw new IllegalArgumentException("Processing version must be positive");
        }
        if (chunks == null || chunks.isEmpty()) {
            throw new IllegalArgumentException("Chunks must not be empty");
        }

        java.util.ArrayList<DocumentChunk> entities = new java.util.ArrayList<>(chunks.size());
        for (int position = 0; position < chunks.size(); position++) {
            DocumentChunkInput input = chunks.get(position);
            if (input == null || input.chunkIndex() != position) {
                throw new IllegalArgumentException("Chunk indexes must be continuous and start at zero");
            }
            if (input.content() == null || input.content().isBlank()) {
                throw new IllegalArgumentException("Chunk content must not be blank");
            }
            if (input.pageNumber() != null && input.pageNumber() < 1) {
                throw new IllegalArgumentException("Chunk page number must be positive");
            }
            String section = input.section() == null || input.section().isBlank()
                    ? null : input.section().strip();
            if (section != null && section.codePointCount(0, section.length()) > MAX_SECTION_LENGTH) {
                throw new IllegalArgumentException("Chunk section must contain at most 512 characters");
            }

            DocumentChunk entity = new DocumentChunk();
            entity.setDocumentId(documentId);
            entity.setProcessingVersion(processingVersion);
            entity.setChunkIndex(input.chunkIndex());
            entity.setContent(input.content());
            entity.setContentHash(sha256(input.content()));
            entity.setPageNumber(input.pageNumber());
            entity.setSection(section);
            entities.add(entity);
        }
        return entities;
    }

    private void requireCurrentProcessingVersion(Document document, long processingVersion) {
        if (document == null) {
            throw new BusinessException("DOCUMENT_NOT_FOUND", "Document does not exist", HttpStatus.NOT_FOUND);
        }
        if (document.getProcessingVersion() == null
                || document.getProcessingVersion() != processingVersion
                || document.getStatus() != DocumentStatus.INDEXING) {
            throw staleVersion();
        }
    }

    private BusinessException staleVersion() {
        return new BusinessException("STALE_PROCESSING_VERSION",
                "Processing result is no longer current", HttpStatus.CONFLICT);
    }

    private String sha256(String content) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(content.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
