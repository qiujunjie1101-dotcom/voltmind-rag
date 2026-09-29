package com.voltmind.knowledge.dto;

/**
 * 待持久化的解析分块。
 *
 * @param chunkIndex 分块顺序，从 0 开始且必须连续
 * @param content 正文，不能为空白
 * @param pageNumber 原文页码，从 1 开始；无法定位时为空
 * @param section 原文章节标题；无法识别时为空
 */
public record DocumentChunkInput(
        int chunkIndex,
        String content,
        Integer pageNumber,
        String section) {
}
