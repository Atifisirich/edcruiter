/**
 * Everything the help bot knows about Edcruiter, written for the AI to read.
 * When a feature changes, change it here too, or the bot will give old advice.
 * It is plain text on purpose: the AI reads it as its handbook. Facts only:
 * the bot's rules (what it must never do) live in systemPrompt in assistant.ts.
 */

export const GUIDE_VERSION = '2026-11-18';

export const PLATFORM_GUIDE = `
# What Edcruiter is
Edcruiter is a teacher-hiring platform for Indian schools. A school posts a vacancy, teachers apply, an AI voice agent can phone them for a quick screening, they take a five-stage online assessment, and the school's reviewers read a generated report and decide. Website: edcruiter.com. Support contact: edcruiterofficial@gmail.com.

# Who uses it (roles)
- School admin: full control of the school's workspace. Only the admin can delete or change a candidate's details, manage the team, change settings, and set review rounds.
- Recruiter (HR): the day-to-day hiring work: vacancies, adding and inviting candidates, creating tests, scheduling interviews, shortlisting, sending offers, running AI screening calls. Cannot delete or change candidate data.
- Principal, Subject head / Coordinator, Management (final decision): reviewers. They read candidate reports and give a yes or no with their opinion in the review rounds their role is assigned to. They see "My reviews".
- Candidates (teachers) sign in with their application ID or a link, never a staff login.
- Platform owner (Edcruiter team): onboards and approves schools, sets plans and team seats, and can open a school's workspace in support mode.

# The staff dashboard (left menu)
Overview, Candidates, My reviews (reviewers only), Vacancies, Interviews, then Set up: AI tests, Policies, WhatsApp; then School: Team activity, Team, Settings. Top bar buttons: Upload CVs, New vacancy, Add candidate. HR sees everything except Policies, WhatsApp, Team activity, Team and Settings (admin only). Reviewers see only Overview, Candidates and My reviews.

# Getting started for a new school
1. Sign up at edcruiter.com/signup (Google or email). A new school waits for approval by the Edcruiter team and then needs a plan before AI features, WhatsApp, vacancies and public applications unlock. Until then the dashboard shows an amber banner. To activate, write to edcruiterofficial@gmail.com with the school name.
2. School setup: campuses, subjects, grades, curricula.
3. Policies: fill the HR policy questions, optionally upload a policy video.
4. Connect WhatsApp (optional but recommended) in WhatsApp.
5. Post a vacancy, add candidates, and invite them.

# Vacancies (Vacancies page, or "New vacancy" button)
Choose a role title, subject, grades, the curriculum/board (tick every one that applies: CBSE, ICSE, ISC, Cambridge IGCSE, Cambridge A-Levels, IB, State Board), the campus and the experience/salary band. The AI writes the job description and the test is prepared. Vacancies appear on the public jobs page at edcruiter.com/jobs.

# Candidates (Candidates page)
- Add one candidate with "Add candidate", or many with "Upload CVs" (PDF CVs are read by AI) or a spreadsheet.
- Each candidate gets an application ID (a code like EDC-PHYS-AB12) and a personal link. The invite goes out by WhatsApp and email when you add the candidate with the "Add and send invite" button, or when you upload a list. The link works for 7 days and needs no password.
- To give a candidate their link again: on the Candidates list, click the copy icon in their row ("Copy the test code and link") and send them that text yourself; or tell them to sign in at edcruiter.com/candidate/login with their application ID, which their report also shows. (There is no resend button, so never suggest one.)
- Tabs filter by progress. Click a candidate to open their report: CV review, each stage's answers and videos, AI scores, flags from proctoring, and the decision panel.
- "Select" lets admins/HR tick several candidates. Admins can "Delete selected" (type DELETE to confirm; this removes everything and cannot be undone). HR can use "AI call selected".
- A candidate who stopped midway can get "one more go" from the admin if they ran out of tries.

# The candidate's five stages
1. Your details and CV (also a start photo used to check identity).
2. Subject test and lesson plan: multiple-choice questions plus a written lesson plan. Questions are drawn randomly per candidate from a large question bank.
3. Teaching demo: a short video (up to 5 minutes) recorded on camera.
4. Classroom scenario: a short situation answered on camera (about 2 minutes).
5. School policies and child safety: the candidate watches the school's policy video to the end if there is one, answers "Do you agree?" questions (a "don't agree" is allowed and is shown to the school), then ticks the two confirmation boxes.
Rules for candidates: stages go in order; each stage is taken in one sitting; fullscreen, camera and microphone stay on; no switching tabs; copy and paste are blocked. If someone leaves half way they get a fresh set of questions and the school sees they restarted. Maximum 3 goes per stage unless the school grants more. Cameras need a laptop or phone browser with camera permission allowed.

# Reports and decisions
Open a candidate to see the report. Reviewers give pass/reject in the rounds set by the school (default: Subject lead, then Principal, then Management). Actions include shortlist, hold, reject, reopen, offer sent. A kind message is sent when a candidate is declined. Generate or refresh the AI teaching profile from the candidate's page.

# AI tests (AI tests page)
Two tabs. "School tests": create a subject test for any subject (the list has 40 subjects plus "Other" to type one), choose grades and curriculum, then Use (activate) it. Only one active test per subject and grade level is used. "Question bank": the platform's own bank, readable by admin and HR, organised by subject, grade and topic with the correct answers. Where a grade shows "Too few" or "Empty", candidates take the school's own AI test instead.

# AI screening call (before any interview)
An AI voice agent phones the candidate, asks the school's questions in a natural conversation, and writes up the answers, a summary and a recommendation.
- Settings, "AI screening call" card, in three numbered steps: (1) When should the AI call? Tick "Call every new applicant automatically" if wanted; you can always call someone yourself. (2) What should the AI ask? Edit the questions (up to 12) and add an optional must-have per question: something the candidate has to say for you to carry on with them, for example "60 days or less" under the notice period question. (3) After the call, what should happen? Tick "Act on the result automatically", then either pick a ready-made choice (Careful, Fast, or HR decides everything) or set each result yourself. An "In plain words, this is what will happen" box shows the rules back in sentences. Press "Save changes" at the bottom of the card; it says "You have unsaved changes" until you do.
- For Good fit, Needs a look and Not suitable, the choices are: Send the test link now; Wait for HR to approve first (a "Send the test link" button appears on the candidate's page); or Send nothing, flag for HR. If the candidate does not pick up: how many retries, the gap, the calling hours (India time), and what to do after the last try.
- To call someone: open the candidate and scroll to the bottom, "AI screening call", press "Call now" (or "Run a demo call" if real calls are off). Several at once: Candidates, Select, tick people, "AI call selected".
- Held or flagged results show a "Send the test link" button for HR.
- Price: charged per started minute of an answered call; unanswered or busy calls are free. Usage is shown in Settings.
- A candidate whose number is on the Do Not Disturb list may not be reachable. Calls need a valid Indian mobile number.
- "Demo, no real call" means real calls are not switched on for the platform; no phone rings.

# Team and seats (Team page, admin only)
At the top, the "Add a team member" form takes a name, email and role; press "Add and send invitation". They sign in with Google using that email, or via the emailed link to set a password. Each school has seats by type, set by Edcruiter: School admin, Principal, Subject head / Coordinator, Recruiter (HR), Management. When a seat type is full it is greyed out; write to edcruiterofficial@gmail.com for more seats. "Settings, Role names" lets the admin name roles (for example "Maths Coordinator"); each name uses one seat type.

# Interviews
Interviews page: schedule interview rounds for shortlisted candidates (with a meeting link). Candidates are notified by WhatsApp/email.

# Policies (Policies page, admin only)
Answer the structured HR policy questions; they become the policy teachers read in stage 5. "Policy video and questions": upload a video of any size (MP4, WebM or MOV) and edit the "Do you agree?" questions (up to 20). Candidates must watch the video to the end before the questions appear.

# WhatsApp (admin only)
Connect the school's WhatsApp Business number, verify it, and send a test message. Candidates must have agreed to WhatsApp messages. Templates are approved by Meta. If WhatsApp fails, email still works.

# Settings (admin only)
Cards, top to bottom: Your school, Score colours (shortlist colour ranges), Candidate reports, AI screening call, Role names, Review rounds, and a More list of shortcuts. Each card that needs saving has a "Save changes" button at its bottom (Candidate reports saves as you tick).

# Common problems and fixes
- "Your school is waiting for approval" / "Choose a plan": the school needs activating by the Edcruiter team; write to edcruiterofficial@gmail.com.
- Candidate says the test link does not open: links last 7 days, so it has probably expired. Give them their link again (see Candidates above).
- Camera or microphone blocked: click the camera icon in the browser address bar, choose Allow, reload, and try again. Use Chrome on a laptop or phone, with good light.
- Stage "was closed because it was left for a while": leaving a stage for about 3 minutes closes that go; open it again from the list of stages (it gives new questions and counts as a go).
- "This stage is already finished": each stage can be submitted once.
- "Please finish the earlier stages first": stages must be taken in order.
- Test says "still being prepared": the school's test for that subject is being written; wait a minute and try again.
- A page looks empty for the platform owner: open a school with "Open workspace" on the super admin page first.
- Cannot add a team member: the seat type is full, or the email already has a login (each email can belong to only one school).
- Cannot find a button: it may be admin-only; check your role.
- Real call not ringing: calls need a valid mobile number, the candidate must not be on the Do Not Disturb list, and the platform must have calls switched on. If "Demo" shows, real calls are not on yet.
- Forgot password: use "Forgot password" on the login page.
- Deleting a candidate or data deletion requests: admin only; deletion is permanent.
`;
