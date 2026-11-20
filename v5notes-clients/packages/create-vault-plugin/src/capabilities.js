/**
 * Permission tables mirrored from the Vault Client host
 * (v5notes-vault-client/src/plugin-host/permissions.ts).
 *
 * The scaffold must refuse what the host refuses, and it should not pretend a
 * permission does something the host has not wired up yet.
 */

/** Third parties may never request or receive these. */
export const FORBIDDEN_PERMISSIONS = [
  'network',
  'publish',
  'publish:*',
  'sync:control',
  'fs:arbitrary',
  'shell',
];

/** Accepted by the host and backed by host code today. */
export const USABLE_PERMISSIONS = [
  'vault:read',
  'vault:write',
  'ui:commands',
  'ui:ribbon',
  'ui:settings',
  'ui:views',
  'ui:theme',
  'editor:provide',
  'network:safe',
];

/**
 * Accepted by the host validator and stored on the plugin, but with no host
 * consumer yet. Declaring one is not an error — the plugin keeps working when
 * the host catches up — it is a warning worth saying out loud.
 */
export const RESERVED_PERMISSIONS = ['ui:status', 'editor:extend', 'clipboard'];

export const ALL_KNOWN_PERMISSIONS = [...USABLE_PERMISSIONS, ...RESERVED_PERMISSIONS];

const FORBIDDEN_TAGS = ['publishing', 'publish', 'publisher'];

export function validatePermissions(permissions = []) {
  const errors = [];
  for (const perm of permissions) {
    if (typeof perm !== 'string' || !perm.trim()) {
      errors.push('权限列表里有空项');
      continue;
    }
    const raw = perm.trim();
    if (FORBIDDEN_PERMISSIONS.includes(raw) || raw.startsWith('publish:')) {
      errors.push(raw + '：第三方永不发放，宿主会拒绝安装');
    } else if (!ALL_KNOWN_PERMISSIONS.includes(raw)) {
      errors.push(raw + '：未知权限（可用：' + ALL_KNOWN_PERMISSIONS.join(', ') + '）');
    }
  }
  return { errors, warnings: reservedWarnings(permissions) };
}

export function reservedWarnings(permissions = []) {
  return permissions
    .map((p) => String(p).trim())
    .filter((p) => RESERVED_PERMISSIONS.includes(p))
    .map((p) => p + ' 已被宿主接受，但当前没有对应的界面或 API，声明后不会出错也不会生效');
}

export function hasPublishingTag(tags) {
  if (!Array.isArray(tags)) return false;
  return tags.some((tag) => FORBIDDEN_TAGS.includes(String(tag).trim().toLowerCase()));
}

/** "a,b, c" | ["a", "b"] | undefined -> clean list. */
export function parseList(value) {
  if (value == null) return [];
  const items = Array.isArray(value) ? value : String(value).split(',');
  return items.map((item) => String(item).trim()).filter(Boolean);
}
