import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM } from '@/lib/permissions';
import { PEDAGOGY_BANK, SUBJECT_BANKS } from '@/lib/testBank';
import { questionsFor, summarize } from '@/lib/bankCatalog';

const BANKS = { ...SUBJECT_BANKS, pedagogy: PEDAGOGY_BANK };

/**
 * The platform question bank, read-only, for a school's admin and HR (and the
 * platform owner). Candidates each get their own random draw from it; this
 * lets the school see what that draw can contain, answers included.
 *
 *   GET ?school_id=…                         subjects, grades and counts
 *   GET ?school_id=…&subject=english&grade=6 the questions for one grade
 *
 * Reviewers and candidates are refused: the answer key must not reach anyone
 * who takes or marks the test on trust.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    await requireSchoolAccess(url.searchParams.get('school_id'), { anyOf: HIRING_TEAM });
    const state = db.getBankState();

    const subject = url.searchParams.get('subject');
    if (!subject) {
      return NextResponse.json({ subjects: summarize(BANKS, state) });
    }

    const bank = (BANKS as Record<string, typeof PEDAGOGY_BANK>)[subject];
    if (!bank) return NextResponse.json({ error: 'No such subject in the bank.' }, { status: 404 });
    const grade = url.searchParams.get('grade') || '*';
    return NextResponse.json({ questions: questionsFor(bank, grade, state) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load the question bank.' }, { status: 500 });
  }
}
