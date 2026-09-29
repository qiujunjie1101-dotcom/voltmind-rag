package com.voltmind.common;

import org.springframework.http.HttpStatus;

/**
 * 业务异常：把「错误码 + HTTP 状态码 + 说明」捆在一起抛出。
 *
 * <p>服务层只负责抛出，响应状态码由 {@link GlobalExceptionHandler} 统一写入，
 * 因此业务代码里不会出现 ResponseEntity 等 Web 类型。</p>
 */
public class BusinessException extends RuntimeException {
    /** 业务错误码，调用方按它做分支判断；调整取值需评估对既有调用方的兼容性。 */
    private final String code;
    /** 该错误对应的 HTTP 状态码，由全局异常处理器写入响应。 */
    private final HttpStatus status;

    public BusinessException(String code, String message, HttpStatus status) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public String getCode() {
        return code;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
