package com.voltmind.common;

/**
 * 统一响应结构：所有接口都返回 code / message / data 三段。
 *
 * <p>成功时 {@code code} 固定为 {@code OK}，业务失败时为可判定的错误码（见各业务异常），
 * 调用方据此区分「请求成功但业务失败」与「网络或服务级故障」；失败时 {@code data} 恒为 null。</p>
 *
 * @param code    业务状态码，成功为 OK
 * @param message 说明文本，成功为 success，失败为错误描述
 * @param data    业务数据，失败时为 null
 */
public record ApiResponse<T>(String code, String message, T data) {
    /** 成功响应：业务数据放在 data 中。 */
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>("OK", "success", data);
    }

    /** 失败响应：只带错误码与说明，不返回数据。 */
    public static ApiResponse<Void> error(String code, String message) {
        return new ApiResponse<>(code, message, null);
    }
}
