import { describe, expect, it } from 'vitest';
import { isPreviewable, normalizeSuffix, resolvePreviewKind, videoMimeFromSuffix } from './filePreview';

describe('filePreview MIME fallback', () => {
  it('resolves suffix and preview kind from MIME type when name has no extension', () => {
    const shaName = '391cd4a040c87a079d8df484b03b4b664e59324c9ee2ca6097f34014ff66f407';

    expect(normalizeSuffix('', shaName, 'image/png')).toBe('png');
    expect(resolvePreviewKind('', shaName, 'image/png')).toBe('image');
    expect(resolvePreviewKind('', shaName, 'image/jpeg')).toBe('image');
    expect(resolvePreviewKind('', shaName, 'image/webp')).toBe('image');
    expect(resolvePreviewKind('', shaName, 'video/mp4')).toBe('video');
    expect(resolvePreviewKind('', shaName, 'video/webm')).toBe('video');
    expect(resolvePreviewKind('', shaName, 'video/quicktime')).toBe('video');
    expect(resolvePreviewKind('', shaName, 'video/ogg')).toBe('video');
    expect(resolvePreviewKind('', shaName, 'application/pdf')).toBe('viewer');
    expect(resolvePreviewKind('', shaName, 'text/plain; charset=utf-8')).toBe('text');
    expect(isPreviewable('', shaName, 'image/png')).toBe(true);
    expect(isPreviewable('', shaName, 'video/mp4')).toBe(true);
  });

  it('resolves video extensions and fallback MIME types', () => {
    for (const ext of ['mp4', 'm4v', 'webm', 'ogv', 'mov']) {
      expect(resolvePreviewKind(ext, `clip.${ext}`)).toBe('video');
      expect(isPreviewable(ext, `clip.${ext}`)).toBe(true);
    }
    expect(resolvePreviewKind('ogg', 'clip.ogg', 'video/ogg')).toBe('video');
    expect(videoMimeFromSuffix('mp4')).toBe('video/mp4');
    expect(videoMimeFromSuffix('.m4v')).toBe('video/mp4');
    expect(videoMimeFromSuffix('webm')).toBe('video/webm');
    expect(videoMimeFromSuffix('ogv')).toBe('video/ogg');
    expect(videoMimeFromSuffix('ogg')).toBe('video/ogg');
    expect(videoMimeFromSuffix('mov')).toBe('video/quicktime');
    expect(videoMimeFromSuffix('png')).toBe('');
  });

  it('keeps application/octet-stream without extension as unsupported', () => {
    const shaName = '391cd4a040c87a079d8df484b03b4b664e59324c9ee2ca6097f34014ff66f407';

    expect(normalizeSuffix('', shaName, 'application/octet-stream')).toBe('');
    expect(resolvePreviewKind('', shaName, 'application/octet-stream')).toBe('unsupported');
    expect(isPreviewable('', shaName, 'application/octet-stream')).toBe(false);
  });
});
