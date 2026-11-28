import { describe, expect, it } from 'vitest';
import { isPreviewable, normalizeSuffix, resolvePreviewKind } from './filePreview';

describe('filePreview MIME fallback', () => {
  it('resolves suffix and preview kind from MIME type when name has no extension', () => {
    const shaName = '391cd4a040c87a079d8df484b03b4b664e59324c9ee2ca6097f34014ff66f407';

    expect(normalizeSuffix('', shaName, 'image/png')).toBe('png');
    expect(resolvePreviewKind('', shaName, 'image/png')).toBe('image');
    expect(resolvePreviewKind('', shaName, 'image/jpeg')).toBe('image');
    expect(resolvePreviewKind('', shaName, 'image/webp')).toBe('image');
    expect(resolvePreviewKind('', shaName, 'application/pdf')).toBe('viewer');
    expect(resolvePreviewKind('', shaName, 'text/plain; charset=utf-8')).toBe('text');
    expect(isPreviewable('', shaName, 'image/png')).toBe(true);
  });

  it('keeps application/octet-stream without extension as unsupported', () => {
    const shaName = '391cd4a040c87a079d8df484b03b4b664e59324c9ee2ca6097f34014ff66f407';

    expect(normalizeSuffix('', shaName, 'application/octet-stream')).toBe('');
    expect(resolvePreviewKind('', shaName, 'application/octet-stream')).toBe('unsupported');
    expect(isPreviewable('', shaName, 'application/octet-stream')).toBe(false);
  });
});
