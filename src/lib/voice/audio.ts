/**
 * Audio helpers for phone calls: the codecs Vobiz speaks (mu-law and 16-bit
 * linear PCM), changing the sample rate, and wrapping or unwrapping WAV files
 * for Sarvam. Pure functions, no I/O, so they are easy to test.
 *
 * "PCM" here always means mono, signed 16-bit, little-endian samples.
 */

export type Pcm = Int16Array;

// --- mu-law (G.711), the 8 kHz format phone networks use ---------------------

const MULAW_BIAS = 0x84;
const MULAW_CLIP = 32635;

/** One table lookup per sample: mu-law byte -> 16-bit sample. */
const MULAW_TO_PCM: Int16Array = (() => {
  const table = new Int16Array(256);
  for (let i = 0; i < 256; i++) {
    const u = ~i & 0xff;
    const sign = u & 0x80;
    const exponent = (u >> 4) & 0x07;
    const mantissa = u & 0x0f;
    const magnitude = (((mantissa << 3) + MULAW_BIAS) << exponent) - MULAW_BIAS;
    table[i] = sign ? -magnitude : magnitude;
  }
  return table;
})();

export function mulawDecode(bytes: Uint8Array): Pcm {
  const out = new Int16Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = MULAW_TO_PCM[bytes[i]];
  return out;
}

function mulawEncodeSample(sample: number): number {
  const sign = sample < 0 ? 0x80 : 0;
  let magnitude = sign ? -sample : sample;
  if (magnitude > MULAW_CLIP) magnitude = MULAW_CLIP;
  magnitude += MULAW_BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (magnitude & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

export function mulawEncode(pcm: Pcm): Uint8Array {
  const out = new Uint8Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = mulawEncodeSample(pcm[i]);
  return out;
}

// --- Bytes <-> samples -------------------------------------------------------

/** Reads little-endian 16-bit samples. Copies, so the input buffer's alignment does not matter. */
export function pcmFromBytes(bytes: Uint8Array): Pcm {
  const count = Math.floor(bytes.length / 2);
  const out = new Int16Array(count);
  for (let i = 0; i < count; i++) {
    const lo = bytes[i * 2];
    const hi = bytes[i * 2 + 1];
    const v = (hi << 8) | lo;
    out[i] = v & 0x8000 ? v - 0x10000 : v;
  }
  return out;
}

export function pcmToBytes(pcm: Pcm): Buffer {
  const buf = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) buf.writeInt16LE(pcm[i], i * 2);
  return buf;
}

export function concatPcm(parts: Pcm[]): Pcm {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Int16Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// --- Sample rate -------------------------------------------------------------

/**
 * Changes the sample rate. Going down averages the input samples that fall into
 * each output sample, which is a cheap low-pass filter that avoids the harsh
 * aliasing of simply dropping samples. Going up interpolates between samples.
 */
export function resample(pcm: Pcm, from: number, to: number): Pcm {
  if (from === to || pcm.length === 0) return pcm;
  const outLength = Math.max(1, Math.round((pcm.length * to) / from));
  const out = new Int16Array(outLength);
  const ratio = from / to;
  if (ratio > 1) {
    for (let i = 0; i < outLength; i++) {
      const start = i * ratio;
      const end = Math.min(pcm.length, (i + 1) * ratio);
      let sum = 0;
      let weight = 0;
      for (let j = Math.floor(start); j < Math.ceil(end); j++) {
        const w = Math.min(j + 1, end) - Math.max(j, start);
        if (w <= 0) continue;
        sum += pcm[j] * w;
        weight += w;
      }
      out[i] = weight > 0 ? Math.round(sum / weight) : 0;
    }
  } else {
    for (let i = 0; i < outLength; i++) {
      const pos = i * ratio;
      const j = Math.floor(pos);
      const frac = pos - j;
      const a = pcm[Math.min(j, pcm.length - 1)];
      const b = pcm[Math.min(j + 1, pcm.length - 1)];
      out[i] = Math.round(a + (b - a) * frac);
    }
  }
  return out;
}

// --- Measuring ---------------------------------------------------------------

export function rms(pcm: Pcm): number {
  if (pcm.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
  return Math.sqrt(sum / pcm.length);
}

export function durationMs(samples: number, rate: number): number {
  return (samples * 1000) / rate;
}

/** Splits audio into pieces of about `ms` milliseconds, for sending to Vobiz in small chunks. */
export function chunkPcm(pcm: Pcm, rate: number, ms: number): Pcm[] {
  const size = Math.max(1, Math.round((rate * ms) / 1000));
  const out: Pcm[] = [];
  for (let at = 0; at < pcm.length; at += size) out.push(pcm.subarray(at, at + size));
  return out;
}

// --- WAV ---------------------------------------------------------------------

/** Wraps PCM in a WAV container, which is what Sarvam's speech-to-text takes. */
export function wavWrap(pcm: Pcm, rate: number): Buffer {
  const data = pcmToBytes(pcm);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // plain PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/**
 * Takes the samples out of audio that may or may not be wrapped in a WAV
 * container. Vobiz needs bare samples: a 44-byte WAV header sent as audio is
 * heard as a burst of noise at the start of every sentence.
 */
export function unwrapWav(bytes: Uint8Array): { pcm: Pcm; rate?: number } {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (b.length < 12 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') {
    return { pcm: pcmFromBytes(bytes) };
  }
  let rate: number | undefined;
  let at = 12;
  while (at + 8 <= b.length) {
    const id = b.toString('ascii', at, at + 4);
    let size = b.readUInt32LE(at + 4);
    const body = at + 8;
    if (id === 'fmt ' && body + 8 <= b.length) rate = b.readUInt32LE(body + 4);
    if (id === 'data') {
      // Streaming encoders sometimes write 0 or 0xFFFFFFFF as the size: take the rest of the file.
      if (size === 0 || body + size > b.length) size = b.length - body;
      return { pcm: pcmFromBytes(b.subarray(body, body + size)), rate };
    }
    at = body + size + (size % 2);
  }
  return { pcm: new Int16Array(0), rate };
}
