import { Plugin, type PluginManifest } from '@v5notes/vault-plugin-api'

export const TEMPLATES_MANIFEST: PluginManifest = {
  id: 'templates',
  name: '模板',
  kind: 'plugin',
  version: '1.0.0',
  minAppVersion: '0.1.0',
  description: '从 Templates 目录插入模板（核心插件）',
  author: 'v5notes',
  permissions: ['vault:read', 'vault:write', 'ui:commands'],
  main: 'core',
}

const DEFAULT_TEMPLATE = `---
title: {{title}}
created: {{date}}
---

# {{title}}

`

export class TemplatesPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'insert-default-template',
      name: '插入默认模板到新笔记',
      callback: async () => {
        const dir = 'Templates'
        const templatePath = `${dir}/默认模板.md`
        const has = await this.app.vault.exists(templatePath).catch(() => false)
        if (!has) {
          await this.app.vault.write(templatePath, DEFAULT_TEMPLATE)
        }
        const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')
        const notePath = `笔记-${stamp}.md`
        let body = await this.app.vault.read(templatePath)
        const title = notePath.replace(/\.md$/, '')
        const date = new Date().toISOString().slice(0, 10)
        body = body.replaceAll('{{title}}', title).replaceAll('{{date}}', date)
        await this.app.vault.write(notePath, body)
        if (this.app.workspace.openFile) {
          await this.app.workspace.openFile(notePath)
        }
        this.app.workspace.openNotice(`已从模板创建 ${notePath}`)
      },
    })
  }
}
