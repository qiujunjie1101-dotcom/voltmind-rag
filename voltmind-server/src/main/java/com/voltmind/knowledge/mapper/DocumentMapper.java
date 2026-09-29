package com.voltmind.knowledge.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.voltmind.knowledge.entity.Document;

/**
 * 文档表的数据访问接口。
 *
 * <p>只继承 MyBatis-Plus 的通用 CRUD，接口里不声明自定义方法：
 * 当前所有查询条件都在业务层用 {@code Wrappers.lambdaQuery()} 拼装，
 * 需要复杂 SQL 时再在这里补充。</p>
 */
public interface DocumentMapper extends BaseMapper<Document> {
}
