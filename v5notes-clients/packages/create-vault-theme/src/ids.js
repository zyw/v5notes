export const THEME_ID_RE = /^[a-z0-9-]+$/;

/** "Ink Night" -> "ink-night"; mirrors the plugin scaffold. */
export function slugifyId(input) {
  const slug = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug || !THEME_ID_RE.test(slug)) {
    throw new Error('无法从目录名生成主题 id，请改用 --id 指定一个（只允许 a-z 0-9 -）');
  }
  return slug;
}
