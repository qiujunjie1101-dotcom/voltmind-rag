package com.voltmind;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * VoltMind 业务服务启动类。
 *
 * <p>承载知识库与文档管理的 REST 接口：持久化用 MySQL（MyBatis-Plus），
 * 表结构由 Flyway 迁移脚本维护；向量化与检索等能力由 Python AI 服务提供，
 * 两者的职责边界与接口约定见 workspace 的接口契约文档。</p>
 */
@SpringBootApplication
public class VoltMindApplication {
    public static void main(String[] args) {
        SpringApplication.run(VoltMindApplication.class, args);
    }
}
