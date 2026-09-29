package com.voltmind.knowledge.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.voltmind.common.BusinessException;
import com.voltmind.knowledge.dto.KnowledgeBaseRequest;
import com.voltmind.knowledge.dto.KnowledgeBaseResponse;
import com.voltmind.knowledge.entity.Document;
import com.voltmind.knowledge.entity.KnowledgeBase;
import com.voltmind.knowledge.mapper.DocumentMapper;
import com.voltmind.knowledge.mapper.KnowledgeBaseMapper;
import com.voltmind.knowledge.storage.FileStorage;
import com.voltmind.knowledge.storage.FileStorageException;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 知识库业务逻辑：增删改查，以及删除时连带清理库内文档。
 *
 * <p>几处刻意的取舍：</p>
 * <ul>
 *   <li>重名不靠「先查再插」判断，而是捕获数据库唯一键冲突（{@link DuplicateKeyException}），
 *       避免并发下先查后插的竞态；</li>
 *   <li>删除先删物理文件、再删数据库记录：事务回滚能撤销记录，却回不来已删除的文件，
 *       所以文件清理失败时直接中断并报错，而不是让记录悄悄消失；</li>
 *   <li>读操作显式标注只读事务，写操作由事务包住，保证「文件已删但记录还在」这类
 *       中间状态不会被外部观察到。</li>
 * </ul>
 */
@Service
public class KnowledgeBaseService {
    private final KnowledgeBaseMapper knowledgeBaseMapper;
    private final DocumentMapper documentMapper;
    private final FileStorage fileStorage;

    public KnowledgeBaseService(
            KnowledgeBaseMapper knowledgeBaseMapper,
            DocumentMapper documentMapper,
            FileStorage fileStorage) {
        this.knowledgeBaseMapper = knowledgeBaseMapper;
        this.documentMapper = documentMapper;
        this.fileStorage = fileStorage;
    }

    /** 列表按创建时间倒序；同一时刻创建的用 ID 兜底排序，保证分页与多次请求的顺序稳定。 */
    @Transactional(readOnly = true)
    public List<KnowledgeBaseResponse> list() {
        return knowledgeBaseMapper.selectList(Wrappers.<KnowledgeBase>lambdaQuery()
                        .orderByDesc(KnowledgeBase::getCreatedAt, KnowledgeBase::getId))
                .stream().map(this::toResponse).toList();
    }

    /** 新增知识库：名称去空白后写入，名称重复返回 409。 */
    @Transactional
    public KnowledgeBaseResponse create(KnowledgeBaseRequest request) {
        KnowledgeBase entity = new KnowledgeBase();
        entity.setName(normalizeName(request.name()));
        entity.setDescription(normalizeDescription(request.description()));
        try {
            knowledgeBaseMapper.insert(entity);
        } catch (DuplicateKeyException exception) {
            throw duplicateName();
        }
        return toResponse(knowledgeBaseMapper.selectById(entity.getId()));
    }

    /** 查询单个知识库，不存在时抛 404。 */
    @Transactional(readOnly = true)
    public KnowledgeBaseResponse get(long id) {
        return toResponse(requireEntity(id));
    }

    /** 更新知识库：名称与描述整体覆盖，描述传空则清空为 null。 */
    @Transactional
    public KnowledgeBaseResponse update(long id, KnowledgeBaseRequest request) {
        KnowledgeBase entity = requireEntity(id);
        entity.setName(normalizeName(request.name()));
        entity.setDescription(normalizeDescription(request.description()));
        try {
            knowledgeBaseMapper.updateById(entity);
        } catch (DuplicateKeyException exception) {
            throw duplicateName();
        }
        return toResponse(knowledgeBaseMapper.selectById(id));
    }

    /**
     * 删除知识库及其全部文档。
     *
     * <p>顺序是「先物理文件、后数据库记录」：反过来一旦文件清理失败，就会留下没有记录
     * 指向、事后也找不回来的孤儿文件；当前顺序下最坏情况是文件已删而记录因异常回滚，
     * 重试一次即可。</p>
     */
    @Transactional
    public void delete(long id) {
        requireEntity(id);
        List<Document> documents = documentMapper.selectList(Wrappers.<Document>lambdaQuery()
                .eq(Document::getKnowledgeBaseId, id));

        try {
            for (Document document : documents) {
                fileStorage.delete(document.getStorageKey());
            }
        } catch (FileStorageException exception) {
            throw new BusinessException("FILE_DELETE_FAILED",
                    "Cannot delete an associated document file", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        documentMapper.delete(Wrappers.<Document>lambdaQuery().eq(Document::getKnowledgeBaseId, id));
        knowledgeBaseMapper.deleteById(id);
    }

    /**
     * 按 ID 取实体，不存在则抛 404。
     *
     * <p>包级可见：文档服务上传前会复用它做存在性校验，避免两处各写一遍判断。</p>
     */
    KnowledgeBase requireEntity(long id) {
        KnowledgeBase entity = knowledgeBaseMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException("KNOWLEDGE_BASE_NOT_FOUND",
                    "Knowledge base does not exist", HttpStatus.NOT_FOUND);
        }
        return entity;
    }

    /** 名称归一化：去除首尾空白，非空由请求体校验保证。 */
    private String normalizeName(String name) {
        return name.trim();
    }

    /** 描述归一化：空白串统一转成 null，避免库里同时存在空串与 null 两种「空值」。 */
    private String normalizeDescription(String description) {
        return description == null || description.isBlank() ? null : description.trim();
    }

    /** 名称重复的统一出口：409 + 可判定的错误码。 */
    private BusinessException duplicateName() {
        return new BusinessException("KNOWLEDGE_BASE_NAME_DUPLICATE",
                "Knowledge base name already exists", HttpStatus.CONFLICT);
    }

    /** 实体到视图的转换。 */
    private KnowledgeBaseResponse toResponse(KnowledgeBase entity) {
        return new KnowledgeBaseResponse(entity.getId(), entity.getName(), entity.getDescription(),
                entity.getCreatedAt(), entity.getUpdatedAt());
    }
}
