# DiagNXT CareLink: how the code works

This file walks through how the app runs, from login to referral. Read [decision.md](decision.md) for why it is built this way.

## 1. Run it locally

```bash
npm install
npm run dev          # dev server (no service worker)
npm test             # Vitest unit and UI tests
npx tsc --noEmit     # typecheck
npm run demo         # production build + preview with the service worker
```

Environment variables:

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | `.env` / Vercel | Clerk sign-in in the browser |
| `CLERK_SECRET_KEY` | Vercel / `.env.local` | The server verifies session tokens |
| `GROQ_API_KEY` | Vercel / `.env.local` | LLM calls (server only) |
| `GROQ_MODEL` | optional | Defaults to `qwen/qwen3.8-27b` |

Deploys happen automatically: every push to `main` deploys to Vercel. The `api/` folder becomes a serverless function.

## 2. Folder map

```text
api/interpret-answer.ts   Serverless endpoint: Clerk check, rate limit, Groq tasks
server/                   Groq prompts: interpretation.ts, clinicalNotes.ts, addressCheck.ts
src/
  App.tsx                 Routes + AccessGate (login, role access) + CbacRoute redirect
  auth/                   Clerk wrapper, AuthContext, access.ts (roles, which paths each role may open)
  db/                     IndexedDB schema (db.ts), types.ts, repo.ts (all reads/writes), seed.ts, useLive.ts
  sync/                   connectivity.tsx (online state, auto-sync), sync.ts (push/pull), remote.ts (simulated server)
  intelligence/           Pure logic: CBAC scoring, answer parsing, validation, notes, care-state engine
  components/             Shared UI: GuidedCbac, CaseStageSummary, Timeline, modals, Layout/BackLink
  pages/
    admin/SuperAdminDashboard.tsx   Module cards (ASHA / PHC / DH / TCC)
    tiers/TierModuleView.tsx        Community member / patient list for one tier
    frontline/CbacScreening.tsx     The CBAC form: guided flow, report, full form, save
    frontline/CaseView.tsx          The single case page (/case/:id)
    frontline/RecordFollowUp.tsx    Follow-up form
  i18n/                   t(), en.ts, hi.ts, hiExtra.ts (generated), terms.ts (patient → community member)
  voice/                  Speech recognition and text-to-speech helpers
scripts/                  i18n tables + codemod that regenerates src/i18n/hiExtra.ts
```

## 3. Routes

| URL | Page | Notes |
| --- | --- | --- |
| `#/login` | Login | Clerk |
| `#/` | `SuperAdminDashboard` | Four module cards; each whole card is a link |
| `#/tier/:tier` | `TierModuleView` | List for `asha`, `phc`, `dh` or `tcc`, sorted by appointment then urgency |
| `#/cbac?tier=asha` | `CbacScreening` | **New** CBAC: guided start screen |
| `#/case/:id` | `CaseView` | **The one page for an existing case**, at every tier |
| `#/case/:id/cbac` | Redirect | Sends you to `#/case/:id` (old address; `?view=form` still opens the full form) |
| `#/case/:id/follow-up` | `RecordFollowUp` | Attendance, reschedule, outcome |

`AccessGate` in `App.tsx` sends signed-out users to `/login`. It also blocks paths that the role from `access.ts` can't open.

## 4. Data model (short version)

Everything is in `src/db/types.ts`. A case is a `CaseRecord`:

```text
CaseRecord
├── patient        Patient (name, age, sex, phone, locality, pincode, …)
├── referral       Referral
│   ├── tier / unit                 which care module holds it now (asha → phc → dh → tcc)
│   ├── reason, destinationFacility, referralDate, urgency, patientIntention
│   ├── screening.cbac              the full CBAC: partA, partB, partC, partD, scores, alerts
│   ├── worker  (WorkerFacts)       owned by the field device: appointment, attendance, …
│   ├── facility (FacilityFacts)    owned by the facility: response, appointment, attendance
│   ├── physicalExam, reports, biopsyReports, radiologyReports, dhNotes, tccNotes
│   ├── aiSummaryOverride           the edited AI summary (created at ASHA)
│   └── clinicalHandovers[]         snapshot taken each time the case moves up a tier
├── followUps[]    FollowUp actions recorded by the worker
└── facilityEvents[]
```

Every write in `repo.ts` sets `syncStatus: 'pending'` and adds an `outbox` entry.

## 5. Main flow: an ASHA screening

```text
Module cards ─► #/tier/asha ─► "New CBAC Registration" ─► #/cbac?tier=asha
                                                              │
                               "Use voice" / "Fill manually"  ▼
                                   one question at a time (GuidedQuestionCard)
                                                              │
                                                              ▼
                                         Report (CbacReport) ─► Save
                                                              │
                     createCase() in repo.ts, then navigate(replace) ▼
                                                     #/case/REF-xxxx
```

### 5.1 The guided questions
1. `CbacScreening` builds the question list from `CBAC_INTERVIEW_QUESTIONS` (`intelligence/cbacInterviewQuestions.ts`). The order is:
   - name, age, sex, phone, address, PIN
   - Part A risk factors
   - the Part B category question
   - cooking fuel (Part C)
   - PHQ-2 (Part D)
   - referral
2. **Part B:** the category question (`partBCategoryQuestion`) offers only the categories that apply, based on sex and age. When the worker picks some, `cbacPartBInterview.ts` inserts only those categories' symptom questions.
3. **Voice mode:** the question is spoken (`voice/`), the mic listens, and the transcript plus the recognizer's alternatives go to `handleInterviewAnswer`.
4. **Manual mode:** `manualControlFor()` (`cbacManualOptions.ts`) picks the control for each question: buttons for single or multiple choice, or a number or text box. A tap is treated as a trusted answer.

### 5.2 Turning an answer into form fields
`interpretInterviewAnswer()` in `intelligence/answerInterpretation.ts` handles each answer:

```text
answer text
   │
   ├─► parseCbacInterviewAnswer()   local rules (EN / Hindi / Hinglish)
   │       ok and simple? ──────────────────────────► apply updates
   │
   └─► else POST /api/interpret-answer  { questionId, answer, alternatives }
           server: Clerk token ✔, rate limit ✔, Groq ─► { normalizedAnswer, confidence }
           confidence ≥ 0.85 ? ─► parseCbacInterviewAnswer(normalizedAnswer) ─► apply updates
                                 (tagged "AI interpreted as …")
           otherwise ───────────► "Please clarify…" (no fields changed)
```

Contact fields are checked by `contactValidation.ts`: a 10-digit mobile starting with 6 to 9, a real-looking address, and a 6-digit PIN. The address also goes to `addressCheck.ts`, which calls the AI check. If the AI is unreachable, the local result stands.

### 5.3 Scoring and triage
`intelligence/cbacIntelligence.ts` works out the scores and alerts:
- **Part A score:** age band + tobacco + alcohol + waist + activity + family history, out of 12. A score **above 4** means high NCD risk.
- **Part B:** any symptom raises an alert. TB-suspect symptoms are flagged separately.
- **Part C:** biomass fuel or occupational smoke means COPD risk.
- **Part D:** the PHQ-2 score is out of 6. A score **above 3** means a mental health referral.
- **Urgency:** urgent for TB suspect, a PHQ-2 alert, or a Part A score of 7 or more. Soon for high NCD risk or any symptom. Otherwise routine.

### 5.4 Saving
`handleSaveAssessment()` in `CbacScreening.tsx`:
1. Validates the name, mobile, address and PIN, and runs the AI address check.
2. Builds the `patientDraft` and the `referralDraft`. The referral draft includes `screening.cbac`, the reason (from the triage reasons) and the urgency.
3. Saves:
   - New case: `createCase()`, then `navigate('/case/<id>', { replace: true })`. Replacing means the form is not left in history.
   - Existing case: `updateCase()`. When the form is embedded in the case page it stays on the page and just refreshes.

## 6. The case page (`#/case/:id`)

`CaseView.tsx` loads the case with `useLive(getCase)`, which re-runs whenever IndexedDB changes. It renders:

**At ASHA**
1. Back · **Record follow-up** (green) · **Refer to PHC** (green)
2. `<CbacScreening embedded />`, which shows:
   - the `CaseStageSummary`, with the referral-required, facility acceptance and attendance rows hidden at ASHA
   - the `CbacReport`: collapsible sections Patient, A, B, C, D and Referral with the exact question wording. **Edit** turns every row into an input, dropdown or checklist, and **Save changes** appears only once something has changed.
3. **Notes (ASHA Worker)**: `ashaNoteLines()` builds the sentences from the record.
4. **Care journey**: `Timeline`, oldest first. **Refer to PHC** sits at the bottom right.

**At PHC, DH and TCC**
1. Back · Refer to DH or Refer to TCC
2. `<CbacScreening embedded tier={tier} />`, the same form. At PHC only name, phone and address are editable.
3. These cards follow:
   - care journey summary
   - previous care team notes (`ClinicalHandovers`, opened on hover or tap)
   - appointment and attendance
   - physical exam notes
   - reports (PDF)
   - DH and TCC notes
   - timeline

## 7. Moving a case up a tier

`TierReferralModal` calls `referToNextTier()` in `repo.ts`:

```text
current referral ──► push a ClinicalHandover { fromTier, toTier, physicalExam, notes, aiSummary, visit status }
                 ──► tier = next tier, destination / urgency updated
                 ──► worker and facility facts reset for the new tier
                 ──► syncStatus = 'pending', follow-up 'referral_sent' recorded
```

The case then appears in the next tier's list (`#/tier/phc` and so on). The earlier tier's notes are shown in "Notes from previous care teams". The AI summary appears only in the ASHA section.

## 8. Follow-ups and attendance
- **ASHA:** "Record follow-up" opens `#/case/:id/follow-up` (`RecordFollowUp.tsx`). It records contacted, unable to reach, attended, not attended or rescheduled with a new date, and so on, through `addFollowUp()`.
- **PHC, DH and TCC:** "Record attendance" opens `VisitStatusModal`, which calls `updateVisitDetails()`.

## 9. Sync
```text
repo.ts write ─► record.syncStatus = 'pending' + outbox entry
ConnectivityProvider: online && pending > 0 ─► syncNow()
syncNow(): push outbox ─► remote.pushRecords()   (keeps facility-owned facts on the server)
           pull         ─► remote.pullFacilityUpdates() ─► merge referral.facility locally
           mark synced, write a sync event, clear outbox
```
To connect a real backend, replace the functions in `src/sync/remote.ts`. Nothing else talks to the server.

## 10. Back navigation
- `Layout` calls `recordVisit(history.state, path)` on every route change. This stores `{ historyIndex: path }` in sessionStorage.
- `BackLink` calls `backSteps()`, which walks back to the nearest entry that is not a form page and not the current page, then calls `navigate(-n)`.
- The form pages are `/cbac`, `/new`, `/case/:id/cbac`, `/case/:id/edit` and `/case/:id/follow-up`.
- With no usable history, Back goes to `/`.

## 11. Translations and wording
- `useLang().t('English text')` returns Hindi from `hiExtra.ts` when Hindi is selected.
- `applyTerms()` (`i18n/terms.ts`) then replaces "patient" with "community member" when the current tier is ASHA or PHC. Pages declare their tier with `useTermTier(tier)`.
- **Adding a string:**
  1. Write `t('New text')`.
  2. Add `TABLE_H["New text"] = "<Hindi>"` to `scripts/i18n_table_h.py`.
  3. Run `python3 scripts/i18n_codemod.py`.
  4. Run `npm test`. The coverage test fails if a Hindi entry is missing.

## 12. Server endpoint (`api/interpret-answer.ts`)
`POST /api/interpret-answer` with `Authorization: Bearer <Clerk session token>`:

| `task` | Body | Returns |
| --- | --- | --- |
| *(none)* | `questionId, answer, alternatives?` | `{ normalizedAnswer, confidence, needsClarification, explanation }` |
| `clinical-notes` | `context` (≤ 3500 chars) | `{ notes }`, handover notes drafted from the screening |
| `validate-address` | `context` (≤ 300 chars) | `{ looksLikeAddress, confidence, reason }` |

The endpoint returns these errors:
- `401` with no valid session
- `429` after 30 requests per minute per user
- `503` if the keys are missing
- `502` if Groq fails, in which case the client falls back to local rules or manual entry

## 13. Where to change common things

| I want to… | Edit |
| --- | --- |
| Change a CBAC question or its wording | `src/intelligence/cbacInterviewQuestions.ts` (and its Hindi) |
| Change the answer options for a question | `src/intelligence/cbacManualOptions.ts` |
| Change scoring or referral thresholds | `src/intelligence/cbacIntelligence.ts` |
| Change the report layout or sections | `CbacReport` in `src/components/GuidedCbac.tsx` |
| Change what the case page shows | `src/pages/frontline/CaseView.tsx` |
| Change the list card or sort order | `src/pages/tiers/TierModuleView.tsx` |
| Change the ASHA note sentences | `src/intelligence/ashaNote.ts` |
| Connect a real backend | `src/sync/remote.ts` |
| Change the LLM prompts | `server/interpretation.ts`, `server/clinicalNotes.ts`, `server/addressCheck.ts` |
