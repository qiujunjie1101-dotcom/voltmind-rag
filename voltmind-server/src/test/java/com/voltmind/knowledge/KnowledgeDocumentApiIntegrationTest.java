package com.voltmind.knowledge;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 知识库与文档接口的端到端测试。
 *
 * <p>用 MockMvc 走完整请求链路（含参数校验、CORS 预检、异常处理与响应包装），
 * 数据库用真实连接、文件写入临时目录：存储根目录与大小上限通过
 * {@code @DynamicPropertySource} 注入，每个用例结束清空目录、整个类结束删除目录，
 * 因此不会碰到本机真实的存储目录。</p>
 *
 * <p>类级别 {@code @Transactional} 让数据库改动随用例回滚；所有名称都用随机后缀，
 * 避免用例之间与重复执行时相互干扰。</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class KnowledgeDocumentApiIntegrationTest {
    /** 本类专用的临时存储根目录，进程内所有用例共用，事后统一清理。 */
    private static final Path STORAGE_ROOT = createStorageRoot();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    /** 把存储配置指向临时目录，并把文件上限压到 1024 字节，便于用极小文件测超限分支。 */
    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registry.add("voltmind.storage.root", () -> STORAGE_ROOT.toString());
        registry.add("voltmind.storage.max-file-size-bytes", () -> 1024);
    }

    /** 每个用例后清空临时目录：文件系统不随事务回滚，需要手动复位。 */
    @AfterEach
    void cleanTemporaryFiles() throws IOException {
        deleteChildren(STORAGE_ROOT);
    }

    /** 整个类跑完后连临时根目录一起删掉。 */
    @AfterAll
    static void removeTemporaryStorage() throws IOException {
        deleteChildren(STORAGE_ROOT);
        Files.deleteIfExists(STORAGE_ROOT);
    }

    /** 新增知识库：名称首尾空白被去除后入库，描述原样保存。 */
    @Test
    void createsKnowledgeBaseAndTrimsName() throws Exception {
        String name = uniqueName();
        mockMvc.perform(post("/api/v1/knowledge-bases")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("  " + name + "  ", "description")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.name").value(name))
                .andExpect(jsonPath("$.data.description").value("description"));
    }

    /** CORS 预检：配置里放行的来源能拿到对应的 Allow-Origin 头。 */
    @Test
    void allowsConfiguredFrontendOrigin() throws Exception {
        mockMvc.perform(options("/api/v1/knowledge-bases")
                        .header("Origin", "http://127.0.0.1:5174")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(result -> org.junit.jupiter.api.Assertions.assertEquals(
                        "http://127.0.0.1:5174",
                        result.getResponse().getHeader("Access-Control-Allow-Origin")));
    }

    /** CORS 预检：未放行来源直接被拒，避免任意站点读到接口响应。 */
    @Test
    void rejectsUnconfiguredFrontendOrigin() throws Exception {
        mockMvc.perform(options("/api/v1/knowledge-bases")
                        .header("Origin", "http://malicious.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }

    /** 列表返回数组，且包含刚创建的知识库。 */
    @Test
    void listsKnowledgeBases() throws Exception {
        String name = uniqueName();
        createKnowledgeBase(name);
        mockMvc.perform(get("/api/v1/knowledge-bases"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[?(@.name == '" + name + "')]").exists());
    }

    /** 更新知识库：名称与描述都被新值覆盖。 */
    @Test
    void updatesKnowledgeBase() throws Exception {
        long id = createKnowledgeBase(uniqueName());
        String updated = uniqueName();
        mockMvc.perform(put("/api/v1/knowledge-bases/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(updated, "updated")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value(updated))
                .andExpect(jsonPath("$.data.description").value("updated"));
    }

    /** 重名创建返回 409：唯一约束冲突被翻译成可判定的错误码。 */
    @Test
    void rejectsDuplicateKnowledgeBaseName() throws Exception {
        String name = uniqueName();
        createKnowledgeBase(name);
        mockMvc.perform(post("/api/v1/knowledge-bases")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(" " + name + " ", null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("KNOWLEDGE_BASE_NAME_DUPLICATE"));
    }

    /** 查询不存在的知识库返回 404 与对应错误码。 */
    @Test
    void reportsMissingKnowledgeBase() throws Exception {
        mockMvc.perform(get("/api/v1/knowledge-bases/{id}", Long.MAX_VALUE))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("KNOWLEDGE_BASE_NOT_FOUND"));
    }

    /** 删除后同一 ID 再查返回 404，确认记录确实消失。 */
    @Test
    void deletesKnowledgeBase() throws Exception {
        long id = createKnowledgeBase(uniqueName());
        mockMvc.perform(delete("/api/v1/knowledge-bases/{id}", id))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/knowledge-bases/{id}", id))
                .andExpect(status().isNotFound());
    }

    /** 上传成功：文件真实落盘、状态为 PENDING，且落盘名不含原始文件名（防覆盖与注入）。 */
    @Test
    void uploadsDocumentWithPendingStatus() throws Exception {
        long knowledgeBaseId = createKnowledgeBase(uniqueName());
        JsonNode document = uploadTextDocument(knowledgeBaseId, "notes.txt", "hello");
        assertTrue(Files.exists(STORAGE_ROOT.resolve(document.path("storageKey").asText())));
        assertTrue(document.path("id").asLong() > 0);
        assertFalse(document.path("storageKey").asText().contains("notes"));
    }

    /** 白名单内的五种扩展名配对应 MIME 都应被接受，上传后状态为 PENDING。 */
    @ParameterizedTest
    @CsvSource({
            "manual.pdf,application/pdf",
            "manual.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "manual.md,text/markdown",
            "manual.markdown,text/markdown",
            "manual.txt,text/plain"
    })
    void acceptsEverySupportedFileType(String fileName, String contentType) throws Exception {
        long knowledgeBaseId = createKnowledgeBase(uniqueName());
        MockMultipartFile file = new MockMultipartFile("file", fileName, contentType, new byte[]{1});
        mockMvc.perform(multipart("/api/v1/knowledge-bases/{id}/documents", knowledgeBaseId).file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fileName").value(fileName))
                .andExpect(jsonPath("$.data.status").value("PENDING"));
    }

    /** 文件名带 {@code ..} 的路径穿越尝试被拒，且不会留下任何文件。 */
    @Test
    void rejectsUnsafeFileName() throws Exception {
        long knowledgeBaseId = createKnowledgeBase(uniqueName());
        MockMultipartFile file = new MockMultipartFile("file", "../escape.txt", "text/plain", new byte[]{1});
        mockMvc.perform(multipart("/api/v1/knowledge-bases/{id}/documents", knowledgeBaseId).file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILE_NAME"));
        assertStorageIsEmpty();
    }

    /** 空文件被拒：校验发生在落盘之前。 */
    @Test
    void rejectsEmptyFile() throws Exception {
        long knowledgeBaseId = createKnowledgeBase(uniqueName());
        MockMultipartFile file = new MockMultipartFile("file", "empty.txt", "text/plain", new byte[0]);
        mockMvc.perform(multipart("/api/v1/knowledge-bases/{id}/documents", knowledgeBaseId).file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EMPTY_FILE"));
    }

    /** 扩展名不在白名单（.exe）返回 415，即使 MIME 是 octet-stream 也不放行。 */
    @Test
    void rejectsUnsupportedFileType() throws Exception {
        long knowledgeBaseId = createKnowledgeBase(uniqueName());
        MockMultipartFile file = new MockMultipartFile("file", "script.exe",
                "application/octet-stream", new byte[]{1});
        mockMvc.perform(multipart("/api/v1/knowledge-bases/{id}/documents", knowledgeBaseId).file(file))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"));
    }

    /** 往不存在的知识库上传返回 404，并且不会留下已落盘的文件。 */
    @Test
    void rejectsUploadForMissingKnowledgeBase() throws Exception {
        MockMultipartFile file = textFile("missing.txt", "content");
        mockMvc.perform(multipart("/api/v1/knowledge-bases/{id}/documents", Long.MAX_VALUE).file(file))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("KNOWLEDGE_BASE_NOT_FOUND"));
        assertStorageIsEmpty();
    }

    /** 列表返回该知识库下的文档，且顺序稳定（最新在前）。 */
    @Test
    void listsKnowledgeBaseDocuments() throws Exception {
        long knowledgeBaseId = createKnowledgeBase(uniqueName());
        JsonNode uploaded = uploadTextDocument(knowledgeBaseId, "list.txt", "content");
        mockMvc.perform(get("/api/v1/knowledge-bases/{id}/documents", knowledgeBaseId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(uploaded.path("id").asLong()))
                .andExpect(jsonPath("$.data[0].status").value("PENDING"));
    }

    /** 删除文档：物理文件与数据库记录同时消失。 */
    @Test
    void deletesDocumentRecordAndFile() throws Exception {
        long knowledgeBaseId = createKnowledgeBase(uniqueName());
        JsonNode document = uploadTextDocument(knowledgeBaseId, "delete.txt", "content");
        Path stored = STORAGE_ROOT.resolve(document.path("storageKey").asText());
        mockMvc.perform(delete("/api/v1/documents/{id}", document.path("id").asLong()))
                .andExpect(status().isOk());
        assertFalse(Files.exists(stored));
        mockMvc.perform(get("/api/v1/documents/{id}", document.path("id").asLong()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("DOCUMENT_NOT_FOUND"));
    }

    /** 超过配置上限（此处 1024 字节）的文件返回 413。 */
    @Test
    void rejectsFileLargerThanConfiguredLimit() throws Exception {
        long knowledgeBaseId = createKnowledgeBase(uniqueName());
        MockMultipartFile file = new MockMultipartFile("file", "large.txt", "text/plain", new byte[1025]);
        mockMvc.perform(multipart("/api/v1/knowledge-bases/{id}/documents", knowledgeBaseId).file(file))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"));
    }

    /** 删除知识库时连带删除库内多份文档的物理文件与记录。 */
    @Test
    void deletingKnowledgeBaseDeletesAssociatedFiles() throws Exception {
        long knowledgeBaseId = createKnowledgeBase(uniqueName());
        JsonNode first = uploadTextDocument(knowledgeBaseId, "first.txt", "first");
        JsonNode second = uploadTextDocument(knowledgeBaseId, "second.md", "second");
        Path firstPath = STORAGE_ROOT.resolve(first.path("storageKey").asText());
        Path secondPath = STORAGE_ROOT.resolve(second.path("storageKey").asText());

        mockMvc.perform(delete("/api/v1/knowledge-bases/{id}", knowledgeBaseId))
                .andExpect(status().isOk());
        assertFalse(Files.exists(firstPath));
        assertFalse(Files.exists(secondPath));
        mockMvc.perform(get("/api/v1/documents/{id}", first.path("id").asLong()))
                .andExpect(status().isNotFound());
    }

    /** 建一个知识库并返回其 ID，供各用例准备数据。 */
    private long createKnowledgeBase(String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/knowledge-bases")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(name, null)))
                .andExpect(status().isOk())
                .andReturn();
        return responseData(result).path("id").asLong();
    }

    /** 上传一份文本文件，并顺带断言「新上传必然是 PENDING 且分块数为 0」。 */
    private JsonNode uploadTextDocument(long knowledgeBaseId, String name, String content) throws Exception {
        MvcResult result = mockMvc.perform(multipart("/api/v1/knowledge-bases/{id}/documents", knowledgeBaseId)
                        .file(textFile(name, content)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.chunkCount").value(0))
                .andReturn();
        return responseData(result);
    }

    /** 按扩展名推断 MIME 造一个上传文件。 */
    private MockMultipartFile textFile(String name, String content) {
        String contentType = name.endsWith(".md") ? "text/markdown" : "text/plain";
        return new MockMultipartFile("file", name, contentType, content.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    /** 从响应体里取出 data 节点。 */
    private JsonNode responseData(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray()).path("data");
    }

    /** 构造知识库请求体；描述为 null 时发送空串，用于覆盖「清空描述」的场景。 */
    private String json(String name, String description) throws Exception {
        return objectMapper.writeValueAsString(java.util.Map.of(
                "name", name,
                "description", description == null ? "" : description));
    }

    /** 随机名称，避免用例之间与重复执行时命中唯一约束。 */
    private String uniqueName() {
        return "api-test-" + UUID.randomUUID();
    }

    /** 断言临时存储目录为空：用于验证被拒的上传没有留下任何文件。 */
    private void assertStorageIsEmpty() throws IOException {
        try (var entries = Files.list(STORAGE_ROOT)) {
            assertTrue(entries.findAny().isEmpty());
        }
    }

    /** 为该测试类创建一个独立临时根目录。 */
    private static Path createStorageRoot() {
        try {
            return Files.createTempDirectory("voltmind-r1-2-");
        } catch (IOException exception) {
            throw new ExceptionInInitializerError(exception);
        }
    }

    /** 删除目录下的全部内容但保留根目录本身；目录不存在时直接返回。 */
    private static void deleteChildren(Path root) throws IOException {
        if (!Files.exists(root)) {
            return;
        }
        try (var paths = Files.walk(root)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                if (!path.equals(root)) {
                    Files.deleteIfExists(path);
                }
            }
        }
    }
}
