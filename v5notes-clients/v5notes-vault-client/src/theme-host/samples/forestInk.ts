/** Bundled Forest Ink sample (also mirrored under samples/forest-ink/ for install-to-vault).
 * Keep FOREST_INK_CSS byte-identical to samples/forest-ink/theme.css. */
import css from './forest-ink/theme.css?raw'
import meta from './forest-ink/theme.json'

export const FOREST_INK_MANIFEST = {
  id: 'forest-ink',
  name: '林墨',
  kind: 'theme' as const,
  version: '1.2.0',
  minAppVersion: '0.1.0',
  description: '冷绿纸底 + 墨绿强调，深色为林间夜色',
  author: 'v5notes',
  permissions: ['ui:theme'] as const,
  theme: 'theme.css',
  themeMeta: 'theme.json',
}

export const FOREST_INK_CSS = css
export const FOREST_INK_META = meta
