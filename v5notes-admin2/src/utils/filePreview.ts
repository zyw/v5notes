/** 文件预览分类与扩展名判定 */

export type FilePreviewKind = 'image' | 'viewer' | 'text' | 'unsupported';

const IMAGE_EXTS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'webp',
  'svg',
  'ico',
  'avif',
  'tif',
  'tiff'
]);

/** File Viewer 按需装配覆盖的格式 */
const VIEWER_EXTS = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip']);

const TEXT_EXTS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'jsonc',
  'json5',
  'xml',
  'html',
  'htm',
  'css',
  'scss',
  'less',
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
  'vue',
  'java',
  'py',
  'go',
  'rs',
  'php',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'rb',
  'kt',
  'swift',
  'sql',
  'sh',
  'bash',
  'yml',
  'yaml',
  'toml',
  'ini',
  'conf',
  'log',
  'csv',
  'tsv',
  'properties',
  'env',
  'gitignore',
  'dockerfile',
  'makefile'
]);

export function normalizeSuffix(suffix?: string | null, fileName?: string | null): string {
  const fromSuffix = String(suffix || '')
    .trim()
    .replace(/^\./, '')
    .toLowerCase();
  if (fromSuffix) return fromSuffix;
  const name = String(fileName || '');
  const idx = name.lastIndexOf('.');
  if (idx < 0 || idx === name.length - 1) return '';
  return name.slice(idx + 1).toLowerCase();
}

export function resolvePreviewKind(suffix?: string | null, fileName?: string | null): FilePreviewKind {
  const ext = normalizeSuffix(suffix, fileName);
  if (!ext) return 'unsupported';
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIEWER_EXTS.has(ext)) return 'viewer';
  if (TEXT_EXTS.has(ext)) return 'text';
  return 'unsupported';
}

export function isPreviewable(suffix?: string | null, fileName?: string | null): boolean {
  return resolvePreviewKind(suffix, fileName) !== 'unsupported';
}
