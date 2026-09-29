package com.voltmind.knowledge.storage;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

/**
 * 文件存储抽象：把「文件放哪、怎么放」与业务逻辑隔开。
 *
 * <p>对外只交换逻辑存储键，不暴露绝对路径，因此实现可以替换成本地磁盘、
 * 对象存储等；数据库里保存的也只有存储键。</p>
 */
public interface FileStorage {
    /**
     * 保存上传的文件。
     *
     * @param file         上传的文件流
     * @param safeFileName 已通过校验的原始文件名，仅用于提取扩展名
     * @return 存储键与落盘后的实际大小
     */
    StoredFile store(MultipartFile file, String safeFileName);

    /** 按存储键读取文件内容，供下载或后续处理使用。 */
    Resource load(String storageKey);

    /** 按存储键删除文件；文件已不存在视作删除成功，不抛异常。 */
    void delete(String storageKey);

    /**
     * 保存结果。
     *
     * @param storageKey 存储键，需持久化到文档记录中
     * @param size       实际写入的字节数
     */
    record StoredFile(String storageKey, long size) {
    }
}
