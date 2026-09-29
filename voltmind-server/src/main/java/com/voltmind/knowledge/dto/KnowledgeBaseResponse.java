package com.voltmind.knowledge.dto;

import java.time.LocalDateTime;

/**
 * 知识库对外视图。
 *
 * @param id          知识库 ID
 * @param name        知识库名称
 * @param description 描述
 * @param createdAt   创建时间
 * @param updatedAt   更新时间
 */
public record KnowledgeBaseResponse(
        Long id,
        String name,
        String description,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
