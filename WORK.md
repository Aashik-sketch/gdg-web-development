# GDG Recruitment Portal — Complete Work Log

## 1. Project overview

Next.js 14 recruitment portal using the App Router, React 18, Tailwind CSS, shadcn/ui/Radix primitives, better-auth, Firebase Admin/Firestore, Zod and Nodemailer.

The applicant flow is:

`/departments → /join/<id>[/<id2>] → submitted`

Applicants can select up to two departments, answer personal and department-specific questions, and submit. Administrators can review applicants, filter, shortlist, export CSV and send bulk email.

---

## 2. Security remediation

### S1 — Bulk email open relay
- Added admin authentication to `/api/send-email`.
- Added Zod request validation.
- Escaped applicant-controlled values inserted into HTML email.
- Added bounded email concurrency and per-recipient results.
- Returns 503 when email delivery is not configured.
- Prevents a malformed department from aborting an entire batch.

### S2 — Public applicant listing
- Added server-side admin authorization to `/api/admin/applicants`.
- Applicant PII is no longer returned to unauthenticated callers.
- Centralized the applications collection name in `lib/config.js`.

### S3 — Unauthenticated shortlisting
- Added admin authentication to `/api/shortlist/[id]`.
- Added request schema validation.
- Checks applicant existence before writing.
- Returns a real 404 for a missing applicant.
- Replaced internal datastore errors with a generic server error response.

### S4 — Admin authorization happened in the browser
- Moved authentication and admin-role checks to the server before fetching applicant data.
- Prevents applicant records from entering the React Server Component payload for non-admin users.
- Added `noindex, nofollow` metadata for the admin page.

### S5 — Firestore rules were world-readable/world-writable
- Replaced permissive rules with a deny-by-default ruleset.
- Application data access remains server-side through Firebase Admin SDK.
- Deployment of `firestore.rules` is still required for the repository rules to affect the live Firebase project.

### S6 — Missing session signing secret
- Added a production assertion for `BETTER_AUTH_SECRET`.
- Production refuses to start without a configured secret.
- Enabled secure cookies in production.
- Reduced better-auth cookie cache duration from 24 hours to 5 minutes to reduce stale-role exposure.

### S7 — Identity supplied through query parameters
- Self-service routes now derive the user's email from the authenticated session.
- Removed reliance on caller-supplied email identity.
- Updated `/api/check-applications`, `/api/check-department-submission` and `/api/get-submissions` accordingly.

### S8 — Applicant data inserted into HTML email without escaping
- Added `escapeHtml` to `lib/validation.js`.
- Only applicant-controlled substitutions such as `#name` and `#dept` are escaped.
- Trusted admin-authored rich HTML remains intact.

### S9 — Dead privileged server actions
- Removed unused `lib/actions/` modules that bypassed the secured application path.
- The sanctioned application write path is now the authenticated, validated API route.

### S10 — Open redirect in sign-in return path
- Added `lib/redirect.js`.
- Only safe internal return paths beginning with exactly one `/` are accepted.
- Rejects absolute URLs, protocol-relative URLs, backslash variants and control characters.
- Added regression coverage for redirect sanitisation.

### S11 — Firebase placeholder project fallback
- Centralized Firebase Admin initialization in `lib/firebase.js`.
- Removed the misleading production project fallback.
- Production now fails loudly when Firebase credentials are missing.
- Build-time handling remains available through the documented build flag.

---

## 3. Correctness and data modelling

### C1 — Hardcoded expired deadline
- Moved the application deadline to `lib/config.js`.
- Added `NEXT_PUBLIC_APPLICATION_DEADLINE` environment override.
- The server-side submission check and countdown use the same configuration value.
- Added a regression test preventing an already-expired default deadline.

### C2 — Application cap TOCTOU race
- Reworked the application cap and duplicate check into a Firestore transaction.
- The normal maximum remains two applications per user.
- Concurrent submissions now conflict and are retried against current database state.

### C3 — Missing server-side validation
- Added authoritative Zod validation in `lib/validation.js`.
- Added length limits and questionnaire limits.
- Trimmed user strings before applying limits.
- Unknown/privileged client fields such as `Email` and `shortlisted` are not accepted into the database write.

### C4 — Department names were used as database/application join keys
This was the central data-modelling defect.

- Stable UUIDs are now the internal department identity.
- `constants/departmentNames.js` provides UUID → display-name overrides.
- `constants/departments.js` exposes the ID-keyed catalogue.
- Questionnaire lookup, submission validation, duplicate detection and saved drafts use stable IDs.
- Renaming a department no longer destroys its questionnaire association.
- Existing submissions retain their historical display name while retaining their stable ID.

### C5 — `/development` crashed on mount
- Removed the component's dependency on a missing `setIsLoading` prop.
- Added safe handling for missing department data.
- Featured departments are resolved from the real catalogue.
- Invalid/stale department IDs are filtered out.
- Links now use `/join/<id>` rather than raw UUID paths.

### C6 — `clerk_` route-validation escape hatch
- Removed the obsolete `clerk_` acceptance branch.
- Join routes now validate every ID against the actual department catalogue.

### C7 — Filter state based on reference equality
- Replaced filtered-array state with explicit department and shortlist filter state.
- Visible table rows are derived with `useMemo`.
- Removed the O(n²) `commonElements` helper.
- Clearing filters now deterministically restores all rows.

### C8 — Sign-out performed on GET navigation
- Removed automatic sign-out from `useEffect`.
- Sign-out now happens only after an explicit button action.

### C9 — `notFound()` under streaming SSR
- Split the join route into a server validation layer and client interaction layer.
- Unknown join IDs render the not-found state.
- The streaming-SSR HTTP 200 behaviour for the not-found route is documented rather than incorrectly claimed to be eliminated.
- Added `noindex, nofollow` metadata to the join subtree to address the practical indexing consequence.

### C10 — Duplicate sources for submitted-department state
- `SubmissionsProvider` is now the single source of truth.
- Removed the duplicate fetch from `FormComp`.
- Versioned the session-storage cache to `v2` because its stored shape changed.
- The provider exposes IDs, names and count from one source.

---

## 4. React and performance remediation

### P1 — Expensive synchronous render loops
- Removed seven large render-time loops, including loops performing hundreds of thousands of operations.
- Removed the unreachable `components/Card.jsx` containing another expensive loop.
- Removed discarded `data-*` metrics generated by those loops.

### P2 — Unstable React keys and unnecessary deep clones
- Removed `Math.random()` from React keys.
- React-table keys are now extracted and passed explicitly.
- Department list items use stable department IDs.
- Removed unnecessary `JSON.parse(JSON.stringify(...))` cloning.

### P3 — Derived state stored in effects
- Removed state/effect chains for values already derivable from props or session.
- Removed the unnecessary 200 ms navigation clock.
- Static Hero/Footer content is no longer represented as client state.

### P4 — Leaked event listeners
- Removed unnecessary mousemove and scroll telemetry from the landing page.
- Remaining genuine listeners use cleanup functions.

### P5 — Components declared inside render functions
- Moved nested component definitions to module scope or inlined trivial JSX.
- Prevents React from treating recreated component functions as new element types and remounting their subtrees.

### P6 — Server/client component boundary
- Converted static components such as Hero, HowItWorks, FeatureCards, Footer, not-found and loading to server components where appropriate.
- Split the join route into server-side validation and a client-side interactive form.
- Reduced unnecessary client JavaScript.

Measured current build figures recorded in the audit:
- `/` — approximately 158 kB First Load JS
- `/development` — approximately 696 B
- `/join/[...joinIds]` — approximately 193 kB
- `/admin` — approximately 353 kB

The join route became smaller because the complete questionnaire catalogue is no longer shipped as part of the client bundle.

### P7 — Barrel imports
- Added `optimizePackageImports` configuration for `react-icons`, `lucide-react` and `@material-symbols-svg/react`.
- The previous approximately 11 MB `react-icons` server vendor chunk was eliminated in the verified build.

---

## 5. UI, design system and accessibility

### Design tokens
- Restored the missing CSS custom properties used by the Tailwind/shadcn design system.
- Added light and dark theme tokens.
- Added radius token support.
- Added visible `:focus-visible` styling.
- Added reduced-motion handling.

### Tailwind configuration
- Merged duplicate `keyframes` objects.
- Restored accordion animations.
- Added `fade-up` animation used by the departments header.

### Bootstrap-style component family
Bootstrap itself was deliberately not added because the project already uses Tailwind + shadcn/Radix. Instead, Bootstrap-like UI patterns were implemented using the existing design system.

Added/reworked primitives include:
- Alert
- Badge
- Breadcrumb
- Progress
- Stepper
- Spinner
- Skeleton
- StatCard
- EmptyState
- ButtonGroup / Toolbar

Accessibility contracts include appropriate ARIA roles, labels, progress values, current-step indicators and screen-reader-only completion text.

### Applicant flow
The three application steps are shared through `constants/applicationSteps.js`:
1. Select departments — Pick up to two
2. Complete application — Answer questions
3. Submitted — You're done

Departments and application pages use a real progress Stepper. The landing-page explanation uses numbered cards instead, because an active Stepper there would falsely imply that a visitor had already started an application.

### Departments page
- Added application-cap progress indication.
- Added status badges for selected/already-submitted departments.
- Added informational and warning alerts.
- Added mobile sticky Continue action bar.
- Improved breadcrumbs and flow communication.

### Sign-in / Continue flow
- Signed-out users now see `Sign in to continue` rather than a misleading generic Continue action.
- The intended destination is carried through sign-in using a sanitised return path.
- Department selections therefore survive authentication instead of being lost.

### Accessibility
- Added skip-to-main-content navigation.
- Added proper form labels instead of relying on placeholders.
- Added `aria-invalid` and `aria-describedby` relationships for sign-in errors.
- Added error-summary live-region behaviour.
- Added sortable-table accessibility metadata.
- Added accessible names to icon-only controls.
- Corrected sign-in tabs to use `aria-selected` rather than disabling the active tab.
- Added `aria-expanded`, `aria-controls` and meaningful labels to mobile navigation.
- Countdown digits are hidden from assistive technology while a concise polite live-region alternative communicates remaining time.

---

## 6. Verification and tooling

The delivered archive originally had no test runner and no ESLint configuration.

### Test suite
The final audit recorded:
- 10 test files
- 117 tests passing
- Vitest exit code 0

Test coverage areas include:
- Authorization
- Validation
- Deadline configuration
- Redirect safety
- Department rename safety
- UI primitive accessibility contracts
- Admin visibility
- Applicant/development route behaviour
- Continue/sign-in flow
- Admin filter reset behaviour

### Lint
- Added ESLint configuration.
- Pinned TypeScript to 5.9.3 because the TypeScript 7 compiler was incompatible with the parser version used by the Next 14 lint stack.
- `next lint` exits 0; the audit recorded three warnings in unreachable/vendor-style animation code.

### Production build
- Clean `.next` rebuild succeeds.
- The audit recorded the production build exiting 0.
- Default-secret warnings from the baseline build were eliminated.

### Clean-clone verification
The repository was cloned into a clean directory and rebuilt from repository contents alone.
- 149 tracked files
- No `node_modules` required in Git
- Dependency installation succeeded
- 117 tests passed
- Lint passed
- Production build passed

This verifies that required application source is committed rather than relying on local machine state.

---

## 7. Current department names

The scrambled display names were replaced while keeping stable UUIDs:

1. UI/UX
2. Competitive Programming
3. Data Science
4. Web Development
5. App Development
6. Management
7. Design
8. Marketing & Outreach
9. Content & Documentation
10. Cybersecurity
11. Cloud & DevOps
12. Events & Community

The UUID mapping is maintained in `constants/departmentNames.js`.

---

## 8. Deployment requirements

Before production deployment, the operator must:

1. Configure required environment variables:
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL` in production
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
   - `NEXT_PUBLIC_APPLICATION_DEADLINE`
   - Optional email credentials if bulk email is required

2. Deploy Firestore rules:

   `firebase deploy --only firestore:rules`

3. Grant the intended administrator a `role` value containing `admin`.

4. Set the real application deadline using ISO-8601 with an explicit offset, for example:

   `2026-12-31T23:59:59+05:30`

5. Run the project verification command documented by the repository before release.

6. After deployment, verify that unauthenticated requests to:
   - `GET /api/admin/applicants`
   - `PATCH /api/shortlist/<id>`
   - `POST /api/send-email`

   return authentication errors rather than applicant data or successful mutations.

---

## 9. Outstanding work from the audit

The original audit explicitly identified these items as remaining:

- Questionnaire questions in `constants/index.js` were placeholder/scrambled content and require real production copy.
- Authentication policy was left as a product decision: email verification, institutional-domain restriction, or Google OAuth restriction can be selected by the recruitment owner.
- `/admin` remains the heaviest client bundle at roughly 353 kB; dynamically loading the rich-text MailComposer was identified as a possible optimisation.
- Several unused Magic UI/UI primitives remain intentionally as a component kit; three lint warnings remain there.
- No automated axe accessibility audit was run.
- No manual screen-reader usability test was run.
- No load/concurrency test was performed.
- No dependency vulnerability scan was performed.
- Test coverage percentage was not measured.

These are intentionally recorded as outstanding rather than falsely marked complete.

---

## 10. Department rename procedure

To rename an existing department, edit only `constants/departmentNames.js`.

Do not change the UUID.

The stable ID is the identity; the displayed department name is presentation data. Keeping the UUID unchanged preserves routing, questionnaire association, duplicate detection, saved drafts and historical submission identity.

---

## 11. Work completed in this session

- Replaced the scrambled department display names.
- Added production-friendly department descriptions.
- Preserved stable department UUIDs.
- Added this consolidated `WORK.md` based on the supplied engineering audit report.

## 12. Source of this log

This work log consolidates the supplied **Recruitment Portal — Audit and Remediation Engineering Report**, including its recorded security, correctness, performance, UI/accessibility, verification, deployment and handover findings. It preserves the report's distinction between completed remediation, measured verification and outstanding operational/content work.
