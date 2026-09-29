package com.voltmind.knowledge.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.voltmind.knowledge.entity.KnowledgeBase;

/**
 * 知识库表的数据访问接口。
 *
 * <p>只继承 MyBatis-Plus 的通用 CRUD，查询条件在业务层拼装，
 * 保持数据访问层与业务规则分离。</p>
 */
public interface KnowledgeBaseMapper extends BaseMapper<KnowledgeBase> {
}
