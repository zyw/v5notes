export interface TrashEntry {
  /** Relative path under vault root pointing at the trashed node. */
  trashRel: string
  /** Original vault-relative display path. */
  originalPath: string
  deletedAt: string
  kind: 'note' | 'dir' | 'file'
  name: string
}
