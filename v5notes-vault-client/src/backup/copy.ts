/** Product copy: whole-vault zip is backup only — never Sync. */

export const BACKUP_NOT_SYNC_LINE =
  '整库 zip 仅作备份与迁机，不是日常同步。日常 Sync 走文件级增量；请勿用 zip 覆盖当作 Sync。'

export const BACKUP_SCOPE_HELP =
  '备份包含笔记与附件，以及 .v5notes/vault.json 等库元数据；排除本地 trash、sync-state、index.sqlite 与临时文件。'

export const MIGRATION_EXPLICIT_LINE =
  'Cloud 笔记与 Vault 库默认不通。迁入/迁出须显式确认；本工具不会自动合并两个空间。'

export const MIGRATION_STEPS_HELP =
  'Cloud → Vault：在 Cloud 导出 Markdown/附件后，手动放入本机 Vault 文件夹。Vault → Cloud：用备份 zip 解压后，经 Cloud 客户端导入或粘贴——不会静默双向同步。'
