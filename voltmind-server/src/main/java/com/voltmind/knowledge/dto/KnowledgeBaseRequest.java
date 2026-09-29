package com.voltmind.knowledge.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 知识库新增与更新的请求体。
 *
 * <p>校验约束与数据库列宽保持一致（name 最长 128、description 最长 10000），
 * 让不合法输入在进入业务逻辑前就被拦下，也避免靠数据库报错兜底。</p>
 *
 * @param name        知识库名称，必填且库内唯一
 * @param description 描述，可为空
 */
public record KnowledgeBaseRequest(
        @NotBlank @Size(max = 128) String name,
        @Size(max = 10000) String description) {
}
