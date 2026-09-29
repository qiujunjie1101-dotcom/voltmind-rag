package com.voltmind.knowledge.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/** 文档解析分块实体，对应表 {@code kb_document_chunk}。 */
@TableName("kb_document_chunk")
public class DocumentChunk {
    /** 主键，数据库自增。 */
    @TableId
    private Long id;
    /** 所属文档 ID，文档删除时由外键级联清理。 */
    private Long documentId;
    /** 生成该分块的处理版本，用于隔离迟到的旧任务结果。 */
    private Long processingVersion;
    /** 分块顺序，从 0 开始。 */
    private Integer chunkIndex;
    /** 分块正文。 */
    private String content;
    /** 正文 SHA-256，用于后续向量幂等与变更识别。 */
    private String contentHash;
    /** 原文页码，从 1 开始；无法可靠定位时为空。 */
    private Integer pageNumber;
    /** 原文章节标题；无法识别时为空。 */
    private String section;
    /** 创建时间，由数据库默认值写入。 */
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getDocumentId() { return documentId; }
    public void setDocumentId(Long documentId) { this.documentId = documentId; }
    public Long getProcessingVersion() { return processingVersion; }
    public void setProcessingVersion(Long processingVersion) { this.processingVersion = processingVersion; }
    public Integer getChunkIndex() { return chunkIndex; }
    public void setChunkIndex(Integer chunkIndex) { this.chunkIndex = chunkIndex; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getContentHash() { return contentHash; }
    public void setContentHash(String contentHash) { this.contentHash = contentHash; }
    public Integer getPageNumber() { return pageNumber; }
    public void setPageNumber(Integer pageNumber) { this.pageNumber = pageNumber; }
    public String getSection() { return section; }
    public void setSection(String section) { this.section = section; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
