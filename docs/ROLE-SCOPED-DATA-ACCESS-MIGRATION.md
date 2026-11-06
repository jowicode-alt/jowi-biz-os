# InterCampus — Role-Scoped Data Access Migration Plan

**Status:** Design note only. No production rules or application queries are changed by this document. Implement in small commits with emulator tests and UI regression checks.

## Current access and query behaviour

The current `refresh()` loads the complete `campuses`, `classes`, `students` and `sessions` collections for every signed-in role. Firestore rules currently allow institution members to read campus, class, student and session documents. Student records contain personal information including parent/guardian contact, date of birth, gender, photo data and device binding. This is broader than the minimum information needed by most users.

The learner interface currently resolves the learner's class and campus by searching the loaded `students` array for `authUid` or document ID equal to the signed-in UID. Staff roster/report screens use the student list to show names and student numbers. Session discovery filters the loaded sessions in the browser. A rules-only restriction would therefore break legitimate screens and is not safe to deploy independently.

## Target access model

| Role | Campuses/classes | Student records | Sessions | Attendance |
|---|---|---|---|---|
| Institution owner/admin | Institution scope | Institution scope for administration | Institution scope | Institution scope |
| Campus admin | Assigned campus only | Assigned campus only | Assigned campus only | Assigned campus only |
| Lecturer | Assigned campus only | Assigned campus, limited to teaching needs | Assigned campus only | Assigned campus only |
| Student | Assigned campus and own class metadata only | Own learner record only | Active sessions matching own class/campus | Own attendance record only |

The exact need for owner/admin access to full photos, parent contacts and device tokens must be reviewed separately; role access does not automatically justify displaying every field.

## Required implementation sequence

1. **Resolve learner record first.** Use a direct `getDoc` for `students/{auth.uid}`. Confirm the document ID and `authUid` match. Populate learner class/campus from that record and do not fetch the institution-wide student collection for a student login.
2. **Load learner metadata minimally.** Fetch only the learner's assigned campus and class documents by known IDs. Do not query other campuses or classes.
3. **Load sessions by constraints.** For students, query only active sessions matching their `classId` and `campusId`, and filter expiry in the client as a display convenience. Firestore rules must independently enforce the permitted class/campus scope.
4. **Scope staff queries.** Campus admins and lecturers should query campus, class, student and session collections with `campusId == assignedCampusId`. Owner/institution-admin queries may remain institution-wide where justified by their duties.
5. **Split roster fields from sensitive learner profile data.** Prefer a minimal roster projection/collection containing only the name, student number, class/campus and status needed for attendance reports. Keep parent contact, DOB, photo and device data behind a narrower get rule or a separate restricted document.
6. **Rules and tests together.** Add role-specific `get` and `list` rules. Firestore list queries must include constraints that prove the rule predicate; test both allowed queries and denied unfiltered/cross-campus queries in the Emulator.
7. **Regression review.** Test owner/admin dashboard, campus admin dashboard, lecturer roster, student login, active-session discovery, session creation, attendance roster, CSV/PDF exports, invitation acceptance and profile completion using synthetic accounts for each role.
8. **Deploy only after explicit approval.** Merge and Firebase deployment are separate release decisions. Do not deploy rules as a side effect of this migration.

## Invitation ID migration

Current invitation document IDs are derived from `email + '__' + institutionId`. The client uses this deterministic ID for invitation creation, acceptance and status updates. The rules also derive the document path from the authenticated email and require the ID to match the email and institution. A safe opaque-ID design must preserve secure email ownership verification and avoid allowing invitees to list all invitations.

Recommended future design: use a random invitation document ID, store a normalised email field, and have the invitee perform a narrowly constrained query for their authenticated email and pending status. Security rules must validate the query and document fields, and acceptance must atomically update the exact invitation document and create the member/profile records. Add tests for wrong email, wrong institution, reused/expired invite, duplicate pending invitations, and attempted enumeration. Plan migration for any pending invitations before changing the schema; do not silently orphan existing invites.

## Additional issue to resolve

The current student join flow stores the device token in the student document as `deviceId` and in the global user profile as `registeredDeviceId`; the check-in code compares against `students/{uid}.deviceId`. Keep the canonical binding field documented and synchronised, or remove the duplicate field if it is not used. Do not treat this browser installation token as immutable hardware identity.

## Release gate

This design is not implemented. Do not mark student/campus data access as least-privilege until rules, constrained queries, emulator tests and role-by-role UI regression tests all pass on the same commit. Keep the security branch unmerged and do not deploy until reviewed and approved.
