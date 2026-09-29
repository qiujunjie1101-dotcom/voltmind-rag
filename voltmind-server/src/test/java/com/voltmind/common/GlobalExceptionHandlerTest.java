package com.voltmind.common;

import jakarta.validation.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * 全局异常处理器的行为测试：核心是确认异常细节不会泄漏给调用方。
 */
class GlobalExceptionHandlerTest {
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    /** 参数校验失败：只回通用错误码与固定说明，不回显触发异常的原始输入。 */
    @Test
    void validationErrorDoesNotExposeDetails() {
        var response = handler.invalidInput(new ConstraintViolationException("sensitive input", null));
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("INVALID_ARGUMENT", response.getBody().code());
        assertNull(response.getBody().data());
    }

    /** 未预期异常：对外只回固定文案，内部细节只写日志。 */
    @Test
    void unexpectedErrorDoesNotExposeDetails() {
        var response = handler.unexpected(new IllegalStateException("sensitive internal detail"));
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals("Internal server error", response.getBody().message());
    }
}
