import { describe, expect, it, vi } from 'vitest'
import { createApi } from '.'

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
    expect(JSON.parse(calls[1][1].body as string).id).toBe('934509293439939393')
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

  it('normalizes a scalar create response to a string ID', async () => {
    const api = createApi(() => ({ server: 'https://notes.test', clientId: 'client', token: 'token' }), () => {},
      vi.fn(async () => new Response(JSON.stringify({ code: 200, data: 0 }))) as typeof fetch)
    expect(await api.create({ name: 'Test', dirId: '0', content: '' })).toBe('0')
  })
})
