package com.voltmind.knowledge.entity;

/**
 * 文档处理状态。
 *
 * <p>取值与数据库的 CHECK 约束、以及前端的状态展示一一对应：
 * 新增或调整取值时必须同时改迁移脚本与前端，否则写入会被数据库拒绝。</p>
 */
public enum DocumentStatus {
    /** 已上传、尚未进入向量化，上传完成后的初始状态。 */
    PENDING,
    /** 正在切分与向量化。 */
    INDEXING,
    /** 向量化完成，可被检索。 */
    INDEXED,
    /** 处理失败，需要重新上传或重试。 */
    FAILED
}
