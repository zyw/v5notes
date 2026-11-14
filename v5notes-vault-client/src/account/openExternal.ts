import { invoke, isTauri } from '@tauri-apps/api/core'

/** 在系统浏览器中打开 http(s) 链接；非 Tauri 则同页跳转。 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    await invoke('open_external_url', { url })
    return
  }
  window.location.assign(url)
}
