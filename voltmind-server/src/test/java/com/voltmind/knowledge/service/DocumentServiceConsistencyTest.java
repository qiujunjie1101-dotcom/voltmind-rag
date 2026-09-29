package com.voltmind.knowledge.service;

import com.voltmind.common.BusinessException;
import com.voltmind.config.StorageProperties;
import com.voltmind.knowledge.entity.Document;
import com.voltmind.knowledge.entity.KnowledgeBase;
import com.voltmind.knowledge.mapper.DocumentMapper;
import com.voltmind.knowledge.storage.FileStorage;
import com.voltmind.knowledge.storage.FileStorage.StoredFile;
import com.voltmind.knowledge.storage.FileStorageException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 文档上传与删除的一致性测试：数据库与存储都用 Mock 隔离，专门验证补偿分支。
 *
 * <p>两条用例对应服务层的取舍——写库失败要补偿删除已落盘的文件，
 * 文件删不掉要保留数据库记录，任一环节都不允许出现「文件与记录只留一半」。</p>
 */
@ExtendWith(MockitoExtension.class)
class DocumentServiceConsistencyTest {
    @Mock
    private DocumentMapper documentMapper;

    @Mock
    private KnowledgeBaseService knowledgeBaseService;

    @Mock
    private FileStorage fileStorage;

    private DocumentService service;

    @BeforeEach
    void setUp() {
        StorageProperties properties = new StorageProperties();
        properties.setMaxFileSizeBytes(1024);
        service = new DocumentService(documentMapper, knowledgeBaseService, fileStorage, properties);
    }

    /** 落盘成功但写库失败：异常照原样抛出，同时必须把已落盘的文件删掉，不留孤儿文件。 */
    @Test
    void databaseFailureAfterStoreDeletesStoredFile() {
        KnowledgeBase knowledgeBase = new KnowledgeBase();
        knowledgeBase.setId(1L);
        when(knowledgeBaseService.requireEntity(1L)).thenReturn(knowledgeBase);
        MockMultipartFile file = new MockMultipartFile("file", "notes.txt", "text/plain",
                "content".getBytes(StandardCharsets.UTF_8));
        when(fileStorage.store(file, "notes.txt")).thenReturn(new StoredFile("aa/file.txt", 7));
        when(documentMapper.insert(any(Document.class)))
                .thenThrow(new DataIntegrityViolationException("database failure"));

        assertThrows(DataIntegrityViolationException.class, () -> service.upload(1L, file));
        verify(fileStorage).delete("aa/file.txt");
    }

    /** 文件删除失败：返回 FILE_DELETE_FAILED，并且不能删掉数据库记录，便于重试。 */
    @Test
    void fileDeleteFailureKeepsDocumentRecord() {
        Document document = new Document();
        document.setId(9L);
        document.setStorageKey("aa/file.txt");
        when(documentMapper.selectById(9L)).thenReturn(document);
        doThrow(new FileStorageException("delete failed", new java.io.IOException()))
                .when(fileStorage).delete("aa/file.txt");

        BusinessException exception = assertThrows(BusinessException.class, () -> service.delete(9L));
        assertEquals("FILE_DELETE_FAILED", exception.getCode());
        verify(documentMapper, never()).deleteById(9L);
    }
}
