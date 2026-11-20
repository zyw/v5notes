/**
 * Plugin ids are the directory name, the manifest id, and the namespace of
 * every command or ribbon the plugin registers. The host regex is the source
 * of truth: [a-z0-9-]+.
 */

export const PLUGIN_ID_RE = /^[a-z0-9-]+$/;

/** "My Notes!" -> "my-notes". Throws when nothing usable is left. */
export function slugifyId(input) {
  const slug = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) {
    throw new Error('无法从名称生成插件 id，请用 --id 指定一个（只允许 a-z 0-9 -）');
  }
  return assertPluginId(slug);
}

/** Reject an id the host would silently skip instead of loading. */
export function assertPluginId(id) {
  const value = String(id ?? '').trim();
  if (!PLUGIN_ID_RE.test(value)) {
    throw new Error('插件 id「' + value + '」不合法：只允许 a-z、0-9、-');
  }
  return value;
}

/**
 * The host skips a package whose folder name disagrees with manifest.id,
 * without any message. Catch that at scaffold time instead.
 */
export function assertDirMatchesId(dirName, id) {
  if (dirName !== id) {
    throw new Error(
      '目录名「' + dirName + '」与 manifest.id「' + id + '」不一致；宿主会静默跳过这个包。' +
        ' 请把目录改名为 id，或者改用 --id ' + dirName,
    );
  }
}
