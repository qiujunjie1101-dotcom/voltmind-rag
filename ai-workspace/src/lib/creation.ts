/** A creation target is always a directory relative to src/content. */
export interface CreationRequest {
  mode: 'new' | 'folder'
  parent: string
}
