import type { Note } from '../service/api'

export class Draft {
  note: Note | null = null
  dirty = false
  private revision = 0
  private pending: Promise<void> | null = null

  load(note: Note): void {
    this.note = { ...note }
    this.revision++
    this.dirty = false
  }

  clear(): void {
    this.note = null
    this.revision++
    this.dirty = false
  }

  edit(content: string): void {
    if (!this.note || this.note.content === content) return
    this.note = { ...this.note, content }
    this.revision++
    this.dirty = true
  }

  save(write: (note: Note) => Promise<void>): Promise<void> {
    if (this.pending) return this.pending
    if (!this.note || !this.dirty) return Promise.resolve()
    const snapshot = { ...this.note }
    const revision = this.revision
    this.pending = Promise.resolve().then(() => write(snapshot)).then(() => {
      if (this.note?.id === snapshot.id && this.revision === revision) this.dirty = false
    }).finally(() => { this.pending = null })
    return this.pending
  }
}
