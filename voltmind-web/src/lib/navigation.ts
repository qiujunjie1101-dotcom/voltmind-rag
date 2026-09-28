import { FileText, Library, MessageSquare, Search, Settings2 } from '@lucide/vue'
import { ref, type Component } from 'vue'

/** 当前已实现的视图；新增视图时同步扩展 views 映射与这里。 */
export type ViewKey = 'chat' | 'knowledge' | 'settings'

export interface NavItem {
  key: string
  label: string
  description: string
  icon: Component
  /** 没有 view 表示功能尚未实现，导航项为禁用态 */
  view?: ViewKey
  status?: 'planned'
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    label: '工作台',
    items: [
      {
        key: 'chat',
        label: '对话',
        description: '基于知识库的检索问答',
        icon: MessageSquare,
        view: 'chat',
      },
      {
        key: 'knowledge',
        label: '知识库',
        description: '文档与索引概览',
        icon: Library,
        view: 'knowledge',
      },
    ],
  },
  {
    label: '规划中',
    items: [
      {
        key: 'documents',
        label: '文档入库',
        description: '上传、解析与切片',
        icon: FileText,
        status: 'planned',
      },
      {
        key: 'retrieval',
        label: '检索调试',
        description: '召回质量与引用核对',
        icon: Search,
        status: 'planned',
      },
    ],
  },
  {
    label: '系统',
    items: [
      {
        key: 'settings',
        label: '设置',
        description: '外观与服务配置',
        icon: Settings2,
        view: 'settings',
      },
    ],
  },
]

export function findNavItem(key: string): NavItem | undefined {
  return navigation.flatMap((section) => section.items).find((item) => item.key === key)
}

/**
 * 模块级单例：当前选中的导航项。
 *
 * 放在这里而不是 App.vue 的局部状态中，是为了让页面内部也能发起跳转
 * （例如对话页没有可用模型时引导用户去设置页），避免为此引入路由库。
 */
export const activeNavKey = ref('chat')

export function selectNav(key: string) {
  if (findNavItem(key)?.view) {
    activeNavKey.value = key
  }
}
