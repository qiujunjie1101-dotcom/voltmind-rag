package com.voltmind.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 文件存储配置的装配入口。
 *
 * <p>显式开启 {@link StorageProperties} 的属性绑定，让 {@code voltmind.storage.*}
 * 与 {@code application.yml} 的层级一一对应，也便于在其他组件里直接注入。</p>
 */
@Configuration
@EnableConfigurationProperties(StorageProperties.class)
public class StorageConfig {
}
