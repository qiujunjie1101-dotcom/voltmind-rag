package com.voltmind.knowledge.storage;

/**
 * 文件存储层异常。
 *
 * <p>属于技术性故障：由业务层捕获后翻译成 {@code BusinessException} 再返回，
 * 不直接冒泡到接口层，避免把存储实现细节暴露给调用方。</p>
 */
public class FileStorageException extends RuntimeException {
    /** 保留原始异常作为 cause，便于在日志里定位存储层的真实原因。 */
    public FileStorageException(String message, Throwable cause) {
        super(message, cause);
    }
}
