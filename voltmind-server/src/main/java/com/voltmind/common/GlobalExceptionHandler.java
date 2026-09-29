package com.voltmind.common;

import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

/**
 * 全局异常处理：把各类异常统一翻译成 {@link ApiResponse} 结构。
 *
 * <p>处理顺序按「具体到宽泛」排列：业务异常与已知的框架异常各自成条，
 * 末尾的兜底处理器保证任何未预期异常都不会把堆栈或内部细节返回给调用方。</p>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** 业务异常：直接采用异常自带的错误码与 HTTP 状态码。 */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> businessError(BusinessException exception) {
        return ResponseEntity.status(exception.getStatus())
                .body(ApiResponse.error(exception.getCode(), exception.getMessage()));
    }

    /**
     * 参数与请求体异常，统一归为 INVALID_ARGUMENT。
     *
     * <p>方法参数校验失败、请求体无法解析、缺少 multipart 部件，对调用方而言都是
     * 「请求不合法」，因此合并成一个错误码，避免调用方依赖框架的异常类型做分支；
     * 具体哪一项不合法由调用方按接口契约自查，这里不回显内部校验细节。</p>
     */
    @ExceptionHandler({MethodArgumentNotValidException.class, ConstraintViolationException.class,
            HttpMessageNotReadableException.class, MissingServletRequestPartException.class})
    public ResponseEntity<ApiResponse<Void>> invalidInput(Exception exception) {
        return ResponseEntity.badRequest().body(ApiResponse.error("INVALID_ARGUMENT", "Invalid request parameters"));
    }

    /**
     * 上传体积超限。
     *
     * <p>Spring 在解析 multipart 阶段就按 multipart 配置拦截，早于业务层按
     * {@code storage.max-file-size} 做的校验；两处错误码保持一致，调用方无需区分是谁拦下的。</p>
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> fileTooLarge(MaxUploadSizeExceededException exception) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(ApiResponse.error("FILE_TOO_LARGE", "File exceeds the configured size limit"));
    }

    /** 兜底处理：记录完整堆栈便于排查，对外只返回通用错误，避免泄漏内部实现。 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> unexpected(Exception exception) {
        log.error("Unhandled request failure", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("INTERNAL_ERROR", "Internal server error"));
    }
}
