/**
 * Decides when a person on the phone has started and stopped speaking.
 *
 * It listens to the energy of small audio frames (about 20 ms each). It is not
 * a speech recogniser, so it cannot tell speech from a loud noise; the settings
 * below are the knobs for noisy lines. Three things keep it from cutting people
 * off or reacting to clicks:
 *  - a short run of loud frames is needed before speech "starts";
 *  - the half second before that run is kept (pre-roll), so the first syllable
 *    is not lost;
 *  - the threshold follows the line's background noise, so a hissy line does
 *    not read as constant speech.
 */

import { durationMs, concatPcm, rms, type Pcm } from './audio';

export interface VadOptions {
  rate: number;
  /** Frames quieter than this are never speech. RMS of 16-bit samples, so 0 to 32767. */
  threshold?: number;
  /** Speech must be this many times louder than the measured background noise. */
  noiseFactor?: number;
  /** How long a run of loud frames must last before it counts as speech starting. */
  startMs?: number;
  /** How much quiet ends an utterance. */
  endSilenceMs?: number;
  /** Speech shorter than this is treated as noise and dropped. */
  minSpeechMs?: number;
  /** Audio kept from before speech was recognised. */
  preRollMs?: number;
  /** An utterance is cut at this length, so one long monologue cannot grow without limit. */
  maxUtteranceMs?: number;
}

export type VadEvent =
  | { type: 'speech_start' }
  | { type: 'speech_end'; pcm: Pcm; speechMs: number }
  | { type: 'noise' };

export class TurnDetector {
  private readonly o: Required<VadOptions>;
  private noiseFloor: number;
  private state: 'idle' | 'speaking' = 'idle';
  private preRoll: Pcm[] = [];
  private preRollMs = 0;
  private candidate: Pcm[] = [];
  private candidateMs = 0;
  private utterance: Pcm[] = [];
  private speechMs = 0;
  private silenceMs = 0;
  private utteranceMs = 0;
  /** Set by the session while the AI is talking, so echo and small sounds do not interrupt it. */
  startMsOverride: number | null = null;

  constructor(options: VadOptions) {
    this.o = {
      threshold: 350,
      noiseFactor: 3,
      startMs: 100,
      endSilenceMs: 700,
      minSpeechMs: 250,
      preRollMs: 400,
      maxUtteranceMs: 20_000,
      ...options,
    };
    this.noiseFloor = this.o.threshold / this.o.noiseFactor;
  }

  /** Current estimate of the line's background noise (RMS). Useful in logs. */
  get noise(): number { return this.noiseFloor; }
  get speaking(): boolean { return this.state === 'speaking'; }

  reset(): void {
    this.state = 'idle';
    this.preRoll = []; this.preRollMs = 0;
    this.candidate = []; this.candidateMs = 0;
    this.utterance = []; this.speechMs = 0; this.silenceMs = 0; this.utteranceMs = 0;
  }

  push(frame: Pcm): VadEvent[] {
    const events: VadEvent[] = [];
    if (frame.length === 0) return events;
    const ms = durationMs(frame.length, this.o.rate);
    const level = rms(frame);
    const loud = level >= Math.max(this.o.threshold, this.noiseFloor * this.o.noiseFactor);

    if (this.state === 'idle') {
      if (loud) {
        this.candidate.push(frame);
        this.candidateMs += ms;
        if (this.candidateMs >= (this.startMsOverride ?? this.o.startMs)) {
          this.state = 'speaking';
          this.utterance = [...this.preRoll, ...this.candidate];
          this.utteranceMs = this.preRollMs + this.candidateMs;
          this.speechMs = this.candidateMs;
          this.silenceMs = 0;
          this.preRoll = []; this.preRollMs = 0;
          this.candidate = []; this.candidateMs = 0;
          events.push({ type: 'speech_start' });
        }
      } else {
        // Quiet frame: a loud run that was too short was a click. Learn the noise level from quiet frames only.
        this.candidate = []; this.candidateMs = 0;
        this.noiseFloor = this.noiseFloor * 0.98 + level * 0.02;
        this.preRoll.push(frame);
        this.preRollMs += ms;
        while (this.preRollMs - durationMs(this.preRoll[0].length, this.o.rate) >= this.o.preRollMs) {
          this.preRollMs -= durationMs(this.preRoll[0].length, this.o.rate);
          this.preRoll.shift();
        }
      }
      return events;
    }

    // speaking
    this.utterance.push(frame);
    this.utteranceMs += ms;
    if (loud) { this.speechMs += ms; this.silenceMs = 0; } else { this.silenceMs += ms; }

    const tooLong = this.utteranceMs >= this.o.maxUtteranceMs;
    if (this.silenceMs >= this.o.endSilenceMs || tooLong) {
      const speechMs = this.speechMs;
      const pcm = concatPcm(this.utterance);
      this.reset();
      events.push(speechMs >= this.o.minSpeechMs ? { type: 'speech_end', pcm, speechMs } : { type: 'noise' });
    }
    return events;
  }
}
