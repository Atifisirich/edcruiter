/**
 * Every camera and microphone stream the test opens is listed here, so they can
 * all be switched off in one go. Several parts of the page open the camera (the
 * live check, the recorder, the permission check), and a stream opened just as
 * its part was closed would otherwise be left running with nobody holding it,
 * which is how the camera could stay on after the last stage.
 */

const open = new Set<MediaStream>();

export function trackStream<T extends MediaStream | null | undefined>(stream: T): T {
  if (stream) open.add(stream);
  return stream;
}

export function stopStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try { track.stop(); } catch { /* already stopped */ }
  });
  open.delete(stream);
}

/** Switches off every camera and microphone the test has opened. */
export function stopAllMedia(): void {
  for (const stream of [...open]) stopStream(stream);
  // A video element still holding a stream keeps the camera light on in some browsers.
  if (typeof document !== 'undefined') {
    document.querySelectorAll('video').forEach((v) => {
      const src = v.srcObject;
      if (src instanceof MediaStream) {
        src.getTracks().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });
        v.srcObject = null;
      }
    });
  }
}

export function openStreamCount(): number {
  return [...open].filter((s) => s.getTracks().some((t) => t.readyState === 'live')).length;
}
