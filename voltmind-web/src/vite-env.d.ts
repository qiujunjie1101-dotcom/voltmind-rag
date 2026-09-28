/// <reference types="vite/client" />

/**
 * 声明本项目读取的环境变量。
 * 标成可选是刻意的：Vite 在变量缺失时不会报错，
 * 这样类型系统会强制调用处处理 undefined，而不是假装一定有值。
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_TIMEOUT_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
