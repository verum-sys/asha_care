# DiagNXT CareLink: design decisions

This file explains why the code is built the way it is. Read [flow.md](flow.md) for how it works end to end.

Each entry gives the decision, the reason for it, and what it costs us or what to watch for. Most of these decisions came from feedback on how ASHA workers and the PHC, DH and TCC care teams actually use the app.

---

## 1. Platform and architecture

### Offline-first PWA, data in IndexedDB
- **Decision:** a Vite + React progressive web app (`vite-plugin-pwa`). All records live on the device in IndexedDB (`src/db/db.ts`, accessed through `src/db/repo.ts`).
- **Why:** ASHA workers screen people in villages where the network drops in and out. Screening, saving and reviewing a case must work with no connection. A PWA also installs on a phone like an app without going through an app store.
- **Trade-off:** the data is per device. Cross-device sharing depends on sync (see the next entry), and records are not encrypted at rest yet.

### A simulated server behind one module
- **Decision:** `src/sync/remote.ts` imitates the backend with `remote_*` IndexedDB stores. `src/sync/sync.ts` pushes the outbox and pulls facility updates.
- **Why:** the hackathon demo needs no real backend. Every server call goes through that one file, so swapping in the real DiagNXT API means replacing `remote.ts` only.
- **Ownership rule, which removes sync conflicts:**
  - The field device owns patient fields, referral details and `referral.worker`.
  - The facility owns `referral.facility`.
  - Neither side ever overwrites the other's fields.

### Sync runs automatically when online, and is hidden otherwise
- **Decision:** `ConnectivityProvider` syncs on its own whenever the device is online and there are pending records. The "Sync" link appears only when offline.
- **Why:** user feedback said a sync control is noise when the internet is working. It only matters when the worker is offline and data is waiting.

### Clerk for sign-in; account roles are separate from care tiers
- **Decision:** Clerk (`@clerk/clerk-react` in the browser, `@clerk/backend` on the server) handles login. ASHA, PHC, DH and TCC are **care modules** inside the dashboard. They are not login roles (`src/auth/access.ts`).
- **Why:** the reference DiagNXT platform defines roles as Super Admin, Doctor, Nurse and so on. One administrator needs to demo all four tiers without switching accounts.
- **Trade-off:** record-level authorization is enforced only in the client. Production needs it on the server.

### HashRouter URLs (`#/case/REF-0010`)
- **Why:** these work on any static host, including Vercel, without rewrite rules, and they keep working offline from the service worker cache.

---

## 2. AI usage

### Local rules first, the LLM only when needed
- **Decision:** every CBAC answer first goes through the local parser (`parseCbacInterviewAnswer`).
- **When the LLM is called:** the server endpoint `api/interpret-answer.ts` (Groq, model from `GROQ_MODEL`) is called only if the local parse fails, or if the wording is free text that isn't a simple "yes/no/daily" style answer. The code is in `src/intelligence/answerInterpretation.ts`.
- **Why:** it is fast, it works offline for most answers, and it keeps cost down.
- **Speech-recognition errors:** recognition often mishears words, for example "Delhi" for "daily". The LLM receives the recognizer's alternative transcripts too, so it can recover the intended word instead of rejecting the answer.

### The LLM never writes to the form directly
- **Decision:**
  - The LLM returns `normalizedAnswer` and `confidence`.
  - Anything below 0.85 confidence, or marked "needs clarification", is rejected.
  - An accepted answer is run back through the same local parser, which does the actual field updates.
  - Each AI-interpreted answer is tagged "AI interpreted as … Review this selection."
- **Why:** this is a clinical screening form. The parser is the single source of truth for scoring, and the worker can always see and undo what the AI inferred.

### The API key stays on the server and requests need a Clerk session
- **Decision:** the Groq key lives in Vercel environment variables, and `.env.local` locally, which is git-ignored. The endpoint checks the Clerk session token and allows 30 requests per minute per user.
- **Why:** a key in a PWA bundle is public. The rate limit protects the hackathon budget.

### The AI address check fails open
- **Decision:** `validate-address` asks the LLM whether the text looks like a real address. If the network or the AI is unavailable, the local checks alone decide (`src/intelligence/addressCheck.ts`).
- **Why:** workers sometimes typed nonsense into the address field, so a check helps. But a missing network must never stop a CBAC from being saved.

### The AI summary is shown once, in the ASHA stage only
- **Decision:** the summary is created and edited at ASHA. It travels with the referral inside `clinicalHandovers` and is shown only in the ASHA section of the "Notes from previous care teams" view.
- **Why:** user feedback said the same summary repeated at PHC, DH and TCC was clutter. Later tiers add their own notes instead.

### The AI summary goes into the referral notes on request
- **Decision:** the ASHA "Refer to PHC" dialog has **Generate AI summary** and **Edit** buttons next to "Referral Reason & Handover Notes". Generate puts the summary at the top of that box, and Edit puts the cursor in the box. The notes box starts without the summary.
- **Why:** a separate "AI summary handover" box above the notes was confusing. One editable box means the worker sees and controls exactly what is handed over.
- **Note:** "Generate" uses `buildSummary()` in `AiSummaryModal.tsx`. It builds the text from the saved data with rules, not the LLM, so it is instant and works offline.

### ASHA notes are built from rules, not the LLM
- **Decision:** `src/intelligence/ashaNote.ts` builds plain-language sentences from saved data, for example "CBAC assessment done for X on DATE. Will go to CHC Bero on DATE."
- **Why:** the note shows on every list card, so it must be instant, free and offline. It is also always consistent with the record.

---

## 3. CBAC form and UX

### Guided one-question-at-a-time flow for new ASHA screenings
- **Decision:** a new CBAC starts with "Use voice" or "Fill manually". Either way it asks one question at a time and ends on a review report. The code is in `src/components/GuidedCbac.tsx` and `src/pages/frontline/CbacScreening.tsx`.
- **Why:** the full form was described as "very chaotic" for ASHA workers on phones. One question per screen also suits voice.
- **Details from feedback:**
  - Questions are labelled by section, for example "Section B · Question 1".
  - Going back shows the saved answer highlighted.
  - Every question has a Next button, and there is no separate Continue button.
  - Next stays disabled until the question has an answer ("Answer this question to continue").

### Part B asks about one category first
- **Decision:** Part B first asks "Do you have a problem with any of these:" and lists the categories as options: TB or cough, eyes or ears, mouth, skin, women's health, elderly, or "None of these". The worker picks **one**, and only that category's symptom questions follow. The code is in `cbacPartBInterview.ts`.
- **Why:** asking every Part B symptom of every person takes too long and doesn't help. Women's and elderly categories appear only when they apply, based on sex and age. One category per screening was requested.
- **Voice:** if two areas are spoken, such as "TB and mouth", the parser refuses with "Please choose only one problem area" and changes nothing.

### Cooking fuel is a single choice
- **Decision:** Part C's "What type of fuel do you use at home for cooking?" accepts one fuel, in the guided flow, the report editor and the full form. Two spoken fuels are refused.
- **Why:** this was requested; the household's main fuel is what the screening needs.

### Mobile, address and PIN are mandatory and asked inside the flow
- **Decision:** these are questions in the guided flow, checked by `contactValidation.ts`, plus the AI address check. Saving is blocked until they are valid.
- **Why:** they were previously flagged as "missing" only at the end. A referral without a reachable phone or address can't be followed up.

### No preset answers on judgement fields
- **Decision:** Screening Finding, Referral required, Urgency and Patient Intention all default to "Please select".
- **Why:** a pre-selected value can be read as the app biasing the clinical decision, which is a regulatory concern.
- **Exception:** at PHC, DH and TCC the Key Finding defaults to "Needs review", because those tiers don't make the screening call themselves.

### One form layout per case, at `/case/:id`
- **Decision:** opening any existing case shows one page: the Case stage summary, then a sectioned report (Patient details, A, B, C, D, Referral). The sections use the exact CBAC question wording, can be collapsed, and can be edited in place.
  - `/case/:id/cbac` now redirects to `/case/:id`.
  - The "Save changes" button appears only after something is edited.
- **Why:** having a separate view page and edit page confused users. Back from one landed on the other, and "all the hard work of filling the form goes in vain."
- **PHC restriction:** at PHC, only name, phone and address are editable. The rest is read-only (`inert`), because the screening belongs to ASHA.

### Back never throws away answers
- **Decision:** three mechanisms work together.
  - **One history entry per guided step:** a new CBAC puts its step in the URL (`#/cbac?tier=asha&step=q14`, `…&step=report`). Moving forward adds a history entry, so the app's Back and the browser's back both go to the previous question.
  - **A draft for the tab:** the answers of a new CBAC are kept in sessionStorage (`src/intelligence/cbacDraft.ts`) and restored whenever a step is reopened, including after a reload. "New CBAC Registration" (no `step`) always clears it.
  - **Back history trail:** `src/components/backNavigation.ts` records the page at each history index. The app's Back goes to the nearest earlier page that is not a form page and not the current page. A guided step (`/cbac?…step=…`) is not counted as a form page, because its answers can be restored.
- **After saving:** the case page is pushed on top of the report, so Back from the new case returns to the filled-in report. Saving again from there updates the same case (`savedCaseId` in the draft) instead of creating a duplicate.
- **Why:** users repeatedly lost a whole filled form by pressing Back ("all the hard work … goes in vain").

### Referred cases stay with the referring tier
- **Decision:**
  - After confirming a referral from a case page, the app goes back to the referring tier's list (`#/tier/asha` after Refer to PHC), replacing the case page in history.
  - A tier's list also shows the cases it referred onward (found through `clinicalHandovers[].fromTier`). They carry a "Referred to PHC/DH/TCC" tag, show the appointment set while referring, and have no Refer button, only follow-up.
  - Opening a case from a list adds `?tier=<list tier>` to the case URL. `CaseView` uses it as the viewing tier, and hides Refer when the case already sits at a later tier.
- **Why:** after referring, ASHA saw the case re-render as a PHC case with "Refer to DH", which ASHA can't do. ASHA still has to follow the person up after referral.

### The appointment is set when referring
- **Decision:** Refer to PHC, DH and TCC all require an **Appointment Date** (today or later). It is saved as the first appointment fact at the receiving tier (`referToNextTier(…, appointmentDate)`).
- **Why:** the list order, the ASHA notes and the follow-up all depend on the appointment. Asking for it at the moment of referral means it is never missing.

### Record follow-up only reschedules
- **Decision:** the follow-up page offers one option, "Appointment rescheduled", pre-selected, with a new date (`tierFollowUpOptions.ts`).
- **Why:** this was requested. Attendance has its own button at PHC, DH and TCC, and onward referral has the Refer button.
- **Watch for:** TCC no longer has an "Outcome recorded" option anywhere. Add it back at TCC if the loop needs closing.

### ASHA sees only what ASHA can do
- **Decision:** at ASHA, these are removed:
  - the care-state and Intelligence panel
  - the attendance and facility-acceptance rows
  - the AI Summary buttons
  - the separate "Edit patient / referral" page
- **What ASHA gets instead:** two green buttons, **Record follow-up** and **Refer to PHC**. Refer disappears once the case has been referred.
- **Why:** an ASHA worker records follow-ups and refers. Attendance and acceptance are recorded by the facility.

### Wording that depends on the tier
- **Decision:** `src/i18n/terms.ts` turns "patient" into "community member" at ASHA and PHC, and keeps "patient" at DH and TCC. It applies automatically to every `t()` string through `useTermTier`.
- **Why:** this is the requested language. At ASHA and PHC people are not yet under treatment. Doing it in one place avoids editing hundreds of strings.

### ASHA worker identified by ID, not name
- **Decision:** the default worker is `ASHA-1001`.
- **Why:** this was requested so records aren't tied to a personal name.
- **Note:** it is a placeholder. A real ID should come from login or a registry.

### List order: nearest appointment, then urgency
- **Decision:** tier lists show upcoming appointments first (nearest date first), then past appointments, then cases with no appointment. Ties are broken by urgency: urgent, then soon, then routine.
- **Why:** the worker should see who needs attention next.

### Timeline oldest first, without sync entries
- **Why:** the timeline reads as a care journey. "Synced — reached the server" was technical noise for the user.

---

## 4. Internationalisation

### The English text is the translation key
- **Decision:** `t('Save changes')` looks up `src/i18n/hiExtra.ts`. Hindi is stored in `scripts/i18n_table_*.py`, and `scripts/i18n_codemod.py` regenerates `hiExtra.ts` and also wraps known literal strings in `t()`.
- **Why:** the whole UI needed Hindi quickly, across hundreds of existing strings. Using the English text as the key means no key naming and readable components.
- **Safety net:** `src/i18n/coverage.test.ts` fails if a literal `t('…')` has no Hindi entry.
- **Caveat:** the Hindi is machine-drafted, so a native speaker should review it.

---

## 5. Engineering practices

- **Tests:** these are Vitest tests. Pure logic is tested directly, and UI is tested with `renderToStaticMarkup`, so no browser is needed. Run `npm test` and `npx tsc --noEmit` before every push.
- **Small, focused changes:** each user request went in as its own commit on `main`.

---

## 6. Known gaps and next steps

| Gap | Suggested next step |
| --- | --- |
| Supabase backend not yet used in production | Run `supabase/schema.sql`, set the env vars, then replace the open RLS policies with per-tier ones (see `supabase/README.md`) |
| Authorization enforced in the client only | Enforce roles and record access on the server |
| No encryption at rest | Encrypt the IndexedDB data, or use a secure store |
| `ASHA-1001` placeholder ID | Take the worker ID from the login or ASHA registry |
| TCC has no "Outcome recorded" follow-up | Add it back at TCC if cases need closing |
| Form drafts live only in the browser tab | Persist drafts per device if workers need to resume later |
| Hindi is machine-drafted | Have a native speaker review it |
| Voice input needs internet (Web Speech API) | Use offline speech recognition later |
| Chrome Safe Browsing flagged `asha-care.vercel.app` | Request a review, or move to a fresh domain |
