<script setup lang="ts">
import { computed, ref } from 'vue'
import { FilePlus2, FolderPlus, Plus } from 'lucide-vue-next'
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger } from 'reka-ui'
import { clean } from '@/lib/content'
import type { CreationRequest } from '@/lib/creation'

const props = defineProps<{ parent: string; label: string; sibling?: boolean }>()
const emit = defineEmits<{ create: [request: CreationRequest] }>()
const handingOff = ref(false)
const actionLabel = computed(() => props.sibling ? `在「${props.label}」同级创建` : `在「${props.label}」中创建`)
const breadcrumb = computed(() => ['知识库', ...props.parent.split('/').filter(Boolean).map(clean)].join(' / '))
function choose(mode: CreationRequest['mode']) {
  handingOff.value = true
  emit('create', { mode, parent: props.parent })
}
function closeAutoFocus(event: Event) {
  // Creation takes focus after selection; Escape still returns it to +.
  if (handingOff.value) event.preventDefault()
}
</script>

<template>
  <DropdownMenuRoot :modal="false" @update:open="open => { if (open) handingOff = false }">
    <DropdownMenuTrigger class="nav-create-trigger" :aria-label="actionLabel" :title="actionLabel" @click.stop>
      <Plus :size="15" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent as-child side="bottom" align="end" :side-offset="5" :collision-padding="12" @close-auto-focus="closeAutoFocus">
        <div class="nav-create-menu">
          <DropdownMenuLabel class="nav-create-location">
            <span>创建位置</span>
            <strong>{{ breadcrumb }}</strong>
            <code>src/content/{{ parent ? parent + '/' : '' }}</code>
          </DropdownMenuLabel>
          <DropdownMenuSeparator class="nav-create-separator" />
          <DropdownMenuItem class="nav-create-option" @select="choose('new')">
            <FilePlus2 :size="16" aria-hidden="true" />
            <span>{{ sibling ? '同级新建文档' : '新建文档' }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem class="nav-create-option" @select="choose('folder')">
            <FolderPlus :size="16" aria-hidden="true" />
            <span>{{ sibling ? '同级新建目录' : '新建子目录' }}</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style scoped>
.nav-create-trigger{display:inline-flex;align-items:center;justify-content:center;flex:0 0 24px;width:24px;height:24px;padding:0;border:0;border-radius:4px;background:transparent;color:#8a94a4;cursor:pointer;transition:opacity 120ms ease,background 120ms ease,color 120ms ease}
.nav-item-row .nav-create-trigger{opacity:0;pointer-events:none}
.nav-item-row:hover .nav-create-trigger,.nav-item-row:focus-within .nav-create-trigger,.nav-item-row:has(.nav-row-actions [data-state=open]) .nav-create-trigger,.nav-create-trigger[data-state=open],.nav-create-trigger:focus-visible{opacity:1;pointer-events:auto}
.nav-create-trigger:hover,.nav-create-trigger[data-state=open]{background:#e9edf6;color:#435eab}
.nav-create-trigger:focus-visible{outline:2px solid #5b77ba;outline-offset:2px}
.nav-create-menu{z-index:120;min-width:218px;max-width:min(320px,calc(100vw - 24px));padding:5px;background:#fff;color:#39465a;border:1px solid #dfe4ec;border-radius:9px;box-shadow:0 9px 30px #1a27451c;font-family:inherit;outline:none}
.nav-create-location{display:flex;flex-direction:column;gap:4px;padding:8px 9px 9px;font-size:11px;color:#7b8391;line-height:1.5}
.nav-create-location strong{font-size:12px;font-weight:550;color:#46546a;overflow-wrap:anywhere}
.nav-create-location code{font-size:10px;line-height:1.6;white-space:normal;overflow-wrap:anywhere;background:transparent;padding:0;color:#838b97}
.nav-create-separator{height:1px;background:#ebedf2;margin:2px 4px 5px}
.nav-create-option{display:flex;align-items:center;gap:9px;min-height:35px;padding:7px 9px;border-radius:5px;font-size:13px;line-height:1.5;cursor:pointer;outline:none;user-select:none}
.nav-create-option svg{flex-shrink:0;color:#708096}
.nav-create-option[data-highlighted]{background:#eef2fa;color:#3b5aa0}
[data-theme=dark] .nav-create-trigger{color:#9daabc}
[data-theme=dark] .nav-create-trigger:hover,[data-theme=dark] .nav-create-trigger[data-state=open]{background:#29374c;color:#c3d2f9}
[data-theme=dark] .nav-create-menu{background:#1c2431;color:#d7dfec;border-color:#354153;box-shadow:0 9px 30px #0006}
[data-theme=dark] .nav-create-location{color:#8e9db1}
[data-theme=dark] .nav-create-location strong{color:#cad5e7}
[data-theme=dark] .nav-create-location code{color:#98a6bb}
[data-theme=dark] .nav-create-separator{background:#354153}
[data-theme=dark] .nav-create-option svg{color:#a0b1ca}
[data-theme=dark] .nav-create-option[data-highlighted]{background:#2a3a55;color:#dbe7ff}
@media(hover:none),(pointer:coarse){.nav-item-row .nav-create-trigger{opacity:1;pointer-events:auto;height:30px}.nav-create-option{min-height:42px}}
@media(prefers-reduced-motion:reduce){.nav-create-trigger{transition:none}}
</style>
