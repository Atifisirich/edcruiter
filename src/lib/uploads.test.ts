import { describe, expect, it } from 'vitest';
import { safeUploadPath, extensionForMime, randomUploadFilename, mediaUrlFor, UPLOADS_DIR } from './uploads';

describe('safeUploadPath', () => {
  it('resolves a plain filename inside the uploads directory', () => {
    const resolved = safeUploadPath('rec_123_abcde.webm');
    expect(resolved).not.toBeNull();
    expect(resolved!.startsWith(UPLOADS_DIR)).toBe(true);
  });

  it('rejects a parent-directory traversal attempt', () => {
    // Regression: the original upload route built the save path from the
    // client-supplied filename directly, so a name containing "../" could
    // resolve outside the uploads directory entirely.
    expect(safeUploadPath('../../.env')).toBeNull();
    expect(safeUploadPath('..%2f..%2f.env')).toBeNull();
  });

  it('rejects an absolute path', () => {
    expect(safeUploadPath('/etc/passwd')).toBeNull();
  });

  it('rejects a filename containing a null byte', () => {
    expect(safeUploadPath('rec_123.webm\0.html')).toBeNull();
  });
});

describe('extensionForMime', () => {
  it('maps known media MIME types to their extension', () => {
    expect(extensionForMime('video/webm', 'media')).toBe('webm');
    expect(extensionForMime('video/mp4', 'media')).toBe('mp4');
  });

  it('maps application/pdf to pdf for the resume kind only', () => {
    expect(extensionForMime('application/pdf', 'resume')).toBe('pdf');
    expect(extensionForMime('application/pdf', 'media')).toBeNull();
  });

  it('rejects a MIME type that would let a caller choose an executable extension', () => {
    // Regression: the previous upload route derived the extension from
    // `file.name.split('.').pop()`, so a caller could request `.html` and
    // get it saved verbatim — stored XSS on this origin.
    expect(extensionForMime('text/html', 'media')).toBeNull();
    expect(extensionForMime('application/javascript', 'media')).toBeNull();
  });

  it('matches a MediaRecorder blob type that carries codec parameters', () => {
    // Regression: a recorded video/audio blob's reported type is almost
    // never the bare "video/webm" this table keys on — browsers report
    // "video/webm;codecs=vp8,opus" (exact codec string varies). An
    // exact-match lookup against the full string rejected nearly every
    // real candidate recording with a 415, which the uploader then masked
    // by silently falling back to a tab-local blob: URL that looked like
    // a successful submission but was unplayable and unscoreable anywhere
    // outside that one browser tab.
    expect(extensionForMime('video/webm;codecs=vp8,opus', 'media')).toBe('webm');
    expect(extensionForMime('video/webm;codecs=vp9,opus', 'media')).toBe('webm');
    expect(extensionForMime('video/mp4;codecs=avc1,mp4a.40.2', 'media')).toBe('mp4');
  });
});

describe('randomUploadFilename / mediaUrlFor', () => {
  it('never echoes user input into the generated filename', () => {
    const a = randomUploadFilename('rec', 'webm');
    const b = randomUploadFilename('rec', 'webm');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^rec_\d+_[0-9a-f]{12}\.webm$/);
  });

  it('builds a media URL under the authenticated /api/media prefix, not the old public path', () => {
    expect(mediaUrlFor('rec_1_abc.webm')).toBe('/api/media/rec_1_abc.webm');
  });
});
