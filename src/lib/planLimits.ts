/**
 * What each plan includes. Kept in one place so the team page, the API and the
 * pricing page cannot disagree. The numbers are the platform owner's to change.
 */

import { MAX_TEAM_SIZE } from './team';

/** People who can sign in to a school's workspace, by plan. */
export const TEAM_LIMIT_BY_PLAN: Record<string, number> = {
  none: 2,
  trial: 3,
  starter: 5,
  growth: 15,
  complimentary: MAX_TEAM_SIZE,
};

export const PLAN_NAME: Record<string, string> = {
  none: 'current',
  trial: 'trial',
  starter: 'Starter',
  growth: 'Growth',
  complimentary: 'Complimentary',
};

/** The most role names a school can define, whatever its plan. A guard against runaway lists, not a plan feature. */
export const MAX_ROLE_NAMES = 12;

type PlanHolder = { billing?: { plan?: string } } | null | undefined;

/** How many team members this school may have. A school with no plan record predates plans and gets the full allowance. */
export function teamLimit(school: PlanHolder): number {
  const plan = school?.billing?.plan;
  if (!plan) return MAX_TEAM_SIZE;
  return Math.min(TEAM_LIMIT_BY_PLAN[plan] ?? TEAM_LIMIT_BY_PLAN.starter, MAX_TEAM_SIZE);
}

export function planName(school: PlanHolder): string {
  const plan = school?.billing?.plan;
  return plan ? PLAN_NAME[plan] ?? plan : PLAN_NAME.complimentary;
}

/** The message shown when a school reaches its team limit. */
export function teamLimitMessage(school: PlanHolder): string {
  return `Your ${planName(school)} plan includes up to ${teamLimit(school)} team members. Write to edcruiterofficial@gmail.com to move to a bigger plan.`;
}
