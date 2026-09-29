package com.voltmind.common;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 健康检查接口的契约测试：状态码、业务码与状态字段。
 *
 * <p>用 standaloneSetup 只挂载该控制器，不启动完整上下文，保证用例快速且不受数据库影响。</p>
 */
class HealthControllerTest {
    /** GET /health 返回 200，code 为 OK，data.status 为 UP。 */
    @Test
    void returnsRunningStatus() throws Exception {
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new HealthController()).build();
        mvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.status").value("UP"));
    }
}
