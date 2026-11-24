import { describe, expect, it } from 'vitest';
import { isPlaceholderSubmission, parsePolicyText, sentences, toPoints } from './reportPoints';

describe('sentences', () => {
  it('keeps abbreviations and decimals whole', () => {
    expect(sentences("Nataraj's demo on IP Address vs. MAC Address. Uses dot-decimal (e.g., 192.168.1.1) formats. Good."))
      .toEqual(["Nataraj's demo on IP Address vs. MAC Address.", 'Uses dot-decimal (e.g., 192.168.1.1) formats.', 'Good.']);
    expect(sentences('')).toEqual([]);
  });
});

describe('toPoints', () => {
  it('marks good signs and concerns, and drops the "However," opener', () => {
    const p = toPoints('The candidate exhibits strong vocal projection. However, teaching delivery lacks any visual board work. Video on file.');
    expect(p).toEqual([
      { text: 'The candidate exhibits strong vocal projection.', tone: 'good' },
      { text: 'Teaching delivery lacks any visual board work.', tone: 'watch' },
      { text: 'Video on file.', tone: 'none' },
    ]);
  });
});

describe('parsePolicyText', () => {
  it('reads the older acknowledgement lines', () => {
    const r = parsePolicyText('HR Policy Confirmation:\n- 60-Day Notice Period Acknowledged: YES\n- Child Safeguarding Code of Conduct Signed: NO\n- Additional Statement: None');
    expect(r).toEqual({
      answers: [
        { question_id: 'line-0', question: '60-Day Notice Period', agreed: true },
        { question_id: 'line-1', question: 'Child Safeguarding Code of Conduct', agreed: false },
      ],
      note: undefined,
    });
    expect(parsePolicyText('Some free answer')).toBeNull();
  });

  it('keeps times in the policy name and reads a note with colons', () => {
    const r = parsePolicyText('HR Policy Confirmation:\n- School Timings (7:45 AM - 3:45 PM) Acknowledged: YES\n- Additional Statement: Need leave on 3 May: family');
    expect(r?.answers).toEqual([{ question_id: 'line-0', question: 'School Timings (7:45 AM - 3:45 PM)', agreed: true }]);
    expect(r?.note).toBe('Need leave on 3 May: family');
  });
});

describe('isPlaceholderSubmission', () => {
  it('spots one-line "it was recorded" notes only', () => {
    expect(isPlaceholderSubmission('5-minute teaching demo recorded and submitted.')).toBe(true);
    expect(isPlaceholderSubmission('Classroom scenario video submitted.')).toBe(true);
    expect(isPlaceholderSubmission('I would first calm the class and then\ntalk to the child.')).toBe(false);
  });
});
