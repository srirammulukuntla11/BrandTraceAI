# Software Requirements Specification (SRS)
## BrandTrace AI — Explainable Brand Compliance Platform

**Status:** Round 2 MVP specification  
**Participant/team:** Sriram Mulukuntla / `SRIRAMMULUKUNTLA11`

## 1. Purpose
BrandTrace AI helps organisations check written content against their approved brand guidelines before publication. It explains issues, suggests corrections, and leaves decisions to a human reviewer.

## 2. Problem
Content created by different employees, agencies, and AI tools can contain inconsistent product names, prohibited wording, off-brand messaging, or claims unsupported by approved references. Manual checking is repetitive and inconsistent.

## 3. MVP goals
- Manage approved guideline entries.
- Let users paste a draft and choose a content type.
- Detect explicit terminology and wording rules with deterministic code.
- Use Gemini-assisted analysis for tone, messaging, and claims when configured.
- Show each finding with quoted text, type, explanation, reference where supported, and suggested correction.
- Let an authorised human reviewer accept/reject suggestions and decide approval.
- Preserve draft versions and review decisions.
- Deliver a complete workflow that judges can use without assistance.

## 4. Out of scope for MVP
Image/logo analysis, OCR for scanned PDFs, CMS/publishing integrations, multi-brand agency management, complex approval chains, advanced analytics, and automatic approval/publication. TXT/PDF upload, comments, and insights are optional only after the core workflow works.

## 5. Roles
- **Creator:** submit drafts, view findings, revise content, view history.
- **Reviewer:** review findings, accept/reject suggestions, request changes, make final approval decisions.
- **Guideline manager/admin:** create, edit, activate, and archive approved guideline entries. For a solo MVP, this role may be combined with reviewer.

Permissions must be enforced on the backend, not only by hiding UI buttons.

## 6. Functional requirements

### FR-01 Authentication
Provide a protected sign-in/demo path. If passwords are used, hash them securely. Never hard-code secrets or expose API keys in frontend code. Document a safe judge demo path.

### FR-02 Guideline library
Allow authorised users to create, list, edit, activate/deactivate, and archive guidelines. Suggested fields:
- `id`, `title`, `category`, `content`
- optional `prohibitedTerms`, `preferredTerm`, `contentTypes`
- `status` (`active`/`archived`)
- timestamps and creator where available

Categories may include terminology, tone, messaging, approved fact, disclaimer, and other.

### FR-03 Draft submission
Allow pasted/typed text and content type selection (for example social post, advertisement, or web page). Reject empty and oversized input. Pasted text is the essential workflow; uploads are optional.

### FR-04 Deterministic rule checks
Check explicit prohibited terms, non-preferred product names, and clearly configured required wording/disclaimers. Include the matched passage and source rule. Results must be reproducible. Do not report a violation unless an explicit configured rule matches.

### FR-05 Gemini-assisted analysis
Call Gemini only from the backend. Send only the draft and relevant active guideline entries. Require structured output, validate it with Zod, verify each quoted passage exists in the draft, and verify cited guideline IDs were supplied. Treat AI results as advisory. If Gemini is missing, rate-limited, unavailable, or returns invalid data, show a clear message and retain deterministic findings. Never fabricate AI results.

### FR-06 Finding types
Use these exact types:
- **Rule Violation:** an explicit configured rule matched.
- **Potential Concern:** AI-assisted judgement about tone, messaging, or wording.
- **Needs Verification:** a claim cannot be supported by the available approved references.

Each finding should include an ID, type, severity, quoted text, title, explanation, guideline reference when supported, suggested correction, status, and timestamp. Do not label a claim false merely because a reference is missing.

### FR-07 Suggested corrections
Offer short corrections that preserve the writer's intent. Do not automatically alter a draft; the user must explicitly apply/copy a suggestion.

### FR-08 Review and approval
Reviewers can accept/reject suggestions and mark content approved or changes-required. Only authorised reviewers may make final decisions. The system must never approve content automatically.

### FR-09 Version history
Store each resubmission as a new version, with findings and decisions. Preserve earlier versions rather than overwriting them.

### FR-10 Judge usability
Provide clear navigation, sample/demo guidelines and draft, loading states, empty states, validation messages, and understandable errors. Judges should be able to test the main workflow without developer assistance.

## 7. Non-functional requirements
- **Reliability:** validate inputs and AI output; handle DB/API failures and rate limits gracefully.
- **Security/privacy:** keep secrets in backend environment variables; enforce backend permissions; limit input size; avoid logging draft text/secrets; disclose that draft text and relevant guidelines are sent to an external AI provider; use sample/non-confidential content in demos.
- **Performance:** show progress during checks and avoid unnecessary AI calls.
- **Accessibility:** readable contrast, labels, keyboard focus, and responsive layouts.
- **Maintainability:** TypeScript on frontend/backend; clear separation of routes, services, models, and validation.

## 8. Technology stack
- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: MongoDB Atlas, Mongoose
- AI: Gemini API, backend only
- Validation: Zod
- Deployment: Vercel frontend, Render backend
- Source control: Git/GitHub or another judge-accessible repository

Do not add Docker, PostgreSQL, or Redis.

## 9. Suggested data models
`User`, `Guideline`, `ContentItem`, `ContentVersion`, and `ReviewDecision` (or equivalent). Use Mongoose schemas and timestamps. A single clearly labelled demo workspace is acceptable for a time-limited MVP; do not imply multi-tenant isolation unless it is implemented and tested.

## 10. Acceptance criteria
A judge can:
1. Open the site without requesting access.
2. Sign in or use a documented demo path.
3. Add/view sample guidelines.
4. Paste a draft and run checks.
5. See reproducible rule findings.
6. See Gemini findings when configured, or a clear unavailable message when not.
7. Understand the type, explanation, quote, reference, and suggestion for each finding.
8. Accept/reject suggestions as an authorised reviewer.
9. Submit a new version and still view the previous version.
10. Make a final human review decision.

## 11. Round 2 submission checklist
Working project link, source repository link, updated PDF, implemented-feature list, technology/implementation details, changes from the Round 1 plan, and three meaningful Round 3 improvements. Verify all links in a private/incognito window. Separate completed, incomplete, and planned features honestly.

## 12. Candidate Round 3 improvements
1. Side-by-side version comparison showing resolved/new findings.
2. Compliance insights based on review history, with warnings when there is too little data.
3. Basic approved-asset checks or improved guideline retrieval for larger libraries.
