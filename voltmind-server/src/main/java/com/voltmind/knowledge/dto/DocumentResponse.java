package com.voltmind.knowledge.dto;

import com.voltmind.knowledge.entity.DocumentStatus;
import java.time.LocalDateTime;

/**
 * 文档对外视图。
 *
 * <p>字段与实体一一对应，但只暴露调用方需要的信息：不含存储根目录等服务器侧路径，
 * {@code storageKey} 保留是为了让后续处理链路（切分、向量化）能定位到物理文件。</p>
 *
 * @param id              文档 ID
 * @param knowledgeBaseId 所属知识库 ID
 * @param fileName        原始文件名
 * @param fileType        文件 MIME 类型
 * @param fileSize        文件字节数
 * @param storageKey      相对存储根目录的路径
 * @param status          处理状态
 * @param chunkCount      已切分的文本块数量
 * @param createdAt       创建时间
 * @param updatedAt       更新时间
 */
public record DocumentResponse(
        Long id,
        Long knowledgeBaseId,
        String fileName,
        String fileType,
        Long fileSize,
        String storageKey,
        DocumentStatus status,
        Integer chunkCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
