import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 合并 Tailwind 类名，冲突时保留后者。 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
