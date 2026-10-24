# BrandTrace AI — Explainable Brand Compliance Platform

**TechCircuit — Round 2: The Build**  
**Participant:** Sriram Mulukuntla  
**Team Name:** `SRIRAMMULUKUNTLA11`  
**Status:** Round 2 MVP Complete & Judge-Ready  

---

## 1. Project Overview

**BrandTrace AI** is an explainable brand compliance platform designed to audit written marketing copy, social announcements, advertising copy, and external communications against approved organizational brand guidelines before publication. 

Unlike opaque AI checkers that rewrite content or make unaccountable decisions, BrandTrace AI provides:
1. **Deterministic Rule Validation:** Reproducible detection of prohibited vocabulary, incorrect product nomenclature, and missing mandatory disclaimers.
2. **Explainable Findings:** Every issue highlights the verbatim quoted passage, the exact guideline responsible, a clear explanation, and a non-destructive suggested correction.
3. **Gemini AI Tone & Claim Verification:** Evaluates subtle brand voice, messaging nuances, and unverified claims with strict grounding (never hallucinates guidelines or claims).
4. **Human Review Governance:** AI never approves content automatically. Authorized human reviewers accept or reject suggestions and make final signoffs.
5. **Preserved Version Audit History:** Submitting revisions creates chronological versions ($v1 \to v2 \dots$) without overwriting prior drafts.

---

## 2. Problem Being Solved

Content produced across decentralized teams, external creative agencies, and generative AI tools frequently introduces:
- Inconsistent product names and unauthorized terminology.
- Unsubstantiated claims (e.g., claiming "100% bug-free" or absolute guarantees without legal verification).
- Omission of mandatory regulatory and compliance disclaimers.
- Off-brand tone that damages customer trust.

Manual compliance review is slow, subjective, and creates bottlenecks. BrandTrace AI standardizes compliance checks, provides immediate explainability, and keeps humans in control.

---

## 3. Technology Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, React Router v6.
- **Backend:** Node.js, Express, TypeScript, Zod validation, JWT authentication with RBAC.
- **Database:** MongoDB Atlas with Mongoose ODM (with resilient in-memory fallback for instant offline judge evaluation).
- **AI Engine:** Google Gemini API (`@google/generative-ai`), backend-only invocation with schema enforcement and quote grounding.
- **Testing:** Vitest, Supertest.
- **Deployment Targets:** Vercel (Frontend), Render (Backend), MongoDB Atlas (Database).

*Mandatory Constraints Respected:*
- No Docker, PostgreSQL, or Redis.
- Zero client-side API key exposure.
- No hardcoded credentials or secrets.

---

## 4. Architecture & Security Model

```
                    ┌──────────────────────────────────────────────┐
                    │            BrandTrace AI Frontend            │
                    │   (React + Vite + TypeScript + Tailwind)     │
                    └──────────────────────┬───────────────────────┘
                                           │ HTTP / JSON (CORS)
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │            BrandTrace AI Backend             │
                    │         (Node.js + Express + Zod)            │
                    ├──────────────────────┬───────────────────────┤
                    │   Auth & RBAC        │ Central Error Handler │
                    └──────────┬───────────┴───────────┬───────────┘
                               │                       │
               ┌───────────────┴────────┐     ┌────────┴───────────────┐
               ▼                        ▼     ▼                        ▼
    ┌──────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
    │ Deterministic Engine │ │ Gemini AI Service  │ │ Database Connector │
    │ (Regex & Boundary)   │ │ (Grounded Quotes)  │ │ (Mongoose / Memory)│
    └──────────────────────┘ └────────────────────┘ └────────────────────┘
```

### Security & Privacy Protections:
- **Backend-Only AI:** `GEMINI_API_KEY` is strictly held in backend server environment variables.
- **Untrusted User Data Sanitization:** Draft text is delimited within `<untrusted_draft_content>` tags, and the model is explicitly instructed not to follow prompt-injection commands inside user drafts.
- **Quote & Guideline Grounding:** Every AI finding is verified against the draft text. If the quoted text does not exist in the draft, or the cited guideline ID was not supplied, it is rejected.
- **AI Graceful Degradation:** If Gemini is unavailable, misconfigured, or rate-limited, deterministic rule findings are 100% preserved. AI results are never fabricated.
- **Role-Based Access Control (RBAC):** Backend endpoints verify permissions. Creators cannot perform reviewer actions (returns `403 Forbidden`).

---

## 5. Finding Semantics

BrandTrace AI classifies all findings into three distinct, unambiguous categories:

| Finding Type | Origin | Meaning |
|---|---|---|
| **Rule Violation** | Deterministic Code | An explicit configured rule matched (prohibited phrase, non-preferred term, or missing disclaimer). |
| **Potential Concern** | Gemini AI | Advisory AI judgement regarding brand tone, messaging nuance, or awkward phrasing. |
| **Needs Verification** | Gemini AI | A factual or comparative claim lacks explicit support in approved guidelines (never labeled false without verification). |

---

## 6. Judge Rapid Evaluation Guide (30-Second Test)

Judges can test the entire lifecycle in under a minute without needing external credentials:

1. **Open Application:** Launch the frontend at `http://localhost:5173/`.
2. **Inspect Guidelines:** Navigate to **Guidelines** to view pre-loaded rules (or click **"Seed Sample Rules"**).
3. **Submit Draft:** Navigate to **New Check** and click **"Load Judge Sample Draft (With Violations)"**.
4. **Evaluate Findings:** Click **"Run Compliance Check & Submit"**. Instantly see:
   - Prohibited terms detected: *"the bot"*, *"cheap tool"*, *"100% bug-free"*, *"guaranteed zero errors"*, *"AI script"*.
   - Missing disclaimer detected: *"BrandTrace AI is an explainable compliance platform"*.
   - Quoted passages, rule explanations, and suggested replacements.
5. **Interactive Actions:** Click **"Apply"** on a suggested correction to see it update the editor.
6. **Human Review Decision:** Click **"View Version History & Decisions"**. Enter reviewer notes, then click **"Request Changes"** or **"Approve Content"**.
7. **Revision Audit Trail:** Click **"Submit Revision Version"**, modify a sentence, and submit. Notice **Version 2** is created while **Version 1** remains preserved in the version switcher tabs!

---

## 7. Local Setup Instructions

### Prerequisites
- Node.js v18+ (tested on Node v24.11.0)
- npm v9+

### Step-by-Step Installation

```bash
# 1. Clone repository
git clone <repository_url>
cd BrandTraceAI

# 2. Install backend dependencies
cd backend
npm install

# 3. Install frontend dependencies
cd ../frontend
npm install
```

### Running Locally

```bash
# Terminal 1 - Start Backend (Runs on http://localhost:5000)
cd backend
npm run dev

# Terminal 2 - Start Frontend (Runs on http://localhost:5173)
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 8. Environment Variables

Both `backend/.env.example` and `frontend/.env.example` are provided.

### Backend (`backend/.env`)
```ini
PORT=5000
NODE_ENV=development

# MongoDB Atlas connection string
# If left empty, BrandTrace gracefully runs in in-memory mode for offline judging
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/brandtrace?retryWrites=true&w=majority

# Frontend origin for CORS
FRONTEND_ORIGIN=http://localhost:5173

# Google Gemini API Key (https://aistudio.google.com/)
# If left empty, deterministic rules operate 100% and an AI status notice is shown
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# JWT Authentication
JWT_SECRET=brandtrace-dev-secret-key-2025-secure
JWT_EXPIRES_IN=7d
```

### Frontend (`frontend/.env`)
```ini
# Leave empty for local development (Vite proxies /api to http://localhost:5000)
# Set to Render backend URL when deployed (e.g. https://brandtrace-backend.onrender.com)
VITE_API_BASE_URL=
```

---

## 9. Automated Testing Results

BrandTrace AI includes comprehensive automated tests covering deterministic matching, negative checks, RBAC authorization, version preservation, AI degradation, and security.

### Test Execution Command
```bash
cd backend
npm test
```

### Actual Test Run Results:
```text
 ✓ tests/gemini.test.ts (1 test)
   ✓ preserves deterministic findings when GEMINI_API_KEY is not configured
 ✓ tests/compliance.test.ts (11 tests)
   ✓ detects explicit prohibited phrases correctly and preserves matched case
   ✓ does NOT flag non-matching compliant text (negative test)
   ✓ respects guideline status: ignores archived guidelines
   ✓ checks content-type applicability (applies disclaimer only to matching content types)
   ✓ GET /api/health returns healthy and does not expose secrets
   ✓ POST /api/content rejects empty draft submission with 400
   ✓ POST /api/content rejects oversized draft submission
   ✓ POST /api/content creates new draft and runs deterministic checks
   ✓ Role-based access: Creator CANNOT approve content (403 Forbidden)
   ✓ Role-based access: Reviewer CAN approve content
   ✓ Revision History: Submitting a new version preserves previous versions

 Test Files  2 passed (2)
      Tests  12 passed (12)
   Duration  1.88s
```

### Production Build Verification
- **Backend:** `npm run build` in `backend` $\to$ compiled cleanly to `dist/` with TypeScript ES2022.
- **Frontend:** `npm run build` in `frontend` $\to$ built cleanly with Vite in 2.82s (`dist/assets/index-DkIJPdP_.js` 246.94 kB).

---

## 10. Deployment Instructions

### Frontend (Vercel)
1. Push codebase to GitHub.
2. In Vercel, click **New Project** and import the repository.
3. Set **Root Directory** to `frontend`.
4. Framework Preset: **Vite**.
5. Environment Variable:
   - `VITE_API_BASE_URL`: `https://your-backend-app.onrender.com`
6. Click **Deploy**. SPA routing rewrite is pre-configured via `frontend/vercel.json`.

### Backend (Render)
1. In Render, create a new **Web Service**.
2. Connect your GitHub repository.
3. Set **Root Directory** to `backend`.
4. Build Command: `npm install && npm run build`
5. Start Command: `npm start`
6. Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `MONGODB_URI`: `<Your MongoDB Atlas connection URI>`
   - `GEMINI_API_KEY`: `<Your Gemini API Key>`
   - `GEMINI_MODEL`: `gemini-1.5-flash`
   - `FRONTEND_ORIGIN`: `https://your-frontend-app.vercel.app`
   - `JWT_SECRET`: `<Secure random secret>`

---

## 11. Current Limitations

- **Text-Only MVP:** Focus is exclusively on written copy (social, ad copy, articles, web pages). Image, logo, and OCR analysis are out of scope for the MVP.
- **Single Workspace Demo:** Designed for solo judge evaluation; multi-brand multi-tenant organization workspaces are not implied.
- **Offline / Missing Key Mode:** When `GEMINI_API_KEY` is not provided, deterministic rules run at 100% fidelity while AI tone analysis displays an informative status banner.

---

## 12. Round 3 Planned Improvements

Per the Hackathon Round 2 specification, the following three substantial capabilities are planned for Round 3:

1. **Side-by-Side Revision Diff Viewer:** Visual word-level diffing showing resolved findings and newly introduced issues between versions $v_n$ and $v_{n+1}$.
2. **Compliance Insights & Trend Analytics:** Historical analytics highlighting repeated team rule violations, with explicit warnings when data volume is insufficient.
3. **Approved-Asset Semantic Retrieval:** Vector indexing for 1,000+ brand guidelines and verified marketing claims with contextual prompt grounding.
