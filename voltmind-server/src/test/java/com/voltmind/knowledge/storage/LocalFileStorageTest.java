package com.voltmind.knowledge.storage;

import com.voltmind.config.StorageProperties;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 本地文件存储的读写测试。
 *
 * <p>根目录用 JUnit 的临时目录，既不依赖真实存储路径，也不会污染本机已有文件。</p>
 */
class LocalFileStorageTest {
    /** 每个用例独立的临时根目录，由 JUnit 负责创建与清理。 */
    @TempDir
    Path root;

    private LocalFileStorage storage;

    /** 用最小可用配置重新构造存储实例，避免用例之间互相影响。 */
    @BeforeEach
    void setUp() {
        StorageProperties properties = new StorageProperties();
        properties.setRoot(root);
        properties.setMaxFileSizeBytes(1024);
        storage = new LocalFileStorage(properties);
    }

    /** 存 → 读 → 删的完整往返：读出的内容逐字节一致，删除后文件不存在。 */
    @Test
    void storesLoadsAndDeletesFile() throws Exception {
        byte[] content = "storage test".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile("file", "notes.txt", "text/plain", content);

        FileStorage.StoredFile stored = storage.store(file, "notes.txt");

        assertTrue(storage.load(stored.storageKey()).exists());
        assertArrayEquals(content, storage.load(stored.storageKey()).getContentAsByteArray());
        storage.delete(stored.storageKey());
        assertFalse(storage.load(stored.storageKey()).exists());
    }

    /** 存储键试图跳出根目录时必须拒绝：读取与删除两条路径都要挡住目录穿越。 */
    @Test
    void rejectsStorageKeyOutsideConfiguredRoot() {
        assertThrows(FileStorageException.class, () -> storage.load("../outside.txt"));
        assertThrows(FileStorageException.class, () -> storage.delete("../outside.txt"));
    }
}
