package com.voltmind.knowledge.service;

import com.voltmind.common.BusinessException;
import com.voltmind.knowledge.dto.DocumentChunkInput;
import com.voltmind.knowledge.entity.Document;
import com.voltmind.knowledge.entity.DocumentChunk;
import com.voltmind.knowledge.entity.DocumentStatus;
import com.voltmind.knowledge.entity.KnowledgeBase;
import com.voltmind.knowledge.mapper.DocumentChunkMapper;
import com.voltmind.knowledge.mapper.DocumentMapper;
import com.voltmind.knowledge.mapper.KnowledgeBaseMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 文档处理版本和 Chunk 持久化的真实 MySQL 集成测试。 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class DocumentProcessingPersistenceIntegrationTest {
    private static final int MEDIUMTEXT_MAX_BYTES = 16_777_215;

    @Autowired
    private DocumentProcessingPersistenceService service;

    @Autowired
    private KnowledgeBaseMapper knowledgeBaseMapper;

    @Autowired
    private DocumentMapper documentMapper;

    @Autowired
    private DocumentChunkMapper documentChunkMapper;

    private final List<Long> documentIds = new ArrayList<>();
    private final List<Long> knowledgeBaseIds = new ArrayList<>();

    /** 每个用例只清理自己创建的记录；Chunk 由文档外键级联删除。 */
    @AfterEach
    void cleanDatabase() {
        documentIds.forEach(documentMapper::deleteById);
        knowledgeBaseIds.forEach(knowledgeBaseMapper::deleteById);
    }

    /** 抢占版本、分批保存与有序查询形成一个完整持久化闭环。 */
    @Test
    void savesAndQueriesChunksForCurrentVersion() {
        Document document = createDocument();

        long version = service.startProcessing(document.getId());
        assertEquals(1L, version);
        service.saveChunks(document.getId(), version, List.of(
                new DocumentChunkInput(0, "first chunk", 1, " Section One "),
                new DocumentChunkInput(1, "second chunk", null, null)));

        List<DocumentChunk> chunks = service.listChunks(document.getId(), version);
        assertEquals(List.of(0, 1), chunks.stream().map(DocumentChunk::getChunkIndex).toList());
        assertEquals("Section One", chunks.get(0).getSection());
        assertEquals(64, chunks.get(0).getContentHash().length());
        assertNotNull(chunks.get(0).getCreatedAt());

        Document completed = documentMapper.selectById(document.getId());
        assertEquals(DocumentStatus.PARSED, completed.getStatus());
        assertEquals(2, completed.getChunkCount());
        assertEquals(version, completed.getProcessingVersion());
    }

    /** 复合唯一键拒绝同文档、同版本、同 chunk_index 的重复记录。 */
    @Test
    void rejectsDuplicateChunkIndexWithinSameVersion() {
        Document document = createDocument();
        long version = service.startProcessing(document.getId());
        DocumentChunk first = chunk(document.getId(), version, 0, "first");
        DocumentChunk duplicate = chunk(document.getId(), version, 0, "duplicate");

        documentChunkMapper.insert(first);
        assertThrows(DataAccessException.class, () -> documentChunkMapper.insert(duplicate));
    }

    /** 删除文档时数据库外键级联清理所有 Chunk。 */
    @Test
    void deletingDocumentCascadesToChunks() {
        Document document = createDocument();
        long version = service.startProcessing(document.getId());
        service.saveChunks(document.getId(), version,
                List.of(new DocumentChunkInput(0, "content", 1, null)));

        assertEquals(1, documentMapper.deleteById(document.getId()));
        assertTrue(service.listChunks(document.getId(), version).isEmpty());
    }

    /** 新版本已开始后，旧版本结果和旧版本失败回写都不能改变当前文档。 */
    @Test
    void rejectsStaleProcessingVersion() {
        Document document = createDocument();
        long firstVersion = service.startProcessing(document.getId());
        service.markProcessingFailed(document.getId(), firstVersion, "PARSE_FAILED", "Cannot parse document");

        Document failed = documentMapper.selectById(document.getId());
        assertEquals(DocumentStatus.FAILED, failed.getStatus());
        assertEquals("PARSE_FAILED", failed.getProcessingErrorCode());

        long secondVersion = service.startProcessing(document.getId());
        assertEquals(firstVersion + 1, secondVersion);
        BusinessException staleSave = assertThrows(BusinessException.class,
                () -> service.saveChunks(document.getId(), firstVersion,
                        List.of(new DocumentChunkInput(0, "stale", 1, null))));
        assertEquals("STALE_PROCESSING_VERSION", staleSave.getCode());
        BusinessException staleFailure = assertThrows(BusinessException.class,
                () -> service.markProcessingFailed(
                        document.getId(), firstVersion, "OLD_FAILURE", "Old task failed"));
        assertEquals("STALE_PROCESSING_VERSION", staleFailure.getCode());

        Document current = documentMapper.selectById(document.getId());
        assertEquals(DocumentStatus.INDEXING, current.getStatus());
        assertEquals(secondVersion, current.getProcessingVersion());
        assertTrue(service.listChunks(document.getId(), firstVersion).isEmpty());
    }

    /** 文档已删除时，迟到任务既不能写 Chunk，也不能重新创建文档。 */
    @Test
    void deletedDocumentRejectsLateChunks() {
        Document document = createDocument();
        long version = service.startProcessing(document.getId());
        documentMapper.deleteById(document.getId());

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.saveChunks(document.getId(), version,
                        List.of(new DocumentChunkInput(0, "late", 1, null))));
        assertEquals("DOCUMENT_NOT_FOUND", exception.getCode());
        assertTrue(service.listChunks(document.getId(), version).isEmpty());
    }

    /** 第二批违反 MEDIUMTEXT 上限时，第一批 200 条也必须随事务回滚。 */
    @Test
    void batchFailureRollsBackEveryInsertedChunk() {
        Document document = createDocument();
        long version = service.startProcessing(document.getId());
        List<DocumentChunkInput> inputs = new ArrayList<>();
        for (int index = 0; index < 200; index++) {
            inputs.add(new DocumentChunkInput(index, "chunk-" + index, null, null));
        }
        inputs.add(new DocumentChunkInput(200, "x".repeat(MEDIUMTEXT_MAX_BYTES + 1), null, null));

        assertThrows(DataAccessException.class,
                () -> service.saveChunks(document.getId(), version, inputs));

        assertTrue(service.listChunks(document.getId(), version).isEmpty());
        Document current = documentMapper.selectById(document.getId());
        assertEquals(DocumentStatus.INDEXING, current.getStatus());
        assertEquals(0, current.getChunkCount());
    }

    private Document createDocument() {
        KnowledgeBase knowledgeBase = new KnowledgeBase();
        knowledgeBase.setName("chunk-test-" + UUID.randomUUID());
        knowledgeBaseMapper.insert(knowledgeBase);
        knowledgeBaseIds.add(knowledgeBase.getId());

        Document document = new Document();
        document.setKnowledgeBaseId(knowledgeBase.getId());
        document.setFileName("document.txt");
        document.setFileType("text/plain");
        document.setFileSize(1L);
        document.setStorageKey("chunk-test/" + UUID.randomUUID() + ".txt");
        document.setStatus(DocumentStatus.PENDING);
        document.setChunkCount(0);
        documentMapper.insert(document);
        documentIds.add(document.getId());
        return documentMapper.selectById(document.getId());
    }

    private DocumentChunk chunk(long documentId, long version, int index, String content) {
        DocumentChunk chunk = new DocumentChunk();
        chunk.setDocumentId(documentId);
        chunk.setProcessingVersion(version);
        chunk.setChunkIndex(index);
        chunk.setContent(content);
        chunk.setContentHash("0".repeat(64));
        return chunk;
    }
}
