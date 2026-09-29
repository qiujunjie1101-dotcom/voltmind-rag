import { requestBusiness } from '@/lib/business-http'

export interface KnowledgeBase {
  id: number
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface KnowledgeBaseInput {
  name: string
  description: string
}

export type DocumentStatus = 'PENDING' | 'INDEXING' | 'INDEXED' | 'FAILED'

export interface KnowledgeDocument {
  id: number
  knowledgeBaseId: number
  fileName: string
  fileType: string
  fileSize: number
  storageKey: string
  status: DocumentStatus
  chunkCount: number
  createdAt: string
  updatedAt: string
}

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
export const ACCEPTED_FILE_EXTENSIONS = ['pdf', 'docx', 'md', 'markdown', 'txt'] as const

const KNOWLEDGE_BASES_PATH = '/api/v1/knowledge-bases'

export function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  return requestBusiness({ method: 'GET', url: KNOWLEDGE_BASES_PATH })
}

export function createKnowledgeBase(input: KnowledgeBaseInput): Promise<KnowledgeBase> {
  return requestBusiness({ method: 'POST', url: KNOWLEDGE_BASES_PATH, data: input })
}

export function getKnowledgeBase(id: number): Promise<KnowledgeBase> {
  return requestBusiness({ method: 'GET', url: `${KNOWLEDGE_BASES_PATH}/${id}` })
}

export function updateKnowledgeBase(id: number, input: KnowledgeBaseInput): Promise<KnowledgeBase> {
  return requestBusiness({ method: 'PUT', url: `${KNOWLEDGE_BASES_PATH}/${id}`, data: input })
}

export function deleteKnowledgeBase(id: number): Promise<void> {
  return requestBusiness({ method: 'DELETE', url: `${KNOWLEDGE_BASES_PATH}/${id}` })
}

export function listDocuments(knowledgeBaseId: number): Promise<KnowledgeDocument[]> {
  return requestBusiness({
    method: 'GET',
    url: `${KNOWLEDGE_BASES_PATH}/${knowledgeBaseId}/documents`,
  })
}

export function getDocument(id: number): Promise<KnowledgeDocument> {
  return requestBusiness({ method: 'GET', url: `/api/v1/documents/${id}` })
}

export function uploadDocument(knowledgeBaseId: number, file: File): Promise<KnowledgeDocument> {
  const data = new FormData()
  data.append('file', file)
  return requestBusiness({
    method: 'POST',
    url: `${KNOWLEDGE_BASES_PATH}/${knowledgeBaseId}/documents`,
    data,
  })
}

export function deleteDocument(id: number): Promise<void> {
  return requestBusiness({ method: 'DELETE', url: `/api/v1/documents/${id}` })
}
