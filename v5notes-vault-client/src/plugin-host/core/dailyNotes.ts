import { Plugin, type PluginManifest } from '@v5notes/vault-plugin-api'

export const DAILY_NOTES_MANIFEST: PluginManifest = {
  id: 'daily-notes',
  name: '日记',
  kind: 'plugin',
  version: '1.0.0',
  minAppVersion: '0.1.0',
  description: '打开或创建今日日记（核心插件）',
  author: 'v5notes',
  permissions: ['vault:read', 'vault:write', 'ui:commands'],
  main: 'core',
}

function todayPath(folder = '日记'): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${folder}/${y}-${m}-${day}.md`
}

export class DailyNotesPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'open-today',
      name: '打开今日日记',
      callback: async () => {
        const path = todayPath()
        const folder = '日记'
        const existsFolder = await this.app.vault.exists(folder).catch(() => false)
        if (!existsFolder) {
          // Ensure folder via writing the note path; vault adapter mkdir may be absent — write creates parents in host.
          await this.app.vault.write(path, `# ${path.split('/').pop()?.replace(/\.md$/, '')}\n\n`)
        } else {
          const exists = await this.app.vault.exists(path)
          if (!exists) {
            const title = path.split('/').pop()?.replace(/\.md$/, '') || '今日'
            await this.app.vault.write(path, `# ${title}\n\n`)
          }
        }
        if (this.app.workspace.openFile) {
          await this.app.workspace.openFile(path)
        }
        this.app.workspace.openNotice(`日记: ${path}`)
      },
    })
  }
}
