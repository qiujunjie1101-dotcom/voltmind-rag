package com.voltmind.common;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 健康检查接口，供探活与部署冒烟使用。
 *
 * <p>只反映进程自身状态，不探测数据库、文件存储等外部依赖：
 * 依赖不可用时应用可能仍能启动，探活语义与「依赖就绪」不同，不在此处混淆。</p>
 */
@RestController
public class HealthController {
    /** GET /health：连得上即说明服务进程可用，返回固定状态 UP。 */
    @GetMapping("/health")
    public ApiResponse<HealthStatus> health() {
        return ApiResponse.success(new HealthStatus("UP"));
    }

    /** 健康状态载荷。 */
    public record HealthStatus(String status) {
    }
}
