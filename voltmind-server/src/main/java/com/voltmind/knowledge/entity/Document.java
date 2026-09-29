package com.voltmind.knowledge.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 文档实体，对应表 {@code kb_document}。
 *
 * <p>一行代表「某个知识库里的一份已上传文件」。文件本体不入库，只在
 * {@code storageKey} 里存相对路径，实际内容由文件存储组件管理；
 * {@code status} 与 {@code chunkCount} 是给后续向量化流程回填的位置，
 * 当前上传完成后固定为 PENDING 与 0。</p>
 */
@TableName("kb_document")
public class Document {
    /** 主键，数据库自增。 */
    @TableId
    private Long id;
    /** 所属知识库 ID，外键指向 kb_knowledge_base，且为 ON DELETE RESTRICT。 */
    private Long knowledgeBaseId;
    /** 原始文件名（已去掉路径与首尾空白），用于展示与判断扩展名。 */
    private String fileName;
    /** 文件类型，取校验通过的 MIME 类型。 */
    private String fileType;
    /** 文件字节数，取落盘后的实际大小。 */
    private Long fileSize;
    /** 存储键：相对存储根目录的路径，库内唯一，删除时据此定位物理文件。 */
    private String storageKey;
    /** 处理状态，取值见 {@link DocumentStatus}。 */
    private DocumentStatus status;
    /** 已切分的文本块数量，向量化后回填。 */
    private Integer chunkCount;
    /** 创建时间，由数据库默认值写入。 */
    private LocalDateTime createdAt;
    /** 更新时间，由数据库在行变更时自动刷新。 */
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getKnowledgeBaseId() { return knowledgeBaseId; }
    public void setKnowledgeBaseId(Long knowledgeBaseId) { this.knowledgeBaseId = knowledgeBaseId; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getFileType() { return fileType; }
    public void setFileType(String fileType) { this.fileType = fileType; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String storageKey) { this.storageKey = storageKey; }
    public DocumentStatus getStatus() { return status; }
    public void setStatus(DocumentStatus status) { this.status = status; }
    public Integer getChunkCount() { return chunkCount; }
    public void setChunkCount(Integer chunkCount) { this.chunkCount = chunkCount; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
