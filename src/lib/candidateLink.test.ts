import { describe, expect, it } from 'vitest';
import { applicationMessage, cleanIdentifier, entryKind, extractInviteCode, signInPathFromPastedText } from './candidateLink';

describe('extractInviteCode', () => {
  it('finds the code in whatever text was copied with it', () => {
    expect(extractInviteCode('Your login code: EDC-PHYS-A4K2 📋')).toBe('EDC-PHYS-A4K2');
    expect(extractInviteCode('  edc-biol-1a2b ')).toBe('EDC-BIOL-1A2B');
  });

  it('leaves text with no code as it was typed', () => {
    expect(extractInviteCode('  hello ')).toBe('hello');
    expect(extractInviteCode('')).toBe('');
  });
});

describe('signInPathFromPastedText', () => {
  it('turns a pasted sign-in link into a path on this site', () => {
    expect(signInPathFromPastedText('https://edcruiter.com/api/candidates/magic-login?token=abc.DEF-123_x'))
      .toBe('/api/candidates/magic-login?token=abc.DEF-123_x');
  });

  it('never follows another website, only reuses the token', () => {
    expect(signInPathFromPastedText('https://evil.example/api/candidates/magic-login?token=abc123'))
      .toBe('/api/candidates/magic-login?token=abc123');
  });

  it('finds the link inside a pasted message and ignores text that is not a link', () => {
    expect(signInPathFromPastedText('Tap: http://x.com/api/candidates/magic-login?token=t1 thanks')).toBe('/api/candidates/magic-login?token=t1');
    expect(signInPathFromPastedText('EDC-PHYS-A4K2')).toBeNull();
    expect(signInPathFromPastedText('https://edcruiter.com/jobs')).toBeNull();
  });
});

describe('cleanIdentifier', () => {
  it('makes phone numbers and emails comparable', () => {
    expect(cleanIdentifier('+91 98765 43210')).toBe('+919876543210');
    expect(cleanIdentifier(' (98765) 43210 ')).toBe('9876543210');
    expect(cleanIdentifier(' Priya@Gmail.com ')).toBe('priya@gmail.com');
    expect(cleanIdentifier('cand_123_abc')).toBe('cand_123_abc');
  });
});

describe('entryKind', () => {
  it('tells apart a link, a mobile, an email and an application ID', () => {
    expect(entryKind('')).toBe('empty');
    expect(entryKind('https://x.com/api/candidates/magic-login?token=t1')).toBe('link');
    expect(entryKind('98765 43210')).toBe('phone');
    expect(entryKind('+91 98765-43210')).toBe('phone');
    expect(entryKind('Name@Gmail.com')).toBe('email');
    expect(entryKind('edc-phys-a4k2')).toBe('application_id');
    expect(entryKind('Your application ID is EDC-PHYS-A4K2.')).toBe('application_id');
    expect(entryKind('cand_123')).toBe('unknown');
  });
});

describe('applicationMessage', () => {
  it('labels the link and the application ID so the candidate knows which is which', () => {
    const m = applicationMessage({ firstName: 'Mansi', schoolName: 'Sloka', post: 'English teacher', link: 'https://e.com/api/candidates/magic-login?token=t', loginUrl: 'https://e.com/candidate/login', applicationId: 'EDC-ENG-A4K2', validDays: 7 });
    expect(m).toContain('Hello Mansi');
    expect(m).toContain('1. Tap this link');
    expect(m).toContain('https://e.com/api/candidates/magic-login?token=t');
    expect(m).toContain('open https://e.com/candidate/login and type');
    expect(m).toContain('Application ID: EDC-ENG-A4K2');
    expect(m).not.toContain('Code:');
  });
});
