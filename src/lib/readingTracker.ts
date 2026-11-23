/**
 * Live measurements behind the reading check, kept free of the camera code so
 * they can be tested.
 *
 * VoiceActivity: is the candidate speaking right now? It follows the room's
 * noise level, so a fan or traffic does not count as speech.
 *
 * ReadingTracker: over one answer, how much of the speaking time the eyes were
 * away from the screen (down at a lap or desk, or off to one side), and how
 * often speech started right after a glance away. Reading from a phone looks
 * like that: glance down, then a burst of fluent speech, again and again.
 */

/** The answer recorder announces its phase on window, so the camera knows when the question is up and when an answer is being given. */
export const ANSWER_PHASE_EVENT = 'edc:answer-phase';
export type AnswerPhase = 'prep' | 'record' | 'done';

let lastPhase: AnswerPhase | null = null;

export function announceAnswerPhase(phase: AnswerPhase): void {
  lastPhase = phase;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(ANSWER_PHASE_EVENT, { detail: { phase } }));
}

/** The last phase announced, for a listener that starts after the recorder did. */
export function currentAnswerPhase(): AnswerPhase | null {
  return lastPhase;
}

export class VoiceActivity {
  private floor = 0.01;
  private lastLoudAt = -Infinity;

  /** rms: loudness of the latest audio frame (0-1). t: milliseconds. */
  update(rms: number, t: number): boolean {
    // The floor falls quickly to quiet moments and rises slowly, so speech does not raise it.
    this.floor = rms < this.floor ? this.floor * 0.9 + rms * 0.1 : this.floor * 0.999 + rms * 0.001;
    if (rms > Math.max(0.015, this.floor * 3)) this.lastLoudAt = t;
    // Speech holds on for a moment between syllables.
    return t - this.lastLoudAt < 350;
  }
}

export interface ReadingSummary {
  speaking_seconds: number;
  eyes_away_speaking_pct: number;
  glance_then_speak: number;
}

export class ReadingTracker {
  private speakingMs = 0;
  private awaySpeakingMs = 0;
  private cycles = 0;
  private lastT: number | undefined;
  private lastAwayAt = -Infinity;
  private silentSince: number | undefined;
  private wasSpeaking = false;

  feed(t: number, eyesAway: boolean, speaking: boolean): void {
    if (this.lastT !== undefined) {
      // A long gap (tab hidden, slow frame) is not counted as time.
      const dt = Math.min(200, Math.max(0, t - this.lastT));
      if (speaking) {
        this.speakingMs += dt;
        if (eyesAway) this.awaySpeakingMs += dt;
      }
    }
    this.lastT = t;
    if (eyesAway) this.lastAwayAt = t;

    if (speaking && !this.wasSpeaking) {
      const pausedLongEnough = this.silentSince !== undefined && t - this.silentSince >= 400;
      if (pausedLongEnough && t - this.lastAwayAt <= 1000) this.cycles++;
    }
    if (!speaking && (this.wasSpeaking || this.silentSince === undefined)) this.silentSince = t;
    this.wasSpeaking = speaking;
  }

  summary(): ReadingSummary {
    return {
      speaking_seconds: Math.round(this.speakingMs / 1000),
      eyes_away_speaking_pct: this.speakingMs ? Math.round((100 * this.awaySpeakingMs) / this.speakingMs) : 0,
      glance_then_speak: this.cycles,
    };
  }

  /** A sentence for the reviewer. */
  describe(): string {
    const s = this.summary();
    const mins = Math.floor(s.speaking_seconds / 60);
    const secs = String(s.speaking_seconds % 60).padStart(2, '0');
    return `While speaking (${mins}:${secs}), the eyes were away from the screen ${s.eyes_away_speaking_pct}% of the time, and speech started right after a glance away ${s.glance_then_speak} time${s.glance_then_speak === 1 ? '' : 's'}.`;
  }
}
