import { describe, expect, it } from 'vitest';
import {
  fromDisplay, labelOf, parseScript, RULE_PRESETS, rulesText, schoolFactsText, scriptOf, speakSeconds, STYLE_PRESETS, strayBlanks, toDisplay, toVariableKey,
} from './callScript';

const script = scriptOf({ variables: [{ key: 'salary_range', label: 'Salary range', value: 'Rs 30,000' }, { key: 'notice', label: 'Notice policy', value: '30 days', share: false }] });

describe('call script, as a school reads and writes it', () => {
  it('shows blanks by their names and stores them in the plain form', () => {
    const shown = toDisplay('Hi {{candidate_name}}, pay is {{salary_range}}.', script);
    expect(shown).toBe("Hi [Candidate's first name], pay is [Salary range].");
    expect(fromDisplay(shown, script)).toBe('Hi {{candidate_name}}, pay is {{salary_range}}.');
  });

  it('accepts a blank typed in any case, with spare spaces or a curly apostrophe', () => {
    expect(fromDisplay('Hello [ candidate’s FIRST name ] and [salary RANGE]', script)).toBe('Hello {{candidate_name}} and {{salary_range}}');
  });

  it('leaves a name that is not a blank as typed, and flags it', () => {
    const stored = fromDisplay('Pay is [Salry range].', script);
    expect(stored).toBe('Pay is [Salry range].');
    expect(strayBlanks(stored)).toEqual(['[Salry range]']);
  });

  it('refuses a text with a stray blank, in plain words and without braces', () => {
    const r = parseScript({ greeting: 'Pay is [Salry range].', variables: [{ key: 'salary_range', label: 'Salary range', value: 'x' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.error).toContain('[Salry range]'); expect(r.error).not.toMatch(/[{}]/); }
  });

  it('names a blank the school forgot to define, without showing braces', () => {
    const r = parseScript({ closing: 'Bye {{campus_name}}' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('[Campus name]');
  });

  it('refuses a detail named like a built-in blank, or named twice', () => {
    expect(parseScript({ variables: [{ key: 'x1', label: 'School name', value: 'a' }] }).ok).toBe(false);
    expect(parseScript({ variables: [{ label: 'Bus', value: 'a' }, { label: 'bus', value: 'b' }] }).ok).toBe(false);
  });

  it('makes the key from the name when the school only typed a name', () => {
    expect(toVariableKey('Campus address')).toBe('campus_address');
    const r = parseScript({ variables: [{ label: 'Campus address', value: 'Tukkuguda' }] });
    expect(r).toMatchObject({ ok: true, script: { variables: [{ key: 'campus_address', label: 'Campus address', value: 'Tukkuguda' }] } });
    expect(labelOf({ key: 'hr_phone' })).toBe('Hr phone');
  });

  it('tells candidates only the details marked as shareable, then the free text', () => {
    const s = scriptOf({ ...script, school_info: 'Free lunch.' });
    expect(schoolFactsText(s, {})).toBe('Salary range: Rs 30,000\nFree lunch.');
  });

  it('turns ticked rules into sentences for the AI, ahead of the school\'s own words', () => {
    const s = scriptOf({ rule_flags: ['no_salary', 'made_up'], instructions: 'Be kind.' });
    expect(s.rule_flags).toEqual(['no_salary']);
    expect(rulesText(s, {})).toBe(`${RULE_PRESETS[0].text}\nBe kind.`);
  });

  it('gives every style an opening and closing that use only known blanks', () => {
    for (const p of STYLE_PRESETS) {
      expect(parseScript({ tone: p.tone, greeting: p.greeting, closing: p.closing }).ok).toBe(true);
    }
  });

  it('estimates how long a text takes to say', () => {
    expect(speakSeconds('one two three four five six')).toBe(3);
    expect(speakSeconds('')).toBe(1);
  });
});
