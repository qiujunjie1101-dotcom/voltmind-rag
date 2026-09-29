package com.voltmind.knowledge.controller;

import com.voltmind.common.ApiResponse;
import com.voltmind.knowledge.dto.DocumentResponse;
import com.voltmind.knowledge.service.DocumentService;
import jakarta.validation.constraints.Positive;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 文档接口：上传、列表、详情与删除。
 *
 * <p>控制器只负责参数绑定与响应包装，业务规则、错误码与 HTTP 状态都由服务层决定。
 * 路径参数用 {@code @Positive} 约束，配合类上的 {@code @Validated}，
 * 让 id 为 0 或负数的请求在进入业务逻辑前就被拒掉。</p>
 */
@Validated
@RestController
@RequestMapping("/api/v1")
public class DocumentController {
    private final DocumentService service;

    public DocumentController(DocumentService service) {
        this.service = service;
    }

    /**
     * 上传文档，请求体为 multipart/form-data，文件字段名为 {@code file}。
     *
     * <p>{@code consumes} 明确限定为 multipart，避免其他内容类型的请求落到本方法上。</p>
     */
    @PostMapping(value = "/knowledge-bases/{id}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<DocumentResponse> upload(
            @PathVariable @Positive long id,
            @RequestPart("file") MultipartFile file) {
        return ApiResponse.success(service.upload(id, file));
    }

    /** 列出指定知识库下的文档；知识库不存在时返回 404。 */
    @GetMapping("/knowledge-bases/{id}/documents")
    public ApiResponse<List<DocumentResponse>> list(@PathVariable @Positive long id) {
        return ApiResponse.success(service.list(id));
    }

    /** 查询单个文档详情。 */
    @GetMapping("/documents/{id}")
    public ApiResponse<DocumentResponse> get(@PathVariable @Positive long id) {
        return ApiResponse.success(service.get(id));
    }

    /** 删除文档；成功时返回成功状态，data 为 null。 */
    @DeleteMapping("/documents/{id}")
    public ApiResponse<Void> delete(@PathVariable @Positive long id) {
        service.delete(id);
        return ApiResponse.success(null);
    }
}
