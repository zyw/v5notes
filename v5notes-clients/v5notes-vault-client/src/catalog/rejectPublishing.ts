const FORBIDDEN = new Set(['publishing', 'publish', 'publisher'])

export function hasPublishingTag(tags: string[] | undefined | null): boolean {
  if (!tags?.length) return false
  return tags.some((t) => FORBIDDEN.has(String(t).trim().toLowerCase()))
}

export function assertCatalogItemInstallable(item: {
  tags?: string[]
  permissions?: string[]
}): void {
  if (hasPublishingTag(item.tags)) {
    throw new Error('拒绝 publishing 标签：第三方无发布；发布仅为官方功能')
  }
  for (const perm of item.permissions || []) {
    if (perm === 'publish' || perm === 'publish:*' || perm.startsWith('publish:')) {
      throw new Error(`拒绝 publish 权限声明「${perm}」`)
    }
    if (perm === 'network') {
      throw new Error('拒绝无限制 network 权限')
    }
  }
}
