package com.voltmind.knowledge.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.voltmind.knowledge.entity.DocumentChunk;
import java.util.List;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** 文档分块数据访问接口。 */
public interface DocumentChunkMapper extends BaseMapper<DocumentChunk> {
    /**
     * 插入一个有界批次。调用方固定切成小批量，避免单条 SQL 随文档大小无限增长。
     */
    @Insert({
            "<script>",
            "INSERT INTO kb_document_chunk",
            "(document_id, processing_version, chunk_index, content, content_hash, page_number, section)",
            "VALUES",
            "<foreach collection='chunks' item='chunk' separator=','>",
            "(#{chunk.documentId}, #{chunk.processingVersion}, #{chunk.chunkIndex},",
            " #{chunk.content}, #{chunk.contentHash}, #{chunk.pageNumber}, #{chunk.section})",
            "</foreach>",
            "</script>"
    })
    int insertBatch(@Param("chunks") List<DocumentChunk> chunks);

    /** 查询某次处理产生的分块，顺序由复合唯一索引直接支持。 */
    @Select("""
            SELECT id, document_id, processing_version, chunk_index, content, content_hash,
                   page_number, section, created_at
            FROM kb_document_chunk
            WHERE document_id = #{documentId} AND processing_version = #{processingVersion}
            ORDER BY chunk_index ASC
            """)
    List<DocumentChunk> selectOrdered(
            @Param("documentId") long documentId,
            @Param("processingVersion") long processingVersion);

    /** 成功写入新版本前删除该文档的旧分块，调用方事务失败时删除会一并回滚。 */
    @Delete("DELETE FROM kb_document_chunk WHERE document_id = #{documentId}")
    int deleteByDocumentId(@Param("documentId") long documentId);
}
