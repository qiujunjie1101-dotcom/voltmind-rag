import type { NavNode } from './content'

export interface NavigationAction {
  type: 'edit' | 'copy-link' | 'copy-path' | 'expand' | 'collapse' | 'move-up' | 'move-down' | 'move-first' | 'move-last'
  node?: NavNode
}
