import { subjectKind } from './subjects';

/**
 * The posting's summary, duties and requirements. A cricket coach or a mother
 * teacher is not asked for an M.Sc, a B.Ed and lab safety the way a physics
 * teacher is.
 */
/** The degree a posting asks for. Computing roles name the engineering and computer degrees too, so those graduates know they qualify. */
function degreeLine(subject: string): string {
  if (/comput|\bict\b|\bit\b|\bai\b|coding|robot|informatics/i.test(subject)) {
    return `Bachelor's or Master's degree (B.Tech / B.E, BCA, B.Sc, M.Tech, MCA, M.Sc or equivalent) in ${subject}, computer science or a closely related field from a recognised university.`;
  }
  return `Bachelor's or Master's degree (B.A, B.Sc, B.Com, B.Tech / B.E, BCA, M.A, M.Sc, M.Tech, MCA or equivalent) in ${subject} or a closely related field from a recognised university.`;
}

export function postingText(subject: string, campus: string, segment: string, board: string, exp: string) {
  const at = campus ? ` for our ${campus}` : '';
  switch (subjectKind(subject)) {
    case 'sports':
      return {
        summary: `We are looking for a ${subject} coach${at} to train students in ${segment}. The right person builds skill, fitness and team spirit, and keeps every child safe.`,
        responsibilities: [
          `Plan and run regular ${subject} sessions for different ages and skill levels.`,
          `Teach correct technique, warm-ups and safe practice, and watch for injuries.`,
          `Prepare teams and students for inter-school events and competitions.`,
          `Look after equipment and the playing area, and keep attendance and progress records.`,
          `Share progress with parents and work with the PE department on the sports calendar.`
        ],
        requirements: [
          `B.P.Ed / M.P.Ed, or a recognised coaching certificate in ${subject}.`,
          `At least ${exp} coaching children or school teams.`,
          `First aid training, or willingness to complete it.`,
          `Good communication with children and parents.`
        ]
      };
    case 'arts':
      return {
        summary: `We are looking for a ${subject} teacher${at} to teach ${segment}. The right person makes the subject joyful, helps every child take part, and prepares students for school events.`,
        responsibilities: [
          `Plan and teach ${subject} lessons that build skill step by step.`,
          `Encourage every child, including those who are shy or new to it.`,
          `Prepare students for assemblies, annual day, exhibitions and competitions.`,
          `Look after materials and instruments, and keep progress records.`,
          `Share progress with parents and work with other teachers on school events.`
        ],
        requirements: [
          `A degree, diploma or recognised grade certificate in ${subject}.`,
          `At least ${exp} teaching ${subject} to children.`,
          `A portfolio, recordings or performances you can share is a plus.`,
          `Good communication with children and parents.`
        ]
      };
    case 'early_years':
      return {
        summary: `We are looking for a caring ${subject} teacher${at} for ${segment}. The right person helps young children feel safe, learn through play, and build early language, number and social skills.`,
        responsibilities: [
          `Plan play-based, hands-on activities for early learning.`,
          `Build early reading, writing, number and motor skills.`,
          `Look after children's safety, hygiene and well-being through the day.`,
          `Observe each child and keep simple progress records.`,
          `Talk with parents often and settle new children in gently.`
        ],
        requirements: [
          `NTT / ECCEd / D.El.Ed, or another early childhood qualification.`,
          `At least ${exp} teaching young children.`,
          `Warm, patient manner and clear spoken English.`,
          `Knowledge of child safety and first aid is a plus.`
        ]
      };
    default:
      return {
        summary: `We are seeking an outstanding ${subject} Educator${at} to teach ${segment} aligned with ${board} standards. The ideal faculty possesses deep conceptual mastery, inquiry-based pedagogical techniques, and strong visual scaffolding skills.`,
        responsibilities: [
          `Deliver high-impact daily classroom lessons adhering to ${board} curriculum frameworks.`,
          `Diagnose student conceptual misconceptions and implement 3-tier differentiated learning plans.`,
          `Conduct 5-minute diagnostic checks, formative exit tickets, and continuous board exam remediation.`,
          `Integrate smartboard/digital learning tools, and follow lab safety protocols where the subject has a lab.`,
          `Participate in weekly Department Head (RM) curriculum pacing syncs and parent-teacher conferences.`
        ],
        requirements: [
          degreeLine(subject),
          `B.Ed / M.Ed degree is mandatory; CTET / State TET certification preferred.`,
          `Minimum ${exp} of demonstrated teaching success in reputed ${board} schools.`,
          `Demonstrated expertise in Bloom's Taxonomy, SMART lesson objectives, and Danielson Domain 3.`,
          `Fluency in English communication with strong voice projection and classroom leadership.`
        ]
      };
  }
}
