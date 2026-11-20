import { describe, expect, it } from 'vitest';
import { OTHER_QUALIFICATION, QUALIFICATION_GROUPS, QUALIFICATION_OPTIONS, isListedQualification } from './qualifications';
import { BACHELOR_DEGREES, MASTER_DEGREES } from './teacherProfile';
import { postingText } from './jobPosting';

describe('the qualification choices', () => {
  it('include engineering, computer and design degrees, not only B.Sc and B.A', () => {
    const all = QUALIFICATION_OPTIONS.join(' | ');
    for (const want of ['B.Tech', 'M.Tech', 'BCA', 'MCA', 'B.Arch', 'B.Des', 'M.Ed', 'Ph.D', 'B.Ed']) expect(all).toContain(want);
  });
  it('keep the wording older applications were saved with', () => {
    for (const old of ['Graduation (B.Sc / B.A / B.Com)', 'Masters / Post Graduation (M.Sc / M.A / M.Ed)', 'B.Ed (Bachelor of Education)', 'D.El.Ed / NTT / Montessori Diploma', 'Ph.D / Doctorate']) {
      expect(isListedQualification(old)).toBe(true);
    }
  });
  it('have no repeated choice, and "Others" is not one of them', () => {
    expect(new Set(QUALIFICATION_OPTIONS).size).toBe(QUALIFICATION_OPTIONS.length);
    expect(QUALIFICATION_OPTIONS).not.toContain(OTHER_QUALIFICATION);
    expect(QUALIFICATION_GROUPS.every((g) => g.options.length > 0)).toBe(true);
  });
  it('treat anything else as typed text', () => {
    expect(isListedQualification('B.Tech Computer Science with B.Ed')).toBe(false);
    expect(isListedQualification(undefined)).toBe(false);
  });
});

describe('the Add candidate degree lists', () => {
  it('cover engineering and computer degrees at both levels', () => {
    expect(BACHELOR_DEGREES).toContain('B.Tech / BE');
    expect(BACHELOR_DEGREES).toContain('BCA');
    expect(MASTER_DEGREES).toContain('M.Tech');
    expect(MASTER_DEGREES).toContain('MCA');
  });
});

describe('what a vacancy asks for', () => {
  it('names the computing degrees for a computer science post', () => {
    const r = postingText('Computer Science', 'Main', 'Secondary (Grades 9-10)', 'CBSE', '3 years').requirements;
    expect(r[0]).toMatch(/B\.Tech/);
    expect(r[0]).toMatch(/MCA/);
  });
  it('names the usual degrees, including engineering, for other subjects', () => {
    const r = postingText('Physics', 'Main', 'Secondary (Grades 9-10)', 'CBSE', '3 years').requirements;
    expect(r[0]).toMatch(/B\.Sc/);
    expect(r[0]).toMatch(/B\.Tech/);
  });
});
