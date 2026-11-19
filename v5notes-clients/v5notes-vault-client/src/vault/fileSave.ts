/**
 * Writes exported files where the user chooses.
 *
 * Desktop: the Tauri save dialog, then the chosen path is written through the
 * fs plugin. Browser (Vite dev without the shell): an anchor download, since
 * there is no filesystem to write to. Cancelling the dialog writes nothing.
 */
import { isTauri } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'

export interface FileFilter {
  name: string
  extensions: string[]
}

export type SaveResult = 'saved' | 'canceled'

function mimeFor(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.html')) return 'text/html;charset=utf-8'
  return 'text/markdown;charset=utf-8'
}

function browserDownload(fileName: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeFor(fileName) }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function saveExportFile(
  fileName: string,
  data: Uint8Array | string,
  filters: FileFilter[],
): Promise<SaveResult> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  if (!isTauri()) {
    browserDownload(fileName, bytes)
    return 'saved'
  }
  const path = await save({ defaultPath: fileName, filters })
  if (!path) return 'canceled'
  await writeFile(path, bytes)
  return 'saved'
}
