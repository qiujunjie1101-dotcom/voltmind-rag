import { useDark, useToggle } from '@vueuse/core'

/**
 * 模块级单例：全站共享主题状态。
 * 写入 localStorage 并在用户未显式选择时跟随系统偏好，
 * 通过在 <html> 上增删 .dark 类驱动 Tailwind 深色变体。
 */
export const isDark = useDark({
  selector: 'html',
  attribute: 'class',
  valueDark: 'dark',
  valueLight: '',
})

export const toggleDark = useToggle(isDark)
