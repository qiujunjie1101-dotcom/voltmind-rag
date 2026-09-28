import { reactive } from 'vue'

export interface ReorderRequest {
  source: string
  target: string
  position: 'before' | 'after'
}

/** One drag session shared by every level of the recursive navigation tree. */
export const navigationDrag = reactive<{
  source: string
  target: string
  position: ReorderRequest['position'] | null
}>({ source: '', target: '', position: null })

let scrollContainer: HTMLElement | null = null
let pointer = { x: 0, y: 0 }
let scrollFrame = 0
let suppressClicksUntil = 0
const parentPath = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')))

export function canReorderNavigation(source: string, target: string) {
  return !!source && !!target && source !== target && parentPath(source) === parentPath(target)
}

function clearTarget() {
  navigationDrag.target = ''
  navigationDrag.position = null
}

function scrollParent(element: HTMLElement) {
  let parent = element.parentElement
  while (parent) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent
    parent = parent.parentElement
  }
  return element.closest<HTMLElement>('.sidebar, .mobile-sheet')
}

function targetAtPointer() {
  const row = document.elementFromPoint(pointer.x, pointer.y)?.closest<HTMLElement>('[data-nav-drag-path]')
  if (!row || !scrollContainer?.contains(row) || row.dataset.navDraggable !== 'true') {
    clearTarget()
    return
  }
  const target = row.dataset.navDragPath || ''
  if (!canReorderNavigation(navigationDrag.source, target)) {
    clearTarget()
    return
  }
  const rect = row.getBoundingClientRect()
  navigationDrag.target = target
  navigationDrag.position = pointer.y < rect.top + rect.height / 2 ? 'before' : 'after'
}

function scrollAtEdge() {
  scrollFrame = 0
  if (!navigationDrag.source || !scrollContainer) return
  const bounds = scrollContainer.getBoundingClientRect()
  const edge = Math.min(44, bounds.height / 4)
  const fromTop = pointer.y - bounds.top
  const fromBottom = bounds.bottom - pointer.y
  const velocity = fromTop < edge ? -Math.ceil((edge - Math.max(0, fromTop)) / edge * 16)
    : fromBottom < edge ? Math.ceil((edge - Math.max(0, fromBottom)) / edge * 16) : 0
  if (velocity && pointer.x >= bounds.left && pointer.x <= bounds.right) {
    scrollContainer.scrollTop += velocity
    targetAtPointer()
  }
  scrollFrame = requestAnimationFrame(scrollAtEdge)
}

function observeDrag(event: DragEvent) {
  if (!navigationDrag.source) return
  pointer = { x: event.clientX, y: event.clientY }
  const bounds = scrollContainer?.getBoundingClientRect()
  if (!bounds || pointer.x < bounds.left || pointer.x > bounds.right || pointer.y < bounds.top || pointer.y > bounds.bottom) {
    // Leaving the navigation cancels the proposal; nothing has been reordered yet.
    endNavigationDrag()
    return
  }
  targetAtPointer()
}

function leaveWindow(event: DragEvent) {
  if (!event.relatedTarget && (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight)) endNavigationDrag()
}

function cancelOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && navigationDrag.source) {
    event.preventDefault()
    event.stopPropagation()
    endNavigationDrag()
  }
}

export function beginNavigationDrag(event: DragEvent, source: string) {
  endNavigationDrag()
  const element = event.currentTarget as HTMLElement | null
  if (!element || !event.dataTransfer || !source) {
    event.preventDefault()
    return
  }
  scrollContainer = scrollParent(element)
  if (!scrollContainer) {
    event.preventDefault()
    return
  }
  navigationDrag.source = source
  pointer = { x: event.clientX, y: event.clientY }
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/x-ai-workspace-navigation', source)
  event.dataTransfer.setData('text/plain', source)
  document.addEventListener('dragover', observeDrag)
  document.addEventListener('dragenter', observeDrag)
  document.addEventListener('dragleave', leaveWindow)
  document.addEventListener('drop', endNavigationDrag)
  window.addEventListener('dragend', endNavigationDrag, true)
  window.addEventListener('keydown', cancelOnEscape, true)
  scrollFrame = requestAnimationFrame(scrollAtEdge)
}

export function hoverNavigationTarget(event: DragEvent, target: string) {
  if (!canReorderNavigation(navigationDrag.source, target)) {
    if (event.dataTransfer && navigationDrag.source) event.dataTransfer.dropEffect = 'none'
    clearTarget()
    return
  }
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const row = event.currentTarget as HTMLElement
  const bounds = row.getBoundingClientRect()
  navigationDrag.target = target
  navigationDrag.position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
}

export function dropNavigationTarget(event: DragEvent, target: string): ReorderRequest | null {
  if (!navigationDrag.source) return null
  event.preventDefault()
  const request = canReorderNavigation(navigationDrag.source, target) && navigationDrag.target === target && navigationDrag.position
    ? { source: navigationDrag.source, target, position: navigationDrag.position } : null
  endNavigationDrag()
  return request
}

export function endNavigationDrag() {
  if (navigationDrag.source) suppressClicksUntil = Date.now() + 350
  navigationDrag.source = ''
  clearTarget()
  if (scrollFrame) cancelAnimationFrame(scrollFrame)
  scrollFrame = 0
  scrollContainer = null
  document.removeEventListener('dragover', observeDrag)
  document.removeEventListener('dragenter', observeDrag)
  document.removeEventListener('dragleave', leaveWindow)
  document.removeEventListener('drop', endNavigationDrag)
  window.removeEventListener('dragend', endNavigationDrag, true)
  window.removeEventListener('keydown', cancelOnEscape, true)
}

export function suppressNavigationClick(event: MouseEvent) {
  if (!navigationDrag.source && Date.now() >= suppressClicksUntil) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
}
