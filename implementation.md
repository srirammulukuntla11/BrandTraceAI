# Implementation Plan — BrandTrace AI

## 1. Constraints
Use React + Vite + TypeScript + Tailwind, Node.js + Express + TypeScript, MongoDB Atlas + Mongoose, Gemini via backend only, and Zod validation. Target Vercel (frontend) and Render (backend). Do not add Docker, PostgreSQL, or Redis. Do not expose secrets, discard existing work, or claim untested features work.

## 2. Inspect before coding
1. Inspect folders, package files, routes, models, components, environment examples, README, and tests.
2. Identify what already works and what is missing.
3. Run existing tests/builds where possible and note baseline failures.
4. Make a requirements checklist tied to actual files.
5. Adapt the plan to the current repository instead of forcing a rewrite.

## 3. Suggested structure
```text
brandtrace-ai/
├── frontend/src/{components,features,lib,types}/
├── backend/src/{config,middleware,models,routes,controllers,services,validators}/
├── docs/
├── srs.md
├── implementation.md
├── antigravity_build_prompt.md
└── README.md
```
Adapt to existing structure if one is already present.

## 4. Build phases

### Phase 1 — Foundation
Confirm frontend/backend start, configure env variables, connect Mongoose, set CORS for the actual frontend origin, add consistent error handling and `GET /api/health`. Health response must not expose secrets.

### Phase 2 — Guideline library
Create Mongoose model and API/UI for create/list/edit/activate/archive. Support title, category, content, prohibited terms, preferred term, content types, status, and timestamps. Clearly label sample data.

### Phase 3 — Deterministic rule checker
Implement a separate service for prohibited phrases, preferred product names, and explicitly configured required disclaimers. Handle case/word boundaries appropriately. Return quoted text, rule ID, finding type, explanation, and suggested correction. Add positive and negative unit tests.

### Phase 4 — Gemini service
Call Gemini from backend only. Send the draft and relevant guidelines, delimited as untrusted data. Request structured JSON; validate with Zod; verify quoted passages and cited guideline IDs. Map outputs to Potential Concern or Needs Verification. Merge duplicates where practical. Handle missing key, quota, timeout, provider failure, and malformed output. Deterministic findings must still be returned when AI fails. Never fake AI findings.

### Phase 5 — Draft review UI
Build content-type selection, text input, check button, loading/error states, findings list, quoted passage, type, explanation, source guideline, and suggestion. Keep rule and AI results distinguishable. Do not auto-edit or auto-approve.

### Phase 6 — Human review
Implement accept/reject suggestion, request changes, and approve/changes-required actions. Enforce reviewer permissions in backend middleware/controllers. Comments are optional if time permits.

### Phase 7 — Revision history
Each resubmission creates a new version with findings and decisions. Show chronological versions and status. Never overwrite prior versions.

### Phase 8 — Demo usability
Add clearly labelled sample guidelines and a sample draft. Provide helpful empty/loading/success/error states, responsive layout, accessible labels, and a judge-friendly demo path. Do not use fake metrics.

### Phase 9 — Testing and hardening
Test at minimum:
- empty/oversized draft rejected
- explicit phrase detected and non-match not flagged
- only active/applicable rules are used
- malformed AI output rejected
- unknown guideline ID rejected
- quote not in draft rejected
- AI failure still returns deterministic results
- non-reviewer cannot approve
- new version preserves old version
- health endpoint exposes no secrets

Run available frontend lint/build/tests and backend tests. Fix failures or document them honestly.

### Phase 10 — Deployment
Deploy frontend to Vercel, backend to Render, database to MongoDB Atlas. Configure production env vars and CORS. Check health endpoint and test the deployed flow in an incognito window. Confirm repository access. Do not claim deployment succeeded unless the live URL was actually tested.

## 5. Environment variables
Create `.env.example` files with placeholders only. Suggested backend variables: `PORT`, `NODE_ENV`, `MONGODB_URI`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `JWT_SECRET` if JWT is used, and `FRONTEND_ORIGIN`. Frontend may use `VITE_API_BASE_URL`. Never put secrets in `VITE_*` variables because they are exposed to the browser. Ignore real `.env` files in Git.

## 6. Suggested API routes
Adapt to the existing project:
- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/guidelines`
- `POST /api/guidelines`
- `PATCH /api/guidelines/:id`
- `POST /api/reviews/check`
- `GET /api/content`
- `GET /api/content/:id`
- `POST /api/content/:id/versions`
- `POST /api/reviews/:id/decision`
- `GET /api/content/:id/history`

Use consistent JSON errors. Never send stack traces, secrets, or credentials to the client.

## 7. Finding contract
Suggested TypeScript:
```ts
type FindingType = "Rule Violation" | "Potential Concern" | "Needs Verification";
type FindingStatus = "open" | "accepted" | "rejected" | "resolved";
interface Finding {
  id: string;
  type: FindingType;
  severity: "low" | "medium" | "high";
  quotedText: string;
  title: string;
  explanation: string;
  guidelineId?: string;
  guidelineTitle?: string;
  suggestedCorrection?: string;
  status: FindingStatus;
}
```
Keep types aligned between frontend/backend and validate at runtime.

## 8. Round 3 proposals
Choose three after assessing the actual MVP:
1. Side-by-side revision diff with resolved/new findings.
2. Compliance insights based on history, with minimum-data warnings.
3. Approved-asset checks or improved retrieval for large guideline libraries.
These are plans, not completed features, until implemented.

## 9. Definition of done
The deployed main workflow works; rule results are reproducible; AI failure does not break rule checks; approval is backend-protected; revision history preserves earlier versions; judges can access the site and repo; builds/tests are run and documented; and Round 2 documentation honestly lists completed features, incomplete items, limitations, and Round 3 plans.
