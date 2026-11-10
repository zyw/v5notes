import { describe, expect, it, vi } from 'vitest'
import { createApi } from '.'
import { ConflictError } from '../request'

describe('client API', () => {
  it('sends string snowflake IDs unchanged in reads and saves', async () => {
    const calls: Array<[string, RequestInit]> = []
    const request = vi.fn(async (url: string, options: RequestInit) => {
      calls.push([url, options])
      return new Response(JSON.stringify({ code: 200, data: { id: '934509293439939393', dirId: 0, content: '# hi' } }), { status: 200 })
    })
    const api = createApi(() => ({ server: 'https://notes.test/', clientId: 'client', token: 'token' }), () => {}, request as typeof fetch)
    const note = await api.read('934509293439939393')
    await api.update({ ...note, content: '# updated' })
    expect(note.dirId).toBe('0')
    expect(calls[0][0]).toBe('https://notes.test/client/notes/934509293439939393')
    const saved = JSON.parse(calls[1][1].body as string)
    expect(saved.id).toBe('934509293439939393')
    expect(saved.baseHash).toBe('')
    expect(saved.force).toBe(false)
    expect((calls[1][1].headers as Record<string, string>).Authorization).toBe('Bearer token')
  })

  it('reports an expired session without discarding the draft', async () => {
    const expired = vi.fn()
    const api = createApi(() => ({ server: 'https://notes.test', clientId: 'client', token: 'expired' }), expired,
      vi.fn(async () => new Response(JSON.stringify({ code: 401, msg: 'expired' }), { status: 200 })) as typeof fetch)
    await expect(api.read('2')).rejects.toThrow('expired')
    expect(expired).toHaveBeenCalledOnce()
  })

  it('uses the required encrypted login header and keeps passwords out of the raw body', async () => {
    let sent!: RequestInit
    const api = createApi(() => ({ server: 'https://notes.test', clientId: 'client', token: '' }), () => {},
      vi.fn(async (_url, init) => {
        sent = init as RequestInit
        return new Response(JSON.stringify({ code: 200, data: { access_token: 'token' } }))
      }) as typeof fetch)
    await api.login('me', 'secret')
    expect((sent.headers as Record<string, string>)['encrypt-key']).toBeTruthy()
    expect(sent.body).not.toContain('secret')
  })

  it('loads the signed-in user image library by page', async () => {
    let url = ''
    const api = createApi(() => ({ server: 'https://notes.test', clientId: 'client', token: 'token' }), () => {},
      vi.fn(async (requestUrl: string) => {
        url = requestUrl
        return new Response(JSON.stringify({
          code: 200,
          data: { rows: [{ id: '934509293439939393', name: '照片.png', url: 'https://cdn.example/a.png' }], total: 1 },
        }))
      }) as typeof fetch)
    const page = await api.listMyImages(2, ' 照片 ')
    expect(url).toBe('https://notes.test/basics/base/file/images?pageNum=2&pageSize=24&name=%E7%85%A7%E7%89%87')
    expect(page.total).toBe(1)
    expect(page.rows[0]?.id).toBe('934509293439939393')
  })

  it('reads the id from a create response that also carries the content hash', async () => {
    const api = createApi(() => ({ server: 'https://notes.test', clientId: 'client', token: 'token' }), () => {},
      vi.fn(async () => new Response(JSON.stringify({ code: 200, data: { id: '934509293439939393', contentHash: 'ab' } }))) as typeof fetch)
    expect(await api.create({ name: 'Test', dirId: '0', content: '' })).toBe('934509293439939393')
  })

  it('exposes the current hash when a save conflicts', async () => {
    const api = createApi(() => ({ server: 'https://notes.test', clientId: 'client', token: 'token' }), () => {},
      vi.fn(async () => new Response(JSON.stringify({
        code: 409,
        msg: '笔记已在其他地方保存',
        data: { contentHash: 'c'.repeat(64), updateTime: '2026-11-08 22:00:00' },
      }))) as typeof fetch)
    await expect(api.update({ id: '2', dirId: '0', name: '笔记', content: '新', contentHash: 'a'.repeat(64) })).rejects.toMatchObject({
      name: 'ConflictError',
      message: '笔记已在其他地方保存',
      contentHash: 'c'.repeat(64),
      updateTime: '2026-11-08 22:00:00',
    })
    await expect(api.read('2')).rejects.toBeInstanceOf(ConflictError)
  })

  it('keeps trash ids as strings and uses the trash endpoints', async () => {
    const calls: string[] = []
    const api = createApi(() => ({ server: 'https://notes.test', clientId: 'client', token: 'token' }), () => {},
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method || 'GET'} ${url}`)
        return new Response(JSON.stringify({
          code: 200,
          data: {
            rows: [{ id: '934509293439939393', objectId: '934509293439939394', objectType: '2', name: '工作', originalPath: '根目录', noteCount: 1, dirCount: 1, daysLeft: 29 }],
            total: 1,
            objectId: '934509293439939394',
            parentId: '0',
            relocated: true,
            failed: 0,
          },
        }))
      }) as typeof fetch)
    const page = await api.trash(1)
    const restored = await api.restoreTrash('934509293439939393')
    await api.purgeTrash('934509293439939393')
    await api.emptyTrash()
    expect(page.rows[0]?.id).toBe('934509293439939393')
    expect(page.rows[0]?.objectId).toBe('934509293439939394')
    expect(restored.parentId).toBe('0')
    expect(restored.relocated).toBe(true)
    expect(calls).toEqual([
      'GET https://notes.test/client/notes/trash?pageNum=1&pageSize=20',
      'POST https://notes.test/client/notes/trash/934509293439939393/restore',
      'DELETE https://notes.test/client/notes/trash/934509293439939393',
      'DELETE https://notes.test/client/notes/trash',
    ])
  })

  it('normalizes a scalar create response to a string ID', async () => {
    const api = createApi(() => ({ server: 'https://notes.test', clientId: 'client', token: 'token' }), () => {},
      vi.fn(async () => new Response(JSON.stringify({ code: 200, data: 0 }))) as typeof fetch)
    expect(await api.create({ name: 'Test', dirId: '0', content: '' })).toBe('0')
  })
})
