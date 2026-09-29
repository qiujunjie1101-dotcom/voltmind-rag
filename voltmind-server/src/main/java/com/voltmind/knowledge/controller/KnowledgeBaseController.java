package com.voltmind.knowledge.controller;

import com.voltmind.common.ApiResponse;
import com.voltmind.knowledge.dto.KnowledgeBaseRequest;
import com.voltmind.knowledge.dto.KnowledgeBaseResponse;
import com.voltmind.knowledge.service.KnowledgeBaseService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 知识库接口：列表、新增、详情、更新与删除。
 *
 * <p>请求体用 {@code @Valid} 触发 DTO 上的字段校验；控制器不判断业务分支，
 * 重名、找不到等结果都由服务层抛出的业务异常统一转换。</p>
 */
@Validated
@RestController
@RequestMapping("/api/v1/knowledge-bases")
public class KnowledgeBaseController {
    private final KnowledgeBaseService service;

    public KnowledgeBaseController(KnowledgeBaseService service) {
        this.service = service;
    }

    /** 列出全部知识库，按创建时间倒序。 */
    @GetMapping
    public ApiResponse<List<KnowledgeBaseResponse>> list() {
        return ApiResponse.success(service.list());
    }

    /** 新增知识库；名称必填且唯一，重名返回 409。 */
    @PostMapping
    public ApiResponse<KnowledgeBaseResponse> create(@Valid @RequestBody KnowledgeBaseRequest request) {
        return ApiResponse.success(service.create(request));
    }

    /** 查询单个知识库，不存在返回 404。 */
    @GetMapping("/{id}")
    public ApiResponse<KnowledgeBaseResponse> get(@PathVariable @Positive long id) {
        return ApiResponse.success(service.get(id));
    }

    /** 更新知识库：名称与描述整体覆盖，传空的描述会被清空。 */
    @PutMapping("/{id}")
    public ApiResponse<KnowledgeBaseResponse> update(
            @PathVariable @Positive long id,
            @Valid @RequestBody KnowledgeBaseRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    /** 删除知识库：连带删除库内文档记录与其物理文件。 */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable @Positive long id) {
        service.delete(id);
        return ApiResponse.success(null);
    }
}
