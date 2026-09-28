import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const contentDirectory = fileURLToPath(new URL('./src/content/', import.meta.url))
const contentModule = fileURLToPath(new URL('./src/lib/content.ts', import.meta.url))
export default defineConfig({
  plugins: [vue(), tailwindcss(), {
    name: 'ai2cc-content-hmr',
    // Route document create/update/delete events through the accepting library
    // module; a removed raw import must not cause a full-page reload mid-edit.
    hotUpdate: { order: 'post', handler({ file }) {
      if (!file.startsWith(contentDirectory)) return
      const modules = [...(this.environment.moduleGraph.getModulesByFile(contentModule) || [])]
      for (const module of modules) this.environment.moduleGraph.invalidateModule(module)
      return modules
    } },
  }],
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
