import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    // 5173 已被 ai-workspace 占用，这里错开端口
    port: 5174,
  },
  // 跨域由服务端 CORS 放行（ai-service 的 CORS_ALLOW_ORIGINS 默认已含本端口），
  // 前端用 VITE_API_BASE_URL 直连后端。
  // 若不想依赖 CORS，可改用下面的代理把 /api 转发到 Python AI 服务：
  // server: {
  //   proxy: {
  //     '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
  //   },
  // },
})
