/**
 * The candidate's side of our own interview pipeline, in the browser.
 *
 * It listens to the microphone, decides when the candidate has finished an
 * answer (a pause of about a second and a half), sends only that answer to our
 * server, and plays the interviewer's reply sentence by sentence as it arrives.
 * Silence is never sent anywhere, so it costs nothing.
 *
 * If the candidate starts talking while the interviewer is speaking, the
 * interviewer stops. If they carry on talking while the reply is being worked
 * out, that reply is dropped and the whole answer is sent again.
 */

import { TurnDetector } from './vad';
import { concatPcm, type Pcm } from './audio';

export type ClientState = 'connecting' | 'agent_speaking' | 'listening' | 'thinking' | 'ended';

export interface ClientCallbacks {
  onState: (s: ClientState) => void;
  onLine: (line: { role: 'agent' | 'user'; text: string }) => void;
  onAgentLevel: (level: number) => void;
  onMicLevel: (level: number) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}

const RATE = 16_000;
const FRAME = 320; // 20 ms at 16 kHz
/** No answer for this long after the interviewer finishes: she checks in. */
const SILENCE_MS = 40_000;
/** This many check-ins with no answer in a row ends the interview. */
const MAX_SILENCES = 3;

const WORKLET = `
class Tap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('edcruiter-tap', Tap);
`;

export class OwnInterviewClient {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  private vad = new TurnDetector({ rate: RATE, endSilenceMs: 1500, startMs: 150, minSpeechMs: 300, maxUtteranceMs: 120_000, preRollMs: 400 });
  private carry: number[] = [];
  private pos = 0;
  private state: ClientState = 'connecting';
  private muted = false;
  private queue: AudioBuffer[] = [];
  private playing: AudioBufferSourceNode | null = null;
  private replyDone = true;
  private endAfterPlayback = false;
  private request: AbortController | null = null;
  private pending: Pcm | null = null;
  /** The candidate interrupted: the rest of this reply is shown but not played. */
  private hushed = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private silences = 0;
  private raf = 0;
  private stopped = false;

  constructor(private readonly ids: { candidateId: string; interviewId: string }, private readonly cb: ClientCallbacks) {}

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    this.ctx = new AudioContext();
    await this.ctx.resume();
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'edcruiter-tap');
    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => this.onAudio(e.data);
    src.connect(this.node);
    // The worklet must reach the output to run; a silent gain keeps the microphone from being heard.
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.node.connect(mute).connect(this.ctx.destination);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.connect(this.ctx.destination);
    this.meter();
    await this.send(null, false);
  }

  setMuted(m: boolean) { this.muted = m; if (m) this.vad.reset(); }

  async stop(): Promise<void> {
    this.stopped = true;
    this.request?.abort();
    this.clearSilence();
    cancelAnimationFrame(this.raf);
    this.stopPlayback();
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close().catch(() => undefined);
    this.setState('ended');
  }

  private setState(s: ClientState) {
    if (this.state === s) return;
    this.state = s;
    this.cb.onState(s);
    if (s === 'listening') this.armSilence(); else this.clearSilence();
    // While the interviewer talks, it takes a longer, louder sound to interrupt her, so her own voice and small noises do not.
    this.vad.startMsOverride = s === 'agent_speaking' ? 500 : null;
  }

  // --- Microphone ---------------------------------------------------------------

  /** Brings the microphone's sample rate down to 16 kHz, 20 ms at a time. */
  private onAudio(input: Float32Array) {
    if (!this.ctx || this.stopped) return;
    const ratio = this.ctx.sampleRate / RATE;
    const all = this.carry.length ? Float32Array.from([...this.carry, ...input]) : input;
    const out: number[] = [];
    let p = this.pos;
    while (p + 1 < all.length) {
      const i = Math.floor(p);
      const f = p - i;
      out.push(all[i] * (1 - f) + all[i + 1] * f);
      p += ratio;
    }
    const used = Math.floor(p);
    this.carry = Array.from(all.subarray(used));
    this.pos = p - used;

    let level = 0;
    const pcm = new Int16Array(out.length);
    for (let i = 0; i < out.length; i++) {
      const s = Math.max(-1, Math.min(1, out[i]));
      pcm[i] = s * 32767;
      level += s * s;
    }
    this.cb.onMicLevel(this.muted ? 0 : Math.min(1, Math.sqrt(level / Math.max(1, out.length)) * 5));
    if (this.muted || this.state === 'connecting' || this.state === 'ended') return;
    for (let i = 0; i < pcm.length; i += FRAME) {
      for (const ev of this.vad.push(pcm.subarray(i, i + FRAME))) {
        if (ev.type === 'speech_start') this.onSpeechStart();
        if (ev.type === 'speech_end') void this.onSpeechEnd(ev.pcm);
      }
    }
  }

  private onSpeechStart() {
    this.clearSilence();
    if (this.state === 'agent_speaking') {
      // Interrupted: stop talking and listen.
      this.stopPlayback();
      this.hushed = true;
      this.endAfterPlayback = false;
      this.setState('listening');
    } else if (this.state === 'thinking' && this.request) {
      // They were not finished. Drop the reply being made; the whole answer goes again.
      this.request.abort();
      this.request = null;
      this.setState('listening');
    }
  }

  private async onSpeechEnd(pcm: Pcm) {
    const answer = this.pending ? concatPcm([this.pending, pcm]) : pcm;
    this.silences = 0;
    await this.send(answer, false);
  }

  // --- Talking to the server ----------------------------------------------------

  private async send(answer: Pcm | null, silence: boolean) {
    if (this.stopped) return;
    this.pending = answer;
    this.hushed = false;
    this.setState('thinking');
    const ctrl = new AbortController();
    this.request = ctrl;
    this.replyDone = false;
    const q = new URLSearchParams({ candidate_id: this.ids.candidateId, interview_id: this.ids.interviewId, ...(silence ? { silence: '1' } : {}) });
    try {
      const res = await fetch(`/api/voice-interview/turn?${q}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: answer ? new Uint8Array(answer.buffer, answer.byteOffset, answer.byteLength).slice() : new Uint8Array(0),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(data.error || 'Asha could not answer just now.');
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) await this.onEvent(JSON.parse(line));
        }
      }
      if (this.request !== ctrl) return;
      this.pending = null;
      this.request = null;
      this.replyDone = true;
      this.afterPlayback();
    } catch (e) {
      if (ctrl.signal.aborted || this.stopped) return;
      this.request = null;
      this.replyDone = true;
      this.pending = null;
      this.cb.onError(e instanceof Error ? e.message : 'Asha could not answer just now.');
      this.setState('listening');
    }
  }

  private async onEvent(e: { type: string; text?: string; audio?: string; message?: string }) {
    if (e.type === 'heard' && e.text) this.cb.onLine({ role: 'user', text: e.text });
    if (e.type === 'say' && e.text) {
      this.cb.onLine({ role: 'agent', text: e.text });
      if (e.audio && this.ctx && !this.hushed) {
        const bytes = Uint8Array.from(atob(e.audio), (c) => c.charCodeAt(0));
        const buffer = await this.ctx.decodeAudioData(bytes.buffer);
        this.queue.push(buffer);
        if (!this.playing) this.playNext();
      }
    }
    if (e.type === 'end' && !this.hushed) this.endAfterPlayback = true;
    if (e.type === 'error' && e.message) this.cb.onError(e.message);
  }

  // --- Speaker -----------------------------------------------------------------

  private playNext() {
    if (!this.ctx || !this.analyser) return;
    const next = this.queue.shift();
    if (!next) { this.playing = null; this.afterPlayback(); return; }
    const node = this.ctx.createBufferSource();
    node.buffer = next;
    node.connect(this.analyser);
    node.onended = () => { if (this.playing === node) this.playNext(); };
    this.playing = node;
    this.setState('agent_speaking');
    node.start();
  }

  private stopPlayback() {
    this.queue = [];
    const p = this.playing;
    this.playing = null;
    try { p?.stop(); } catch { /* already stopped */ }
  }

  /** When the reply has fully arrived and been spoken: listen, or end. */
  private afterPlayback() {
    if (this.playing || !this.replyDone || this.stopped) return;
    if (this.endAfterPlayback) { this.setState('ended'); this.cb.onEnd(); return; }
    if (this.state !== 'thinking' || !this.request) this.setState('listening');
  }

  private armSilence() {
    this.clearSilence();
    this.silenceTimer = setTimeout(() => {
      if (this.state !== 'listening' || this.vad.speaking) return;
      this.silences += 1;
      if (this.silences >= MAX_SILENCES) { this.cb.onEnd(); return; }
      void this.send(null, true);
    }, SILENCE_MS);
  }

  private clearSilence() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }

  private meter() {
    const a = this.analyser;
    if (!a) return;
    const data = new Uint8Array(a.fftSize);
    const tick = () => {
      a.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) { const x = (v - 128) / 128; sum += x * x; }
      this.cb.onAgentLevel(Math.min(1, Math.sqrt(sum / data.length) * 6));
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }
}
