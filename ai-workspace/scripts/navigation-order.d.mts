export interface NavigationOrder { version: 1; order: Record<string, string[]> }
export const MAX_NAVIGATION_BYTES: number
export function parseNavigationOrder(raw: string | null): NavigationOrder
export function serializeNavigationOrder(value: NavigationOrder): string
