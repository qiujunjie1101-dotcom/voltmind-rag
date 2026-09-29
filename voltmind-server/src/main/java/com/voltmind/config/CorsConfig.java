package com.voltmind.config;

import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 跨域配置：只放行配置中列出的前端来源。
 *
 * <p>不使用通配符、也不开启 allowCredentials：接口不带 Cookie 鉴权，
 * 放宽来源只会让任意站点读到响应。放行的方法与请求头以前端实际用到的为准。</p>
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    /** 解析后的放行来源列表，配置项是逗号分隔的字符串。 */
    private final String[] allowedOrigins;

    /** 启动时解析配置：逐项去空白并丢弃空项，避免多余的逗号被当成空来源放行。 */
    public CorsConfig(@Value("${voltmind.cors.allowed-origins}") String allowedOrigins) {
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);
    }

    /**
     * 只对 {@code /api/**} 生效，探活接口不需要跨域。
     *
     * <p>PUT 与 DELETE 是知识库与文档管理用的：浏览器对这两个方法会先发预检请求，
     * 漏掉任一方法都会让界面的编辑与删除在浏览器里静默失败（命令行调用却正常）。</p>
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("Content-Type", "Accept")
                .maxAge(3600);
    }
}
