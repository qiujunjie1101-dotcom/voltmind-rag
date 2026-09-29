package com.voltmind.config;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

/**
 * MyBatis-Plus 配置：当前只声明 Mapper 接口的扫描路径。
 *
 * <p>分页、乐观锁等插件尚未使用，等确有需要时再在这里注册，
 * 避免引入用不到、却会改变 SQL 行为的拦截器。</p>
 */
@Configuration
@MapperScan("com.voltmind.knowledge.mapper")
public class MybatisPlusConfig {
}
