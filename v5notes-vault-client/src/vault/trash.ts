/**
 * Local trash under `.v5notes/trash/` (design §6.4 / §9.4).
 * Never synced — SyncEngine must skip this tree.
 */

import { exists, mkdir, readDir, remove, rename } from '@tauri-apps/plugin-fs'
import { normalizeVaultPath, VaultPathError } from '../path/identity'
import { TRASH_DIR_REL } from './skeleton'
import { buildTrashRel, isMetaOrTrashPath } from './trashPaths'
import { vaultFs } from './vaultFs'
import type { TrashEntry } from './trashTypes'

export type { TrashEntry } from './trashTypes'
export { buildTrashRel, isMetaOrTrashPath, isUnderTrash } from './trashPaths'

async function ensureUniqueAbs(absPath: string): Promise<string> {
  if (!(await exists(absPath))) return absPath
  for (let i = 2; i < 1000; i++) {
    const candidate = `${absPath}-${i}`
    if (!(await exists(candidate))) return candidate
  }
  throw new VaultPathError('回收站目标名冲突过多')
}

/**
 * Move a vault-relative path into local trash (not permanent delete).
 * Returns the trash-relative path used.
 */
export async function moveToTrash(rootPath: string, relativePath: string): Promise<string> {
  const { displayPath } = normalizeVaultPath(relativePath)
  if (isMetaOrTrashPath(displayPath)) {
    throw new VaultPathError('不能把元数据或回收站路径移入回收站')
  }

  const fromAbs = await vaultFs.absolute(rootPath, displayPath)
  if (!(await exists(fromAbs))) {
    throw new VaultPathError(`路径不存在: ${displayPath}`)
  }

  const trashRel = buildTrashRel(displayPath)
  const trashParentRel = trashRel.includes('/')
    ? trashRel.slice(0, trashRel.lastIndexOf('/'))
    : TRASH_DIR_REL
  await vaultFs.mkdir(rootPath, trashParentRel)

  let toAbs = await vaultFs.absolute(rootPath, trashRel)
  toAbs = await ensureUniqueAbs(toAbs)
  const parent = toAbs.replace(/[/\\][^/\\]+$/, '')
  await mkdir(parent, { recursive: true })
  await rename(fromAbs, toAbs)

  // Recompute relative path if uniqueness suffix was applied on the leaf.
  const rootNorm = rootPath.replace(/[/\\]+$/, '').replace(/\\/g, '/')
  const toNorm = toAbs.replace(/\\/g, '/')
  if (toNorm.startsWith(rootNorm)) {
    return toNorm.slice(rootNorm.length).replace(/^\/+/, '')
  }
  return trashRel
}

/** Permanently delete a path (used for trash purge). */
export async function permanentDelete(rootPath: string, relativePath: string): Promise<void> {
  await vaultFs.delete(rootPath, relativePath)
}

/** List top-level items in each trash stamp folder (newest first). */
export async function listTrash(rootPath: string): Promise<TrashEntry[]> {
  const trashAbs = await vaultFs.absolute(rootPath, TRASH_DIR_REL)
  if (!(await exists(trashAbs))) return []
  const stamps = await readDir(trashAbs)
  const stampNames = stamps
    .filter(e => e.isDirectory && e.name)
    .map(e => e.name as string)
    .sort((a, b) => b.localeCompare(a))

  const out: TrashEntry[] = []
  for (const stamp of stampNames) {
    const deletedAt = stamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z')
    const stampRel = `${TRASH_DIR_REL}/${stamp}`
    const stampAbs = await vaultFs.absolute(rootPath, stampRel)
    const entries = await readDir(stampAbs)
    for (const entry of entries) {
      const name = entry.name
      if (!name) continue
      const childRel = `${stampRel}/${name}`
      // Original path may be nested under stamp if deleted item had parents —
      // listTree-style: if directory, treat whole tree as one restore unit only when
      // the deleted node was a single segment; nested originals keep relative form.
      if (entry.isDirectory) {
        // Walk one level of nesting: stamp/<seg>/...  OR stamp/<file>
        // For dirs created as stamp/<originalPath segments>, list the top segment
        // and reconstruct original as everything under stamp.
        const nested = await listOriginalUnderStamp(rootPath, stampRel, name, entry.isDirectory)
        out.push({
          trashRel: nested.trashRel,
          originalPath: nested.originalPath,
          deletedAt,
          kind: 'dir',
          name: nested.name,
        })
        continue
      }
      if (entry.isFile) {
        out.push({
          trashRel: childRel,
          originalPath: name,
          deletedAt,
          kind: name.toLowerCase().endsWith('.md') ? 'note' : 'file',
          name,
        })
      }
    }
  }
  return out
}

async function listOriginalUnderStamp(
  rootPath: string,
  stampRel: string,
  topName: string,
  isDir: boolean,
): Promise<{ trashRel: string; originalPath: string; name: string }> {
  // If the deleted path was `工作/项目`, trash layout is stamp/工作/项目.
  // We need the full original relative path. Walk until leaves to find depth —
  // simpler: store as stamp/<full original path>, so topName is first segment.
  // Reconstruct by walking uniquely nested single-child chains? Too fragile.
  // Instead: when moving to trash we always use stamp/<full displayPath>,
  // so for `工作/周报.md` the stamp folder contains dir `工作` with file `周报.md`.
  // For listing restore units we want one entry per deleted operation.
  // We'll detect: if top is a file → original=name; if dir → find deepest single path
  // OR list the directory node as originalPath starting with topName and include subtree as one unit
  // when the dir was the deleted node.
  // Practical Phase 2: treat each top-level child of stamp as one entry whose originalPath
  // is the relative path from stamp. For nested files, recurse to files? 
  // Better approach used below: flatten to files + dirs that were direct delete targets
  // by reading only the immediate children and if directory, originalPath = walk to reconstruct
  // full relative path only when there's exactly one file descendant with the path.
  const topRel = `${stampRel}/${topName}`
  if (!isDir) {
    return { trashRel: topRel, originalPath: topName, name: topName }
  }
  // Reconstruct original path = relative path under stamp (may be multi-segment).
  // Use breadth: if dir has mixed children, original was the directory itself at topName.
  const abs = await vaultFs.absolute(rootPath, topRel)
  const kids = await readDir(abs)
  // Heuristic: always restore the top-level directory as originalPath = full tree under stamp
  // starting at topName. For `工作/周报.md` moved, stamp has `工作/周报.md` → top is dir 工作,
  // restore unit should be the file. Flatten: collect all files with relative original paths.
  // Phase 2 UX: show each file and each empty-ish dir. Simpler: show top-level only and
  // originalPath = recursively join if single-child chain to a file.
  let originalPath = topName
  let trashRel = topRel
  let cursorRel = topRel
  let cursorName = topName
  let cursorKids = kids
  while (cursorKids.length === 1 && cursorKids[0]?.isDirectory && cursorKids[0].name) {
    cursorName = cursorKids[0].name
    originalPath = `${originalPath}/${cursorName}`
    cursorRel = `${cursorRel}/${cursorName}`
    cursorKids = await readDir(await vaultFs.absolute(rootPath, cursorRel))
  }
  if (cursorKids.length === 1 && cursorKids[0]?.isFile && cursorKids[0].name) {
    originalPath = `${originalPath}/${cursorKids[0].name}`
    trashRel = `${cursorRel}/${cursorKids[0].name}`
    return {
      trashRel,
      originalPath,
      name: cursorKids[0].name,
    }
  }
  // Directory delete (or complex tree): restore whole top dir.
  return { trashRel: topRel, originalPath: topName, name: topName }
}

/** Restore a trash entry to its original path if free. */
export async function restoreFromTrash(rootPath: string, entry: TrashEntry): Promise<void> {
  const { displayPath } = normalizeVaultPath(entry.originalPath)
  if (await vaultFs.exists(rootPath, displayPath)) {
    throw new VaultPathError(`原路径已被占用，无法还原: ${displayPath}`)
  }
  const parent = displayPath.includes('/')
    ? displayPath.slice(0, displayPath.lastIndexOf('/'))
    : null
  if (parent) await vaultFs.mkdir(rootPath, parent)

  const fromAbs = await vaultFs.absolute(rootPath, entry.trashRel)
  const toAbs = await vaultFs.absolute(rootPath, displayPath)
  if (!(await exists(fromAbs))) {
    throw new VaultPathError(`回收站条目不存在: ${entry.trashRel}`)
  }
  await rename(fromAbs, toAbs)

  // Best-effort cleanup of empty stamp folder.
  const parts = entry.trashRel.split('/')
  // `.v5notes/trash/<stamp>/...`
  if (parts.length >= 3) {
    const stampRel = parts.slice(0, 3).join('/')
    try {
      await cleanupEmptyParents(rootPath, entry.trashRel, stampRel)
    } catch {
      /* ignore */
    }
  }
}

async function cleanupEmptyParents(rootPath: string, fromRel: string, stopRel: string): Promise<void> {
  let cursor = fromRel.includes('/') ? fromRel.slice(0, fromRel.lastIndexOf('/')) : null
  while (cursor && cursor.startsWith(stopRel)) {
    const abs = await vaultFs.absolute(rootPath, cursor)
    const left = await readDir(abs)
    if (left.length > 0) break
    await remove(abs, { recursive: true })
    if (cursor === stopRel) break
    cursor = cursor.includes('/') ? cursor.slice(0, cursor.lastIndexOf('/')) : null
  }
}

/** Empty entire local trash (permanent). */
export async function emptyTrash(rootPath: string): Promise<void> {
  const trashAbs = await vaultFs.absolute(rootPath, TRASH_DIR_REL)
  if (!(await exists(trashAbs))) return
  await remove(trashAbs, { recursive: true })
  await mkdir(trashAbs, { recursive: true })
}
