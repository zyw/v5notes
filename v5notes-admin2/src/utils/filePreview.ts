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

const MIME_TO_SUFFIX: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/x-ms-bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/avif': 'avif',
  'image/tiff': 'tiff',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/json': 'json',
  'text/html': 'html',
  'text/css': 'css',
  'application/javascript': 'js',
  'text/javascript': 'js',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'application/zip': 'zip',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
};

export function suffixFromMimeType(mimeType?: string | null): string {
  const normalized = String(mimeType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!normalized || normalized === 'application/octet-stream') return '';
  return MIME_TO_SUFFIX[normalized] || '';
}

export function normalizeSuffix(suffix?: string | null, fileName?: string | null, mimeType?: string | null): string {
  const fromSuffix = String(suffix || '')
    .trim()
    .replace(/^\./, '')
    .toLowerCase();
  if (fromSuffix) return fromSuffix;
  const name = String(fileName || '');
  const idx = name.lastIndexOf('.');
  if (idx >= 0 && idx < name.length - 1) {
    return name.slice(idx + 1).toLowerCase();
  }
  return suffixFromMimeType(mimeType);
}

export function resolvePreviewKind(suffix?: string | null, fileName?: string | null, mimeType?: string | null): FilePreviewKind {
  const ext = normalizeSuffix(suffix, fileName, mimeType);
  if (ext) {
    if (IMAGE_EXTS.has(ext)) return 'image';
    if (VIEWER_EXTS.has(ext)) return 'viewer';
    if (TEXT_EXTS.has(ext)) return 'text';
    return 'unsupported';
  }
  const normalizedMime = String(mimeType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (normalizedMime.startsWith('image/')) return 'image';
  if (normalizedMime.startsWith('text/')) return 'text';
  return 'unsupported';
}

export function isPreviewable(suffix?: string | null, fileName?: string | null, mimeType?: string | null): boolean {
  return resolvePreviewKind(suffix, fileName, mimeType) !== 'unsupported';
}
