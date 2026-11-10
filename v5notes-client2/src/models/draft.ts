import type { Note } from '../service/api'

function contentHashFrom(result: unknown): string | undefined {
  if (!result || typeof result !== 'object' || !('contentHash' in result)) return undefined
  const value = result.contentHash
  return typeof value === 'string' && value ? value : undefined
}

function isRepeatSubmit(cause: unknown): boolean {
  return cause instanceof Error && cause.message.includes('不允许重复提交')
}

export class Draft {
  note: Note | null = null
  dirty = false
  private revision = 0
  private savedRevision = 0
  private pending: Promise<void> | null = null
  private tail: Promise<void> = Promise.resolve()
  private flight: Promise<void> | null = null
  private writer: ((note: Note) => Promise<unknown>) | null = null

  load(note: Note): void {
    this.note = { ...note }
    this.revision++
    this.savedRevision = this.revision
    this.dirty = false
  }

  clear(): void {
    this.note = null
    this.revision++
    this.savedRevision = this.revision
    this.dirty = false
  }

  edit(content: string): void {
    if (!this.note || this.note.content === content) return
    this.note = { ...this.note, content }
    this.revision++
    this.dirty = true
  }

  save(write: (note: Note) => Promise<unknown>): Promise<void> {
    if (this.pending) return this.pending
    if (!this.note || !this.dirty) return Promise.resolve()
    if (this.flight) return this.flight.then(() => this.save(write), () => this.save(write))
    const snapshot = { ...this.note }
    const revision = this.revision
    const run = this.enqueue(() => write(snapshot).then(result => {
      this.accept(snapshot, revision, result)
    }))
    this.pending = run.finally(() => { this.pending = null })
    return this.pending
  }

  /**
   * 预览里勾选任务是一次完成的修改。连续勾选只保存最后一次，
   * 成功时保持已保存；服务端已收下的重复提交不再提示。真正失败才标成未保存。
   */
  commit(content: string, write: (note: Note) => Promise<unknown>): Promise<void> {
    if (!this.note) return Promise.resolve()
    this.writer = write
    if (this.note.content !== content) {
      this.note = { ...this.note, content }
      this.revision++
    }
    return this.kick()
  }

  private kick(): Promise<void> {
    if (!this.note || this.dirty || this.revision === this.savedRevision) return this.flight ?? Promise.resolve()
    if (this.flight) return this.flight.then(() => this.kick(), () => this.kick())
    const write = this.writer
    if (!write) return Promise.resolve()
    this.flight = this.flush(write).finally(() => { this.flight = null })
    return this.flight
  }

  private async flush(write: (note: Note) => Promise<unknown>): Promise<void> {
    while (this.note && !this.dirty && this.revision !== this.savedRevision) {
      const current = this.writer ?? write
      const snapshot = { ...this.note }
      const revision = this.revision
      try {
        const result = await current(snapshot)
        if (this.note?.id !== snapshot.id) return
        this.keepHash(snapshot, result)
        if (this.note.content === snapshot.content) {
          this.savedRevision = this.revision
          if (this.revision === revision) this.dirty = false
        }
      } catch (cause) {
        if (this.note?.id !== snapshot.id) throw cause
        if (this.note.content !== snapshot.content) continue
        if (isRepeatSubmit(cause)) {
          this.savedRevision = this.revision
          this.dirty = false
          return
        }
        this.dirty = true
        throw cause
      }
    }
  }

  private keepHash(snapshot: Note, result: unknown): void {
    if (this.note?.id !== snapshot.id) return
    const contentHash = contentHashFrom(result)
    if (contentHash) this.note = { ...this.note, contentHash }
  }

  private enqueue(job: () => Promise<void>): Promise<void> {
    const run = this.tail.then(job, job)
    this.tail = run.then(() => undefined, () => undefined)
    return run
  }

  private accept(snapshot: Note, revision: number, result: unknown): void {
    if (this.note?.id !== snapshot.id || this.revision !== revision) return
    this.dirty = false
    this.savedRevision = revision
    const contentHash = contentHashFrom(result)
    if (contentHash) this.note = { ...this.note, contentHash }
  }
}
