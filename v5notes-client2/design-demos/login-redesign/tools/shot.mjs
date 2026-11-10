import { spawn } from 'node:child_process'
import fs from 'node:fs'

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const root = process.argv[2]
const url = process.argv[3]
const width = Number(process.argv[4] || 1440)
const height = Number(process.argv[5] || 900)
const out = process.argv[6]
const dpr = Number(process.argv[7] || 2)
const port = 9334
const profile = root + '/.tmp-chrome-login-shot'

const child = spawn(chromePath, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  '--no-first-run', '--no-default-browser-check',
  ...(process.env.SHOT_SCROLLBARS === 'show' ? [] : ['--hide-scrollbars']),
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + profile,
  '--force-device-scale-factor=1',
  'about:blank',
], { env: { ...process.env, TMPDIR: root + '/.tmp-chrome' }, stdio: 'ignore' })

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function targetWs() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/new?about:blank', { method: 'PUT' })
      const json = await res.json()
      if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl
    } catch {}
    await sleep(150)
  }
  throw new Error('chrome did not start')
}

const ws = new WebSocket(await targetWs())
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
let seq = 0
const pending = new Map()
ws.onmessage = event => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(msg.method + ': ' + msg.error.message)) : resolve(msg.result)
  }
}
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq
  pending.set(id, { resolve, reject })
  ws.send(JSON.stringify({ id, method, params }))
})

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false })
await send('Page.navigate', { url })
await sleep(Number(process.env.SHOT_WAIT || 1600))

const evalSource = process.env.SHOT_EVAL_FILE ? fs.readFileSync(process.env.SHOT_EVAL_FILE, 'utf8') : process.env.SHOT_EVAL
if (evalSource) {
  const result = await send('Runtime.evaluate', { expression: evalSource, awaitPromise: true, returnByValue: true })
  console.log('eval: ' + JSON.stringify(result.result && result.result.value))
  await sleep(600)
}

if (process.env.SHOT_MEASURE === '1') {
  const metrics = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const pick = (sel) => Array.from(document.querySelectorAll(sel)).map(el => {
        const r = el.getBoundingClientRect()
        return { cls: el.className, top: +r.top.toFixed(1), h: +r.height.toFixed(1), w: +r.width.toFixed(1), left: +r.left.toFixed(1) }
      })
      const dialog = document.querySelector('.settings-dialog')
      const body = document.querySelector('.settings-body')
      return {
        viewport: [innerWidth, innerHeight],
        dialog: dialog ? { top: +dialog.getBoundingClientRect().top.toFixed(1), h: +dialog.getBoundingClientRect().height.toFixed(1) } : null,
        bodyScroll: body ? [body.scrollHeight, body.clientHeight] : null,
        els: [...pick('.settings-header'), ...pick('.settings-conn'), ...pick('.settings-panel'), ...pick('.settings-panel-head'), ...pick('.settings-preference-row'), ...pick('.settings-footer')],
      }
    })()`,
  })
  console.log(JSON.stringify(metrics.result.value))
}

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
fs.writeFileSync(out, Buffer.from(shot.data, 'base64'))
console.log('wrote ' + out)

ws.close()
child.kill('SIGKILL')
process.exit(0)
