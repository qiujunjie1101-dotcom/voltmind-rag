<script setup lang="ts">
import {
  Activity,
  AlertCircle,
  BookOpen,
  Database,
  FileText,
  FolderOpen,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'

import {
  ACCEPTED_FILE_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  createKnowledgeBase,
  deleteDocument,
  deleteKnowledgeBase,
  listDocuments,
  listKnowledgeBases,
  updateKnowledgeBase,
  uploadDocument,
  type DocumentStatus,
  type KnowledgeBase,
  type KnowledgeBaseInput,
  type KnowledgeDocument,
} from '@/api/knowledge'
import KnowledgeBaseFormDialog from '@/components/knowledge/KnowledgeBaseFormDialog.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BusinessRequestError } from '@/lib/business-http'
import { cn } from '@/lib/utils'

const knowledgeBases = ref<KnowledgeBase[]>([])
const documents = ref<KnowledgeDocument[]>([])
const selectedKnowledgeBaseId = ref<number | null>(null)
const knowledgeLoading = ref(true)
const documentsLoading = ref(false)
const refreshing = ref(false)
const uploading = ref(false)
const knowledgeError = ref('')
const documentError = ref('')
const operationMessage = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const formOpen = ref(false)
const editingKnowledgeBase = ref<KnowledgeBase | null>(null)
const formSubmitting = ref(false)
const formError = ref('')
const pendingKnowledgeDeleteId = ref<number | null>(null)
const pendingDocumentDeleteId = ref<number | null>(null)
const deletingKnowledgeBaseId = ref<number | null>(null)
const deletingDocumentId = ref<number | null>(null)
let documentRequestSequence = 0

const selectedKnowledgeBase = computed(
  () => knowledgeBases.value.find((item) => item.id === selectedKnowledgeBaseId.value) ?? null,
)
const pendingDocumentCount = computed(
  () => documents.value.filter((item) => item.status === 'PENDING' || item.status === 'INDEXING').length,
)
const totalChunkCount = computed(() =>
  documents.value.reduce((total, item) => total + item.chunkCount, 0),
)

const stats = computed(() => [
  {
    label: '知识库',
    value: knowledgeBases.value.length.toLocaleString('zh-CN'),
    hint: '来自 Java 业务服务',
    icon: BookOpen,
  },
  {
    label: '当前库文档',
    value: documents.value.length.toLocaleString('zh-CN'),
    hint: selectedKnowledgeBase.value?.name ?? '尚未选择知识库',
    icon: FileText,
  },
  {
    label: '待处理',
    value: pendingDocumentCount.value.toLocaleString('zh-CN'),
    hint: '包含待处理与处理中',
    icon: Activity,
  },
  {
    label: '向量片段',
    value: totalChunkCount.value.toLocaleString('zh-CN'),
    hint: totalChunkCount.value === 0 ? '解析与向量化尚未启用' : '当前知识库片段数',
    icon: Database,
  },
])

onMounted(() => loadKnowledgeBases())

async function loadKnowledgeBases(showRefresh = false) {
  if (showRefresh) refreshing.value = true
  else knowledgeLoading.value = true
  knowledgeError.value = ''
  documentError.value = ''
  try {
    const result = await listKnowledgeBases()
    knowledgeBases.value = result

    const selectionStillExists = result.some((item) => item.id === selectedKnowledgeBaseId.value)
    selectedKnowledgeBaseId.value = selectionStillExists
      ? selectedKnowledgeBaseId.value
      : (result[0]?.id ?? null)

    if (selectedKnowledgeBaseId.value !== null) {
      await loadKnowledgeBaseDocuments(selectedKnowledgeBaseId.value)
    } else {
      documents.value = []
    }
  } catch (error) {
    knowledgeError.value = describe(error, '知识库加载失败，请重试')
    knowledgeBases.value = []
    documents.value = []
    selectedKnowledgeBaseId.value = null
  } finally {
    knowledgeLoading.value = false
    refreshing.value = false
  }
}

async function selectKnowledgeBase(id: number) {
  if (selectedKnowledgeBaseId.value === id && !documentError.value) return
  selectedKnowledgeBaseId.value = id
  pendingDocumentDeleteId.value = null
  operationMessage.value = ''
  await loadKnowledgeBaseDocuments(id)
}

async function loadKnowledgeBaseDocuments(knowledgeBaseId: number) {
  const sequence = ++documentRequestSequence
  documentsLoading.value = true
  documentError.value = ''
  try {
    const result = await listDocuments(knowledgeBaseId)
    if (sequence === documentRequestSequence && selectedKnowledgeBaseId.value === knowledgeBaseId) {
      documents.value = result
    }
  } catch (error) {
    if (sequence === documentRequestSequence) {
      documents.value = []
      documentError.value = describe(error, '文档加载失败，请重试')
    }
  } finally {
    if (sequence === documentRequestSequence) documentsLoading.value = false
  }
}

function openCreateForm() {
  editingKnowledgeBase.value = null
  formError.value = ''
  formOpen.value = true
}

function openEditForm(knowledgeBase: KnowledgeBase) {
  editingKnowledgeBase.value = knowledgeBase
  formError.value = ''
  formOpen.value = true
}

function setFormOpen(value: boolean) {
  if (formSubmitting.value) return
  formOpen.value = value
  if (!value) formError.value = ''
}

async function saveKnowledgeBase(input: KnowledgeBaseInput) {
  formSubmitting.value = true
  formError.value = ''
  try {
    const saved = editingKnowledgeBase.value
      ? await updateKnowledgeBase(editingKnowledgeBase.value.id, input)
      : await createKnowledgeBase(input)
    selectedKnowledgeBaseId.value = saved.id
    formOpen.value = false
    operationMessage.value = editingKnowledgeBase.value ? '知识库已更新' : '知识库已创建'
    await loadKnowledgeBases()
  } catch (error) {
    formError.value = describe(error, '保存失败，请重试')
  } finally {
    formSubmitting.value = false
  }
}

async function confirmKnowledgeBaseDelete(knowledgeBase: KnowledgeBase) {
  deletingKnowledgeBaseId.value = knowledgeBase.id
  knowledgeError.value = ''
  operationMessage.value = ''
  try {
    await deleteKnowledgeBase(knowledgeBase.id)
    pendingKnowledgeDeleteId.value = null
    if (selectedKnowledgeBaseId.value === knowledgeBase.id) selectedKnowledgeBaseId.value = null
    operationMessage.value = `已删除知识库“${knowledgeBase.name}”及其关联文档`
    await loadKnowledgeBases()
  } catch (error) {
    knowledgeError.value = describe(error, '删除知识库失败，请重试')
  } finally {
    deletingKnowledgeBaseId.value = null
  }
}

function chooseFile() {
  fileInput.value?.click()
}

async function handleFileSelection(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || selectedKnowledgeBaseId.value === null) return

  documentError.value = validateFile(file)
  operationMessage.value = ''
  if (documentError.value) return

  uploading.value = true
  try {
    await uploadDocument(selectedKnowledgeBaseId.value, file)
    operationMessage.value = `“${file.name}”上传成功，等待后续处理`
    await loadKnowledgeBaseDocuments(selectedKnowledgeBaseId.value)
  } catch (error) {
    documentError.value = describe(error, '文件上传失败，请重试')
  } finally {
    uploading.value = false
  }
}

function validateFile(file: File): string {
  if (file.size === 0) return '不能上传空文件'
  if (file.size > MAX_UPLOAD_BYTES) return '文件不能超过 20 MB'
  if (file.name.includes('/') || file.name.includes('\\')) return '文件名包含不安全的路径字符'
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ACCEPTED_FILE_EXTENSIONS.includes(extension as (typeof ACCEPTED_FILE_EXTENSIONS)[number])) {
    return '仅支持 PDF、DOCX、Markdown 和 TXT 文件'
  }
  return ''
}

async function confirmDocumentDelete(document: KnowledgeDocument) {
  deletingDocumentId.value = document.id
  documentError.value = ''
  operationMessage.value = ''
  try {
    await deleteDocument(document.id)
    pendingDocumentDeleteId.value = null
    operationMessage.value = `已删除文档“${document.fileName}”`
    if (selectedKnowledgeBaseId.value !== null) {
      await loadKnowledgeBaseDocuments(selectedKnowledgeBaseId.value)
    }
  } catch (error) {
    documentError.value = describe(error, '删除文档失败，请重试')
  } finally {
    deletingDocumentId.value = null
  }
}

function statusLabel(status: DocumentStatus): string {
  return {
    PENDING: '待处理',
    INDEXING: '处理中',
    INDEXED: '已完成',
    FAILED: '处理失败',
  }[status]
}

function statusVariant(status: DocumentStatus) {
  if (status === 'INDEXED') return 'success' as const
  if (status === 'INDEXING') return 'secondary' as const
  return 'muted' as const
}

function fileTypeLabel(document: KnowledgeDocument): string {
  const extension = document.fileName.split('.').pop()?.toUpperCase()
  return extension || document.fileType || '未知'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function describe(error: unknown, fallback: string): string {
  return error instanceof BusinessRequestError ? error.message : fallback
}
</script>

<template>
  <div class="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 lg:px-6 lg:py-8">
    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="知识库统计">
      <Card v-for="stat in stats" :key="stat.label" class="gap-3 py-4">
        <CardHeader class="flex-row items-center justify-between gap-2">
          <CardDescription>{{ stat.label }}</CardDescription>
          <component :is="stat.icon" class="text-muted-foreground size-4" aria-hidden="true" />
        </CardHeader>
        <CardContent class="space-y-0.5">
          <p class="text-2xl font-semibold">{{ stat.value }}</p>
          <p class="text-muted-foreground truncate text-[11px]" :title="stat.hint">{{ stat.hint }}</p>
        </CardContent>
      </Card>
    </section>

    <div
      v-if="operationMessage"
      class="border-success/30 bg-success/10 text-success rounded-md border px-3 py-2 text-xs"
      role="status"
    >
      {{ operationMessage }}
    </div>

    <div class="grid min-w-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <Card class="min-w-0 gap-0 py-0">
        <CardHeader class="flex-row items-start justify-between gap-3 py-5">
          <div class="min-w-0">
            <CardTitle>知识库</CardTitle>
            <CardDescription class="mt-1">选择知识范围并管理资料。</CardDescription>
          </div>
          <Button size="icon" class="size-8" title="新建知识库" aria-label="新建知识库" @click="openCreateForm">
            <Plus />
          </Button>
        </CardHeader>

        <CardContent class="border-t py-3">
          <div
            v-if="knowledgeError"
            class="border-destructive/35 bg-destructive/8 mb-3 rounded-md border px-3 py-2"
            role="alert"
          >
            <p class="text-destructive text-xs">{{ knowledgeError }}</p>
            <Button variant="outline" size="sm" class="mt-2" @click="loadKnowledgeBases()">重试</Button>
          </div>

          <div v-if="knowledgeLoading" class="text-muted-foreground flex items-center gap-2 py-8 text-xs">
            <LoaderCircle class="size-4 animate-spin" />
            正在加载知识库…
          </div>

          <div
            v-else-if="knowledgeBases.length === 0 && !knowledgeError"
            class="flex flex-col items-center px-2 py-9 text-center"
          >
            <FolderOpen class="text-muted-foreground size-8" />
            <p class="mt-3 text-sm font-medium">还没有知识库</p>
            <p class="text-muted-foreground mt-1 text-xs">新建后即可上传文档。</p>
            <Button size="sm" class="mt-4" @click="openCreateForm"><Plus />新建知识库</Button>
          </div>

          <ul v-else class="space-y-1.5">
            <li
              v-for="knowledgeBase in knowledgeBases"
              :key="knowledgeBase.id"
              :class="
                cn(
                  'border-border rounded-md border p-2 transition-colors',
                  selectedKnowledgeBaseId === knowledgeBase.id && 'border-primary/45 bg-primary/8',
                )
              "
            >
              <button
                type="button"
                class="w-full min-w-0 text-left"
                :aria-pressed="selectedKnowledgeBaseId === knowledgeBase.id"
                @click="selectKnowledgeBase(knowledgeBase.id)"
              >
                <span class="block truncate text-sm font-medium">{{ knowledgeBase.name }}</span>
                <span class="text-muted-foreground mt-0.5 block line-clamp-2 text-xs">
                  {{ knowledgeBase.description || '暂无描述' }}
                </span>
              </button>

              <div class="mt-2 flex items-center justify-end gap-1 border-t pt-1.5">
                <template v-if="pendingKnowledgeDeleteId === knowledgeBase.id">
                  <Button
                    variant="destructive"
                    size="sm"
                    :disabled="deletingKnowledgeBaseId === knowledgeBase.id"
                    @click="confirmKnowledgeBaseDelete(knowledgeBase)"
                  >
                    <LoaderCircle
                      v-if="deletingKnowledgeBaseId === knowledgeBase.id"
                      class="animate-spin"
                    />
                    确认删除
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    :disabled="deletingKnowledgeBaseId === knowledgeBase.id"
                    @click="pendingKnowledgeDeleteId = null"
                  >
                    取消
                  </Button>
                </template>
                <template v-else>
                  <Button variant="ghost" size="sm" @click="openEditForm(knowledgeBase)">
                    <Pencil />编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    :title="`删除知识库 ${knowledgeBase.name}`"
                    @click="pendingKnowledgeDeleteId = knowledgeBase.id"
                  >
                    <Trash2 />删除
                  </Button>
                </template>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card class="min-w-0 gap-0 py-0">
        <CardHeader class="flex-row items-start justify-between gap-3 py-5">
          <div class="min-w-0">
            <CardTitle class="truncate">
              {{ selectedKnowledgeBase?.name ?? '文档管理' }}
            </CardTitle>
            <CardDescription class="mt-1 line-clamp-2">
              {{ selectedKnowledgeBase?.description || '选择知识库后查看和上传文档。' }}
            </CardDescription>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              class="size-8"
              title="刷新列表"
              aria-label="刷新列表"
              :disabled="refreshing || uploading"
              @click="loadKnowledgeBases(true)"
            >
              <RefreshCw :class="refreshing ? 'animate-spin' : undefined" />
            </Button>
            <Button
              size="sm"
              :disabled="selectedKnowledgeBaseId === null || uploading"
              @click="chooseFile"
            >
              <LoaderCircle v-if="uploading" class="animate-spin" />
              <Upload v-else />
              {{ uploading ? '上传中' : '上传文档' }}
            </Button>
            <input
              ref="fileInput"
              type="file"
              class="hidden"
              accept=".pdf,.docx,.md,.markdown,.txt"
              aria-hidden="true"
              tabindex="-1"
              :disabled="uploading"
              @change="handleFileSelection"
            />
          </div>
        </CardHeader>

        <div
          v-if="documentError"
          class="border-destructive/35 bg-destructive/8 mx-5 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
          role="alert"
        >
          <p class="text-destructive flex min-w-0 items-center gap-1.5 text-xs">
            <AlertCircle class="size-3.5 shrink-0" />
            <span>{{ documentError }}</span>
          </p>
          <Button
            v-if="selectedKnowledgeBaseId !== null"
            variant="outline"
            size="sm"
            @click="loadKnowledgeBaseDocuments(selectedKnowledgeBaseId)"
          >
            重试
          </Button>
        </div>

        <div v-if="selectedKnowledgeBase === null" class="border-t px-5 py-16 text-center">
          <FolderOpen class="text-muted-foreground mx-auto size-9" />
          <p class="mt-3 text-sm font-medium">请选择或新建知识库</p>
          <p class="text-muted-foreground mt-1 text-xs">文档会存放到当前选中的知识库中。</p>
        </div>

        <div
          v-else-if="documentsLoading"
          class="text-muted-foreground flex items-center justify-center gap-2 border-t px-5 py-16 text-xs"
        >
          <LoaderCircle class="size-4 animate-spin" />
          正在加载文档…
        </div>

        <div
          v-else-if="documents.length === 0 && !documentError"
          class="flex flex-col items-center border-t px-5 py-14 text-center"
        >
          <FileText class="text-muted-foreground size-9" />
          <p class="mt-3 text-sm font-medium">这个知识库还没有文档</p>
          <p class="text-muted-foreground mt-1 text-xs">支持 PDF、DOCX、Markdown、TXT，单个文件最大 20 MB。</p>
          <Button size="sm" class="mt-4" :disabled="uploading" @click="chooseFile">
            <Upload />上传第一个文档
          </Button>
        </div>

        <div v-else-if="documents.length > 0" class="scrollbar-slim overflow-x-auto border-t">
          <table class="w-full min-w-[720px] text-sm">
            <thead>
              <tr class="text-muted-foreground border-b text-left text-xs">
                <th class="px-5 py-2.5 font-medium">文件名</th>
                <th class="px-4 py-2.5 font-medium">类型 / 大小</th>
                <th class="px-4 py-2.5 font-medium">状态</th>
                <th class="px-4 py-2.5 font-medium">片段</th>
                <th class="px-4 py-2.5 font-medium">上传时间</th>
                <th class="px-5 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="document in documents" :key="document.id" class="border-b last:border-0">
                <td class="max-w-64 px-5 py-3">
                  <p class="truncate font-medium" :title="document.fileName">{{ document.fileName }}</p>
                </td>
                <td class="text-muted-foreground px-4 py-3 whitespace-nowrap">
                  {{ fileTypeLabel(document) }} · {{ formatBytes(document.fileSize) }}
                </td>
                <td class="px-4 py-3">
                  <Badge
                    :variant="statusVariant(document.status)"
                    :class="
                      document.status === 'FAILED'
                        ? 'bg-destructive/10 text-destructive border-transparent'
                        : undefined
                    "
                  >
                    {{ statusLabel(document.status) }}
                  </Badge>
                </td>
                <td class="text-muted-foreground px-4 py-3 tabular-nums">{{ document.chunkCount }}</td>
                <td class="text-muted-foreground px-4 py-3 whitespace-nowrap">
                  {{ formatDate(document.createdAt) }}
                </td>
                <td class="px-5 py-3 text-right">
                  <div class="flex justify-end gap-1">
                    <template v-if="pendingDocumentDeleteId === document.id">
                      <Button
                        variant="destructive"
                        size="sm"
                        :disabled="deletingDocumentId === document.id"
                        @click="confirmDocumentDelete(document)"
                      >
                        <LoaderCircle v-if="deletingDocumentId === document.id" class="animate-spin" />
                        确认
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        :disabled="deletingDocumentId === document.id"
                        @click="pendingDocumentDeleteId = null"
                      >
                        取消
                      </Button>
                    </template>
                    <Button
                      v-else
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      :title="`删除文档 ${document.fileName}`"
                      :aria-label="`删除文档 ${document.fileName}`"
                      @click="pendingDocumentDeleteId = document.id"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>

    <KnowledgeBaseFormDialog
      :open="formOpen"
      :knowledge-base="editingKnowledgeBase"
      :submitting="formSubmitting"
      :error="formError"
      @update:open="setFormOpen"
      @submit="saveKnowledgeBase"
    />
  </div>
</template>
