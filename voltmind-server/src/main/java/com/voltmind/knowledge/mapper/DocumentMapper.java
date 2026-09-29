package com.voltmind.knowledge.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.voltmind.knowledge.entity.Document;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 文档表的数据访问接口。
 *
 * <p>普通查询沿用 MyBatis-Plus；处理版本与状态必须在数据库内原子判断，
 * 因此在这里集中声明条件更新和行锁 SQL。</p>
 */
public interface DocumentMapper extends BaseMapper<Document> {
    /** 从允许状态原子进入 INDEXING 并递增版本，返回 1 表示抢占成功。 */
    @Update("""
            UPDATE kb_document
            SET processing_version = processing_version + 1,
                status = 'INDEXING',
                chunk_count = 0,
                processing_error_code = NULL,
                processing_error_message = NULL
            WHERE id = #{documentId}
              AND status IN ('PENDING', 'FAILED', 'PARSED')
            """)
    int claimNextProcessingVersion(@Param("documentId") long documentId);

    /** 保存结果前锁定文档行，防止并发删除或新版本抢占穿过版本检查。 */
    @Select("""
            SELECT id, knowledge_base_id, file_name, file_type, file_size, storage_key,
                   status, chunk_count, processing_version, processing_error_code,
                   processing_error_message, created_at, updated_at
            FROM kb_document
            WHERE id = #{documentId}
            FOR UPDATE
            """)
    Document selectByIdForUpdate(@Param("documentId") long documentId);

    /** 当前版本的 Chunk 已完整写入后，条件更新为 PARSED。 */
    @Update("""
            UPDATE kb_document
            SET status = 'PARSED',
                chunk_count = #{chunkCount},
                processing_error_code = NULL,
                processing_error_message = NULL
            WHERE id = #{documentId}
              AND processing_version = #{processingVersion}
              AND status = 'INDEXING'
            """)
    int completeProcessing(
            @Param("documentId") long documentId,
            @Param("processingVersion") long processingVersion,
            @Param("chunkCount") int chunkCount);

    /** 只有仍处于 INDEXING 的当前版本可以写入失败状态。 */
    @Update("""
            UPDATE kb_document
            SET status = 'FAILED',
                processing_error_code = #{errorCode},
                processing_error_message = #{errorMessage}
            WHERE id = #{documentId}
              AND processing_version = #{processingVersion}
              AND status = 'INDEXING'
            """)
    int failProcessing(
            @Param("documentId") long documentId,
            @Param("processingVersion") long processingVersion,
            @Param("errorCode") String errorCode,
            @Param("errorMessage") String errorMessage);
}
