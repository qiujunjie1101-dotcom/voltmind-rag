export const MAX_NAVIGATION_BYTES = 256 * 1024
const forbiddenNames = new Set(['__proto__', 'prototype', 'constructor'])
const fail = message => { throw new Error(`导航排序配置无效：${message}`) }
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
function name(value) {
  if (typeof value !== 'string' || !value || value.length > 120 || value !== value.trim() || value.startsWith('.') || /[\\/<>:"|?*\x00-\x1f\x7f]/.test(value) || /[. ]$/.test(value) || forbiddenNames.has(value)) fail('名称包含无效字符或保留名称。')
}
function parentPath(value) {
  if (value === '') return
  if (value.length > 2048) fail('目录路径过长。')
  const parts = value.split('/')
  if (parts.length > 30) fail('目录层级过深。')
  parts.forEach(name)
}
export function parseNavigationOrder(raw) {
  const order = Object.create(null)
  if (raw === null) return { version: 1, order }
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > MAX_NAVIGATION_BYTES) fail('文件不能超过 256 KiB。')
  let parsed
  try { parsed = JSON.parse(raw) } catch { fail('必须为有效 JSON。') }
  if (!object(parsed) || parsed.version !== 1 || Object.keys(parsed).some(key => !['version', 'order'].includes(key)) || !object(parsed.order)) fail('应包含 version: 1 和 order 对象。')
  for (const [parent, children] of Object.entries(parsed.order)) {
    parentPath(parent)
    if (!Array.isArray(children)) fail('同级顺序必须为名称数组。')
    children.forEach(name)
    if (new Set(children).size !== children.length) fail('同一目录不能重复列出子项。')
    order[parent] = [...children]
  }
  return { version: 1, order }
}
export function serializeNavigationOrder(value) {
  const validated = parseNavigationOrder(JSON.stringify(value))
  const order = Object.create(null)
  for (const parent of Object.keys(validated.order).sort()) order[parent] = validated.order[parent]
  const raw = JSON.stringify({ version: 1, order }, null, 2) + '\n'
  parseNavigationOrder(raw)
  return raw
}
