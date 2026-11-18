/**
 * Limits that apply to every school. Team size is set per school by seat type
 * (see seats.ts), not by plan.
 */

/**
 * The most role NAMES a school can define ("Maths Coordinator", "Vice
 * Principal"…). Not a number of people: each name sits on one of the five
 * seat types, and the seats decide how many people there can be.
 */
export const MAX_ROLE_NAMES = 25;
