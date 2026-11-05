# InterCampus implementation audit — initial findings

Audit date: 2026-11-06  
Scope inspected: `main` branch `app.js`, `firestore.rules`, `functions/index.js`, Firebase workflows, README and current Firestore rules tests. This is a static repository review, not a penetration test or legal certification.

## Critical launch blockers

1. **Attendance check-in is client-submitted, not server-authoritative.** The browser reads the student/session, checks GPS/device/code locally, then writes the attendance document directly. Firestore rules do enforce important conditions, but the client controls submitted coordinates and the device token. GPS coordinates supplied by a browser are not proof of physical presence and can be spoofed on compromised devices.
2. **The callable attendance function is not part of the deployed workflow and is not wired into the app.** `functions/index.js` contains `checkInToSession` and `rotateAttendanceCode`, but the hosting workflow deploys only Firestore rules and Hosting. The README explicitly says Functions are skipped because billing is not enabled. The callable function also expects a different location schema (`latitude/longitude`) than the app/rules session schema (`GeoPoint location`), and its check-in freshness window (35 seconds) conflicts with the browser/rules 30-minute rotation behavior. It must not be treated as a ready fix.
3. **QR/code rotation is browser-controlled.** The lecturer's browser generates a code and updates Firestore directly every 30 minutes. It is not server-generated or tamper-resistant. The rules constrain update fields and timing but cannot establish that the code was generated securely.
4. **Device binding is a browser installation token, not immutable hardware identity.** The README acknowledges this. Clearing site data or changing browser/device can reset it; a malicious user may be able to manipulate client storage. It is a deterrent, not strong device attestation.

## Important privacy/security gaps

5. **GPS coordinates are written into each attendance record.** Define a retention period and minimise precision/retention. The UI should explain location use and request it only for check-in.
6. **Student photos are stored as data URLs in Firestore documents.** This increases document size and broadens exposure to anyone permitted to read those documents. Review whether photos are needed for attendance; minimise access and retention. Do not migrate to a paid storage service without approval.
7. **Attendance reads are broadly available to all active institution members under the current rule `allow read: if inInstitution(id)`.** This means students may be able to read other learners' attendance records if the client queries that collection. Restrict attendance reads to the learner's own record and authorised staff, while preserving reports/rosters for appropriate staff.
8. **Student and campus records have broad institution-wide read rules.** Review whether ordinary students need to read every student profile and campus record. Apply least privilege and test the UI queries before narrowing.
9. **Invitation document IDs contain email addresses** (`email__institutionId`). Email addresses can be exposed in document paths, logs, or URLs. Consider opaque invitation IDs and token-based lookup, while preserving the existing invitation flow.
10. **No documented end-to-end lifecycle yet** for data-subject access/correction/deletion requests, retention/deletion, incident response, vendor/subprocessor review, or privacy impact assessment evidence.

## Positive controls observed

- Firestore has a default-deny catch-all.
- Tenant membership is checked for most institution-scoped operations.
- Role hierarchy and campus/class checks exist in the rules and UI.
- Student attendance records use deterministic session/student IDs to prevent duplicate document creation.
- Attendance rules check session state, expiry, code, student Auth UID, status, device token, class/campus relation and GPS radius.
- Session closure is restricted to the original creator in the rules.
- A Firestore rules emulator test suite and pre-deployment validation workflow exist.

## Recommended remediation order

P0 — before any real-student pilot:
- Restrict attendance collection reads to the learner's own record and authorised staff only; add tests for student-to-student access denial.
- Decide the actual free-tier-compatible trust model. If Cloud Functions cannot be deployed, clearly label attendance as pilot-level verification and do not claim spoof-proof GPS/device verification.
- Align or remove the unused callable Functions so they cannot be mistaken for active protection; do not deploy them without resolving billing and schema mismatches.
- Add rules tests for cross-student attendance reads, cross-campus attendance/session creation, forged GPS, stale code, device mismatch and unauthorised staff reads.
- Add privacy notice, retention schedule and breach/request handling process before live personal-data use.

P1 — before public rollout:
- Rework attendance and student data reads to least privilege.
- Minimise stored location and photo data.
- Replace email-derived invitation IDs with opaque IDs if feasible.
- Complete a privacy impact assessment and controller/processor/vendor mapping.
- Establish backups, deletion, incident response and audit review.

## Remediation status — 2026-11-06

- Attendance reads are restricted in branch `security/restrict-attendance-record-reads` and draft PR #4: students can read only their own record; campus admins and lecturers are restricted to their assigned campus; institution owners/admins retain institution-wide access. Firestore Emulator CI passed the cross-student and cross-campus regression tests in workflow run #23. This change is not merged or deployed; production rules remain unchanged.
- The callable exports in `functions/index.js` remain inactive legacy code, not deployed security controls. The README now documents their schema and freshness-window mismatches; do not deploy them as-is.
- Remaining launch blockers: GPS/device values are client-submitted and browser-generated codes are not tamper-resistant. No server-authoritative check-in is active. Do not describe attendance as spoof-proof or use it for high-stakes decisions. Privacy notice, retention, request handling and incident response are still required before live student data.

## Important limitation

No application code, Firestore rules, Firebase configuration, production data, or deployment settings were changed during this audit. These findings need test-backed remediation in a separate change set.