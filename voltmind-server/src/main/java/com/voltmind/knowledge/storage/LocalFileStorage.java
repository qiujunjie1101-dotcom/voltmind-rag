package com.voltmind.knowledge.storage;

import com.voltmind.config.StorageProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * 本地磁盘存储实现，文件落在配置的存储根目录下。
 *
 * <p>落盘结构为「两层分片 + 随机文件名」：{@code <UUID 前两位>/<UUID><扩展名>}。
 * 用随机名而不是原始文件名，可以一次避免同名覆盖、路径穿越与文件名注入；
 * 分片则是为了不让单个目录堆积过多文件。</p>
 */
@Component
public class LocalFileStorage implements FileStorage {
    /** 存储根目录的绝对规范路径，所有存储键都相对它解析。 */
    private final Path root;

    /**
     * 启动时解析并创建根目录。
     *
     * <p>目录不可创建时直接让应用启动失败，比等到第一次上传才报错更容易定位配置问题。</p>
     */
    public LocalFileStorage(StorageProperties properties) {
        this.root = properties.getRoot().toAbsolutePath().normalize();
        try {
            Files.createDirectories(root);
        } catch (IOException exception) {
            throw new FileStorageException("Cannot initialize local storage", exception);
        }
    }

    /**
     * 保存文件：先建分片目录再落盘，失败时清理半成品。
     *
     * <p>返回的 size 取自落盘后的实际大小，而不是上传请求声明的长度。</p>
     */
    @Override
    public StoredFile store(MultipartFile file, String safeFileName) {
        String extension = extensionOf(safeFileName);
        String identifier = UUID.randomUUID().toString();
        String storageKey = identifier.substring(0, 2) + "/" + identifier + extension;
        Path target = resolve(storageKey);
        try {
            Files.createDirectories(target.getParent());
            Files.copy(file.getInputStream(), target);
            return new StoredFile(storageKey, Files.size(target));
        } catch (IOException exception) {
            // 写入失败时尽量删掉残留文件，避免只留下半份文件却没有数据库记录
            try {
                Files.deleteIfExists(target);
            } catch (IOException cleanupException) {
                exception.addSuppressed(cleanupException);
            }
            throw new FileStorageException("Cannot store file", exception);
        }
    }

    /** 读取文件内容，交由调用方决定怎么用（下载、解析等）。 */
    @Override
    public Resource load(String storageKey) {
        Path path = resolve(storageKey);
        try {
            return new UrlResource(path.toUri());
        } catch (IOException exception) {
            throw new FileStorageException("Cannot load file", exception);
        }
    }

    /**
     * 删除文件，并在分片目录空了之后顺手删掉它。
     *
     * <p>分片目录删除失败是正常情况（里面还有同分片的其他文件），因此单独吞掉该异常，
     * 不影响删除主流程；文件本身不存在也按成功处理，保证删除语义幂等。</p>
     */
    @Override
    public void delete(String storageKey) {
        Path path = resolve(storageKey);
        try {
            Files.deleteIfExists(path);
            Path parent = path.getParent();
            if (!parent.equals(root)) {
                try {
                    Files.delete(parent);
                } catch (IOException ignored) {
                    // The shard directory still contains another file.
                }
            }
        } catch (IOException exception) {
            throw new FileStorageException("Cannot delete file", exception);
        }
    }

    /**
     * 把存储键解析成绝对路径，并挡住目录穿越。
     *
     * <p>规范化解出的路径必须仍位于根目录内，否则说明存储键里带了 {@code ..}
     * 之类的相对片段，属于非法输入，直接拒绝而不是「尽量修正」。</p>
     */
    private Path resolve(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            throw new FileStorageException("Invalid storage key", new IllegalArgumentException("blank key"));
        }
        Path path = root.resolve(storageKey).normalize();
        if (!path.startsWith(root)) {
            throw new FileStorageException("Invalid storage key", new IllegalArgumentException("path escape"));
        }
        return path;
    }

    /** 取文件扩展名（含点号）并统一成小写；没有扩展名时返回空串。 */
    private String extensionOf(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot < 0 ? "" : fileName.substring(dot).toLowerCase(Locale.ROOT);
    }
}
