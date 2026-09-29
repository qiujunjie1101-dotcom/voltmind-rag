package com.voltmind.knowledge.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.voltmind.common.BusinessException;
import com.voltmind.config.StorageProperties;
import com.voltmind.knowledge.dto.DocumentResponse;
import com.voltmind.knowledge.entity.Document;
import com.voltmind.knowledge.entity.DocumentStatus;
import com.voltmind.knowledge.mapper.DocumentMapper;
import com.voltmind.knowledge.storage.FileStorage;
import com.voltmind.knowledge.storage.FileStorage.StoredFile;
import com.voltmind.knowledge.storage.FileStorageException;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 文档业务逻辑：上传、列表、详情与删除。
 *
 * <p>上传这条链路有三处关键约定：</p>
 * <ul>
 *   <li>先校验后落盘：文件为空、超限、文件名不安全、类型不在白名单，都会在写磁盘之前被拒；</li>
 *   <li>落盘成功后写数据库，写库失败则补偿删除刚存的文件，避免留下没有记录指向的孤儿文件；</li>
 *   <li>上传完成后状态固定为 PENDING、分块数为 0，向量化由后续流程回填，本服务不负责切分。</li>
 * </ul>
 */
@Service
public class DocumentService {
    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);
    /** 浏览器对未知类型常上报 application/octet-stream，因此每种扩展名都额外接受它。 */
    private static final String BINARY_CONTENT_TYPE = "application/octet-stream";
    /**
     * 允许的扩展名与 MIME 类型白名单。
     *
     * <p>黑名单挡不住新类型，所以这里只列白名单；key 为小写扩展名（markdown 与 md 等价），
     * value 为该扩展名可接受的 MIME 类型。</p>
     */
    private static final Map<String, Set<String>> ALLOWED_TYPES = Map.of(
            "pdf", Set.of("application/pdf", BINARY_CONTENT_TYPE),
            "docx", Set.of("application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    BINARY_CONTENT_TYPE),
            "md", Set.of("text/markdown", "text/plain", BINARY_CONTENT_TYPE),
            "markdown", Set.of("text/markdown", "text/plain", BINARY_CONTENT_TYPE),
            "txt", Set.of("text/plain", BINARY_CONTENT_TYPE));

    private final DocumentMapper documentMapper;
    private final KnowledgeBaseService knowledgeBaseService;
    private final FileStorage fileStorage;
    private final StorageProperties storageProperties;

    public DocumentService(
            DocumentMapper documentMapper,
            KnowledgeBaseService knowledgeBaseService,
            FileStorage fileStorage,
            StorageProperties storageProperties) {
        this.documentMapper = documentMapper;
        this.knowledgeBaseService = knowledgeBaseService;
        this.fileStorage = fileStorage;
        this.storageProperties = storageProperties;
    }

    /**
     * 上传文档：校验 → 落盘 → 写库，写库失败时补偿删除已落盘的文件。
     *
     * <p>文件系统与数据库没有共同事务，只能靠补偿保证一致：宁可删掉文件后报错，
     * 也不留下没有数据库记录、事后无法清理的孤儿文件。</p>
     */
    @Transactional
    public DocumentResponse upload(long knowledgeBaseId, MultipartFile file) {
        knowledgeBaseService.requireEntity(knowledgeBaseId);
        ValidatedFile validated = validate(file);
        StoredFile stored;
        try {
            stored = fileStorage.store(file, validated.fileName());
        } catch (FileStorageException exception) {
            throw storageError("Cannot store document file");
        }

        Document entity = new Document();
        entity.setKnowledgeBaseId(knowledgeBaseId);
        entity.setFileName(validated.fileName());
        entity.setFileType(validated.contentType());
        // 大小与存储键都取落盘后的真实结果，不用上传请求里声明的值
        entity.setFileSize(stored.size());
        entity.setStorageKey(stored.storageKey());
        entity.setStatus(DocumentStatus.PENDING);
        entity.setChunkCount(0);

        try {
            documentMapper.insert(entity);
        } catch (RuntimeException databaseException) {
            // 写库失败必须把已落盘的文件删掉，否则文件系统里会留下无人引用的残留
            try {
                fileStorage.delete(stored.storageKey());
            } catch (RuntimeException cleanupException) {
                log.error("Failed to compensate stored file {} after database failure",
                        stored.storageKey(), cleanupException);
                databaseException.addSuppressed(cleanupException);
            }
            throw databaseException;
        }
        return toResponse(documentMapper.selectById(entity.getId()));
    }

    /** 列出知识库下的文档：按创建时间倒序，同刻创建的用 ID 兜底，保证顺序稳定。 */
    @Transactional(readOnly = true)
    public java.util.List<DocumentResponse> list(long knowledgeBaseId) {
        knowledgeBaseService.requireEntity(knowledgeBaseId);
        return documentMapper.selectList(Wrappers.<Document>lambdaQuery()
                        .eq(Document::getKnowledgeBaseId, knowledgeBaseId)
                        .orderByDesc(Document::getCreatedAt, Document::getId))
                .stream().map(this::toResponse).toList();
    }

    /** 查询单个文档，不存在返回 404。 */
    @Transactional(readOnly = true)
    public DocumentResponse get(long id) {
        return toResponse(requireEntity(id));
    }

    /**
     * 删除文档：先删物理文件，再删数据库记录，顺序与知识库删除保持一致。
     *
     * <p>文件删不掉时直接报错并保留记录（事务回滚），便于重试；
     * 文件本就不存在则由存储层按幂等处理，不算失败。</p>
     */
    @Transactional
    public void delete(long id) {
        Document entity = requireEntity(id);
        try {
            fileStorage.delete(entity.getStorageKey());
        } catch (FileStorageException exception) {
            throw new BusinessException("FILE_DELETE_FAILED",
                    "Cannot delete document file", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        documentMapper.deleteById(id);
    }

    /** 按 ID 取实体，不存在则抛 404。 */
    private Document requireEntity(long id) {
        Document entity = documentMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException("DOCUMENT_NOT_FOUND", "Document does not exist", HttpStatus.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 上传前的完整校验，全部通过才返回归一化后的文件名与类型。
     *
     * <p>逐项拦截：空文件、超过配置上限、文件名不安全（含路径分隔符、空字节、
     * {@code ..} 或超长）、扩展名或 MIME 类型不在白名单。文件名只用于取扩展名与展示，
     * 落盘名由存储层另行生成，因此这里不承担防重名与防穿越的职责，但仍拒绝可疑输入。</p>
     */
    private ValidatedFile validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("EMPTY_FILE", "File must not be empty", HttpStatus.BAD_REQUEST);
        }
        if (file.getSize() > storageProperties.getMaxFileSizeBytes()) {
            throw new BusinessException("FILE_TOO_LARGE",
                    "File exceeds the configured size limit", HttpStatus.PAYLOAD_TOO_LARGE);
        }

        String fileName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().trim();
        if (fileName.isBlank() || fileName.length() > 255 || fileName.contains("/")
                || fileName.contains("\\") || fileName.contains("\0") || fileName.contains("..")) {
            throw new BusinessException("INVALID_FILE_NAME", "File name is not safe", HttpStatus.BAD_REQUEST);
        }
        int dot = fileName.lastIndexOf('.');
        String extension = dot < 0 ? "" : fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
        Set<String> contentTypes = ALLOWED_TYPES.get(extension);
        String contentType = file.getContentType() == null || file.getContentType().isBlank()
                ? BINARY_CONTENT_TYPE : file.getContentType().toLowerCase(Locale.ROOT);
        // 扩展名与 MIME 必须同时命中白名单，只校验其一会漏掉改名伪装的文件
        if (contentTypes == null || !contentTypes.contains(contentType)) {
            throw new BusinessException("UNSUPPORTED_FILE_TYPE",
                    "Only PDF, DOCX, Markdown and TXT files are supported", HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        }
        return new ValidatedFile(fileName, contentType);
    }

    /** 存储层故障的统一出口：对调用方只暴露通用说明，细节留在日志。 */
    private BusinessException storageError(String message) {
        return new BusinessException("FILE_STORAGE_ERROR", message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    /** 实体到视图的转换。 */
    private DocumentResponse toResponse(Document entity) {
        return new DocumentResponse(entity.getId(), entity.getKnowledgeBaseId(), entity.getFileName(),
                entity.getFileType(), entity.getFileSize(), entity.getStorageKey(), entity.getStatus(),
                entity.getChunkCount(), entity.getCreatedAt(), entity.getUpdatedAt());
    }

    /** 校验结果：只保留后续真正会用到的两项信息。 */
    private record ValidatedFile(String fileName, String contentType) {
    }
}
