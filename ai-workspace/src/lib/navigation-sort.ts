import { filterSortableNodes, realContentPaths, type NavNode } from './content'
import type { ReorderRequest } from './navigation-drag'
import { parseNavigationOrder, serializeNavigationOrder } from '../../scripts/navigation-order.mjs'

export const nodePath = (node: NavNode) => node.doc?.path || node.key.slice(1)
export const parentPath = (path: string) => path.split('/').slice(0, -1).join('/')
export function siblingsAt(nodes: NavNode[], parent: string): NavNode[] {
  if (!parent) return nodes
  for (const node of nodes) {
    if (!node.children) continue
    const path = nodePath(node)
    if (path === parent) return node.children
    if (parent.startsWith(path + '/')) return siblingsAt(node.children, parent)
  }
  return []
}
export function sortableSiblingsAt(nodes: NavNode[], parent: string, paths: ReadonlySet<string> = realContentPaths): NavNode[] {
  return filterSortableNodes(siblingsAt(nodes, parent), paths)
}
export type NavigationMove = 'move-up' | 'move-down' | 'move-first' | 'move-last'
export function resolveNavigationMove(nodes: NavNode[], source: string, direction: NavigationMove, paths: ReadonlySet<string> = realContentPaths): ReorderRequest | null {
  const siblings = sortableSiblingsAt(nodes, parentPath(source), paths)
  const index = siblings.findIndex(node => nodePath(node) === source)
  if (index < 0) throw new Error('目标文件或目录已变化，请重新读取目录后再调整。内置配置页不参与排序。')
  const before = direction === 'move-up' || direction === 'move-first'
  const targetIndex = direction === 'move-first' ? 0 : direction === 'move-last' ? siblings.length - 1 : index + (before ? -1 : 1)
  const target = siblings[targetIndex]
  return !target || targetIndex === index ? null : { source, target: nodePath(target), position: before ? 'before' : 'after' }
}
export function planNavigationOrder(nodes: NavNode[], request: ReorderRequest, raw: string | null, physicalPaths: Iterable<string> = realContentPaths) {
  const parent = parentPath(request.source)
  if (parent !== parentPath(request.target)) throw new Error('请在同一层级内调整顺序。')
  const real = new Set(physicalPaths)
  if (!real.has(request.source) || !real.has(request.target)) throw new Error('目标文件或目录已变化，请重新读取目录后再调整。内置配置页不参与排序。')
  const paths = sortableSiblingsAt(nodes, parent, real).map(nodePath)
  if (!paths.includes(request.source) || !paths.includes(request.target)) throw new Error('目标位置已变化，请重新读取目录后重试。')
  if (request.source === request.target) return null
  const next = paths.filter(path => path !== request.source)
  next.splice(next.indexOf(request.target) + (request.position === 'after' ? 1 : 0), 0, request.source)
  if (next.every((path, index) => path === paths[index])) return null
  const config = parseNavigationOrder(raw)
  config.order[parent] = next.map(path => path.split('/').at(-1)!)
  return serializeNavigationOrder(config)
}
