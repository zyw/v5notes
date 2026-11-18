import http from 'node:http'

const noteContent = [
  '# 十月的一个下午',
  '',
  '把窗子开到最大，让风经过桌面。写下来的东西，才算真正想过。',
  '',
  '## 今天做的三件事',
  '',
  '- 把目录树收起来，只留正文',
  '- 写完第三稿，回退到昨天那一版',
  '- [x] 给「专注写作」换一个更安静的入口',
  '',
  '> 笔记不是仓库，是工作台。',
  '',
  '### 一段代码',
  '',
  '```ts',
  'const draft = await save(note)',
  'if (draft.conflict) restore(latest)',
  '```',
  '',
  '| 版本 | 时间 | 改动 |',
  '| --- | --- | --- |',
  '| 第 2 稿 | 10 月 11 日 | 删掉第二节 |',
  '| 第 3 稿 | 10 月 12 日 | 只留第三段 |',
  '',
  '最后一句：**写下去**，比写完更重要。',
].join('\n')

const tree = [
  { id: '1001', pid: '0', label: '写作', type: 1, children: [
    { id: '1101', pid: '1001', label: '十月的一个下午', type: 2 },
    { id: '1102', pid: '1001', label: '关于专注的两句话', type: 2 },
  ]},
  { id: '1002', pid: '0', label: '读书笔记', type: 1, children: [
    { id: '1201', pid: '1002', label: '缓慢的阅读', type: 2 },
  ]},
  { id: '1003', pid: '0', label: '产品', type: 1, children: [] },
  { id: '1301', pid: '0', label: '周记 · 第 44 周', type: 2 },
]

const note = { id: '1101', dirId: '0', name: '十月的一个下午', content: noteContent, contentHash: 'hash-1', updateTime: '2026-10-12 18:20:00' }
const envelope = data => JSON.stringify({ code: 200, msg: 'ok', data })
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Content-Type': 'application/json' }

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, headers); res.end(); return }
  const url = new URL(req.url, 'http://127.0.0.1:1421')
  const send = data => { res.writeHead(200, headers); res.end(envelope(data)) }
  if (url.pathname === '/client/ping') return send(true)
  if (url.pathname === '/client/notes/dir/tree') return send(tree)
  if (url.pathname === '/system/user/getInfo') return send({ user: { userId: '1', userName: 'zyw', nickName: 'zyw', avatar: '' } })
  if (url.pathname === '/client/notes/new-notes') return send({ rows: [note], total: 1 })
  if (url.pathname === '/client/notes/search') return send([])
  if (url.pathname === '/client/notes/list') return send({ rows: [note], total: 1 })
  if (url.pathname === '/client/notes/1101') return send(note)
  if (url.pathname.endsWith('/revisions')) return send({ rows: [
    { id: '9001', noteId: '1101', contentHash: 'hash-1', excerpt: '把窗子开到最大，让风经过桌面。', size: 420, createTime: '2026-10-12 18:20:00' },
    { id: '9002', noteId: '1101', contentHash: 'hash-0', excerpt: '初稿：只写了三行。', size: 210, createTime: '2026-10-11 09:05:00' },
  ], total: 2 })
  if (url.pathname.includes('/revisions/')) return send({ id: '9001', noteId: '1101', contentHash: 'hash-1', content: noteContent, createTime: '2026-10-12 18:20:00' })
  if (url.pathname === '/basics/base/file/images') return send({ rows: [], total: 0 })
  res.writeHead(200, headers); res.end(envelope(null))
}).listen(1421, '127.0.0.1', () => console.log('mock on 1421'))
