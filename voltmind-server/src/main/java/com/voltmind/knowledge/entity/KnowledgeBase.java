package com.voltmind.knowledge.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 知识库实体，对应表 {@code kb_knowledge_base}。
 *
 * <p>名称在库内有唯一约束，业务层的重名校验与之一致；删除知识库不做级联，
 * 库里还有文档时会被外键（ON DELETE RESTRICT）挡住，避免静默丢掉文档记录。</p>
 */
@TableName("kb_knowledge_base")
public class KnowledgeBase {
    /** 主键，数据库自增。 */
    @TableId
    private Long id;
    /** 知识库名称，必填且库内唯一。 */
    private String name;
    /** 描述，可为空。 */
    private String description;
    /** 创建时间，由数据库默认值写入。 */
    private LocalDateTime createdAt;
    /** 更新时间，由数据库在行变更时自动刷新。 */
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
