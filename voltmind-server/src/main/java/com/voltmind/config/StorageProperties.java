package com.voltmind.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 文件存储配置项，对应 {@code voltmind.storage.*}。
 *
 * <p>用 {@code @Validated} 加约束：配置缺失或取值非法时应用启动即失败，
 * 不会拖到运行期某个上传请求才暴露。</p>
 */
@Validated
@ConfigurationProperties(prefix = "voltmind.storage")
public class StorageProperties {
    /** 文件落盘的根目录，相对路径以进程工作目录为基准。 */
    @NotNull
    private Path root;

    /** 单个文件的字节上限，业务层据此在落盘前拦掉超大文件。 */
    @Min(1)
    private long maxFileSizeBytes;

    public Path getRoot() {
        return root;
    }

    public void setRoot(Path root) {
        this.root = root;
    }

    public long getMaxFileSizeBytes() {
        return maxFileSizeBytes;
    }

    public void setMaxFileSizeBytes(long maxFileSizeBytes) {
        this.maxFileSizeBytes = maxFileSizeBytes;
    }
}
