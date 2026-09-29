package com.voltmind.knowledge;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * 数据库迁移的集成测试：连真实 MySQL，校验 Flyway 迁移的实际结果。
 *
 * <p>断言的是「迁移脚本到底建出了什么」，因此列清单、注释文案与约束名都写成期望值：
 * 迁移脚本一旦调整，这里会立刻失败，起到迁移契约的作用。
 * 类级别开启事务并回滚，用例产生的数据不会留在库里；webEnvironment 设为 NONE，
 * 只加载持久化相关组件，不必启动 Web 容器。</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Transactional
@Rollback
class DatabaseMigrationIntegrationTest {
    @Autowired
    private JdbcTemplate jdbcTemplate;

    /** V1 迁移已成功执行，两张业务表的列、唯一键、外键、检查约束与索引都已建立。 */
    @Test
    void flywayCreatedExpectedSchema() {
        assertEquals(1, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE version = '1' AND success = 1",
                Integer.class));
        assertEquals(List.of("id", "name", "description", "created_at", "updated_at"),
                columnsOf("kb_knowledge_base"));
        assertEquals(List.of("id", "knowledge_base_id", "file_name", "file_type", "file_size",
                        "storage_key", "status", "chunk_count", "created_at", "updated_at"),
                columnsOf("kb_document"));
        assertEquals(1, schemaObjectCount("TABLE_CONSTRAINTS", "CONSTRAINT_NAME", "uk_kb_knowledge_base_name"));
        assertEquals(1, schemaObjectCount("TABLE_CONSTRAINTS", "CONSTRAINT_NAME", "fk_kb_document_knowledge_base"));
        assertEquals(1, schemaObjectCount("TABLE_CONSTRAINTS", "CONSTRAINT_NAME", "chk_kb_document_status"));
        assertEquals(3, schemaObjectCount("STATISTICS", "INDEX_NAME", "idx_kb_document_kb_status_created"));
    }

    /** 表与列的中文注释齐全，运维可以直接读库理解字段含义，不必翻代码。 */
    @Test
    void knowledgeTablesAndColumnsHaveChineseComments() {
        assertEquals("Flyway数据库迁移历史表", tableComment("flyway_schema_history"));
        assertEquals("知识库基本信息表", tableComment("kb_knowledge_base"));
        assertEquals("知识库文档元数据表", tableComment("kb_document"));
        assertEquals(List.of("迁移执行顺序", "迁移版本号", "迁移描述", "迁移类型", "迁移脚本名称",
                        "迁移脚本校验值", "执行迁移的数据库用户", "迁移执行时间", "迁移执行耗时（毫秒）", "迁移是否成功"),
                columnCommentsOf("flyway_schema_history"));
        assertEquals(List.of("知识库主键", "知识库名称", "知识库描述", "创建时间", "更新时间"),
                columnCommentsOf("kb_knowledge_base"));
        assertEquals(List.of("文档主键", "所属知识库ID", "原始文件名", "文件类型", "文件大小（字节）",
                        "文件存储标识", "处理状态：PENDING待处理，INDEXING处理中，INDEXED处理完成，FAILED处理失败",
                        "文档分块数量", "创建时间", "更新时间"),
                columnCommentsOf("kb_document"));
    }

    /** 名称唯一性由数据库兜底：应用层的重名校验之外，重复插入仍会被约束拒绝。 */
    @Test
    void knowledgeBaseNameUniqueConstraintIsEnforced() {
        String name = "constraint-test-" + UUID.randomUUID();
        jdbcTemplate.update("INSERT INTO kb_knowledge_base(name) VALUES (?)", name);
        assertThrows(DataIntegrityViolationException.class,
                () -> jdbcTemplate.update("INSERT INTO kb_knowledge_base(name) VALUES (?)", name));
    }

    /** 文档必须挂在存在的知识库上：指向不存在 ID 的插入被外键拦住。 */
    @Test
    void documentForeignKeyConstraintIsEnforced() {
        assertThrows(DataIntegrityViolationException.class, () -> jdbcTemplate.update("""
                INSERT INTO kb_document
                    (knowledge_base_id, file_name, file_type, file_size, storage_key, status)
                VALUES (?, 'missing.txt', 'text/plain', 1, ?, 'PENDING')
                """, Long.MAX_VALUE, "constraint-test-" + UUID.randomUUID()));
    }

    /** 处理状态受 CHECK 约束限制：写入枚举之外的值会被数据库拒绝。 */
    @Test
    void documentStatusConstraintIsEnforced() {
        jdbcTemplate.update("INSERT INTO kb_knowledge_base(name) VALUES (?)",
                "constraint-test-" + UUID.randomUUID());
        Long knowledgeBaseId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        assertThrows(DataAccessException.class, () -> jdbcTemplate.update("""
                INSERT INTO kb_document
                    (knowledge_base_id, file_name, file_type, file_size, storage_key, status)
                VALUES (?, 'invalid.txt', 'text/plain', 1, ?, 'INVALID')
                """, knowledgeBaseId, "constraint-test-" + UUID.randomUUID()));
    }

    /** 按建表顺序取表的全部列名。 */
    private List<String> columnsOf(String tableName) {
        return jdbcTemplate.queryForList("""
                SELECT COLUMN_NAME FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION
                """, String.class, tableName);
    }

    /** 取表注释。 */
    private String tableComment(String tableName) {
        return jdbcTemplate.queryForObject("""
                SELECT TABLE_COMMENT FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
                """, String.class, tableName);
    }

    /** 按建表顺序取表的全部列注释。 */
    private List<String> columnCommentsOf(String tableName) {
        return jdbcTemplate.queryForList("""
                SELECT COLUMN_COMMENT FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION
                """, String.class, tableName);
    }

    /** 从 information_schema 统计指定约束或索引是否存在。 */
    private int schemaObjectCount(String table, String nameColumn, String name) {
        String sql = "SELECT COUNT(*) FROM information_schema." + table
                + " WHERE TABLE_SCHEMA = DATABASE() AND " + nameColumn + " = ?";
        return jdbcTemplate.queryForObject(sql, Integer.class, name);
    }
}
