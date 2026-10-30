import { describe, expect, it } from 'vitest';
import { flagDuplicateLeads, looksLikePdf, normalizeCvExtraction } from './cvLead';

const ctx = {
  subjects: ['Physics', 'Mathematics', 'Biology'],
  segments: ['Secondary (Grades 9-10)', 'Primary (Grades 1-5)']
};

const good = {
  is_cv: true,
  full_name: 'Priya Nair',
  phone: '098765 43210',
  email: 'Priya.Nair@Gmail.com',
  best_subject: 'physics',
  grade_segment: 'Secondary (Grades 9-10)',
  qualifications: 'M.Sc Physics, B.Ed, CTET',
  total_experience_years: 4.5,
  latest_school_or_employer: 'Delhi Public School',
  has_b_ed: true
};

describe('normalizeCvExtraction', () => {
  it('turns a clean CV into a ready lead with no warnings', () => {
    const lead = normalizeCvExtraction(good, 'priya.pdf', ctx);
    expect(lead).toMatchObject({
      name: 'Priya Nair',
      phone: '+91 98765 43210',
      email: 'priya.nair@gmail.com',
      subject: 'Physics',
      segment: 'Secondary (Grades 9-10)',
      qualification: 'M.Sc Physics, B.Ed, CTET',
      experience: '4.5 Years',
      prior_org: 'Delhi Public School',
      source: 'priya.pdf'
    });
    expect(lead.warnings).toEqual([]);
  });

  it('leaves missing details empty and says so, rather than inventing them', () => {
    const lead = normalizeCvExtraction({ is_cv: true, full_name: 'Asha Rao' }, 'asha.pdf', ctx);
    expect(lead.phone).toBe('');
    expect(lead.email).toBe('');
    expect(lead.experience).toBe('');
    expect(lead.warnings.join(' ')).toMatch(/no phone number/i);
    expect(lead.warnings.join(' ')).toMatch(/which subject/i);
  });

  it('rejects a phone that is not a real Indian mobile (landline, pincode)', () => {
    const lead = normalizeCvExtraction({ ...good, phone: '040 2334 5566' }, 'x.pdf', ctx);
    expect(lead.phone).toBe('');
    expect(lead.warnings.join(' ')).toMatch(/not a valid mobile/i);
  });

  it('keeps an international number as given', () => {
    const lead = normalizeCvExtraction({ ...good, phone: '+971 50 123 4567' }, 'x.pdf', ctx);
    expect(lead.phone).toBe('+971501234567');
  });

  it('does not accept a heading as the name', () => {
    const lead = normalizeCvExtraction({ ...good, full_name: 'Curriculum Vitae' }, 'x.pdf', ctx);
    expect(lead.name).toBe('');
    expect(lead.warnings.join(' ')).toMatch(/name/i);
  });

  it('flags a file that is not a CV', () => {
    const lead = normalizeCvExtraction({ ...good, is_cv: false }, 'invoice.pdf', ctx);
    expect(lead.warnings.join(' ')).toMatch(/does not look like a CV/i);
  });

  it('warns about a subject the school does not teach, and a missing B.Ed', () => {
    const lead = normalizeCvExtraction({ ...good, best_subject: 'Sanskrit', has_b_ed: false }, 'x.pdf', ctx);
    expect(lead.subject).toBe('Sanskrit');
    expect(lead.warnings.join(' ')).toMatch(/not one of your school's subjects/i);
    expect(lead.warnings.join(' ')).toMatch(/B\.Ed/);
  });

  it('describes a fresher and ignores nonsense experience', () => {
    expect(normalizeCvExtraction({ ...good, total_experience_years: 0 }, 'x', ctx).experience).toBe('Fresher');
    expect(normalizeCvExtraction({ ...good, total_experience_years: '3' }, 'x', ctx).experience).toBe('3 Years');
    expect(normalizeCvExtraction({ ...good, total_experience_years: -2 }, 'x', ctx).experience).toBe('');
    expect(normalizeCvExtraction({ ...good, total_experience_years: null }, 'x', ctx).experience).toBe('');
  });
});

describe('flagDuplicateLeads', () => {
  it('marks a later row that repeats an earlier phone or email', () => {
    const rows = [
      { phone: '+91 98765 43210', email: 'a@x.com', warnings: [] as string[] },
      { phone: '+91 98765 43210', email: '', warnings: [] as string[] },
      { phone: '', email: 'a@x.com', warnings: [] as string[] },
      { phone: '+91 91234 56780', email: 'b@x.com', warnings: [] as string[] }
    ];
    const out = flagDuplicateLeads(rows);
    expect(out[0].warnings).toEqual([]);
    expect(out[1].warnings[0]).toMatch(/row 1/);
    expect(out[2].warnings[0]).toMatch(/row 1/);
    expect(out[3].warnings).toEqual([]);
  });
});

describe('looksLikePdf', () => {
  it('checks the file header, not the extension', () => {
    expect(looksLikePdf(Buffer.from('%PDF-1.7 ...'))).toBe(true);
    expect(looksLikePdf(Buffer.from('PK\u0003\u0004 a zip'))).toBe(false);
    expect(looksLikePdf(Buffer.from(''))).toBe(false);
  });
});
