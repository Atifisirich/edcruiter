/**
 * What a school insists on when it reads a CV. By default neither a B.Ed nor a
 * master's degree is required: a CV without them is not marked ineligible, and
 * the report just says plainly that they are not listed. The school admin can
 * make either one mandatory in Settings.
 */

import type { School } from './types';

export interface HiringRequirements {
  require_bed?: boolean;
  require_masters?: boolean;
}

export interface Requirements {
  requireBed: boolean;
  requireMasters: boolean;
}

export function requirementsOf(school: Pick<School, 'hiring_requirements'> | null | undefined): Requirements {
  return {
    requireBed: school?.hiring_requirements?.require_bed === true,
    requireMasters: school?.hiring_requirements?.require_masters === true,
  };
}

/** Cleans what the admin sent. Anything that is not a plain true or false is ignored. */
export function parseRequirements(input: unknown): HiringRequirements {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  return { require_bed: raw.require_bed === true, require_masters: raw.require_masters === true };
}

const MASTERS_RE =
  /\b(m\.?\s*sc|msc|m\.?\s*a\.?|ma|m\.?\s*com|m\.?\s*tech|m\.?\s*e\.?|m\.?\s*ed|med|mca|mba|m\.?\s*phil|m\.?\s*arch|m\.?\s*pharm|m\.?\s*p\.?\s*ed|llm|masters?|post\s*graduat\w*|ph\.?\s*d|doctorate)\b/i;

export function hasMastersCredential(text?: string | null, degreesFound?: string[]): boolean {
  return MASTERS_RE.test([text || '', ...(degreesFound || [])].join(' '));
}
