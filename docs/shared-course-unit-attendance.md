# Shared course-unit attendance: data model and migration notes

This is the additive academic-data foundation for InterCampus. It deliberately does not replace the existing class-based attendance flow until the user interface, invitation flow, student enrolment workflow, session discovery, check-in validation, reports, and rules can be migrated together.

## Institution-scoped collections

All records live under `institutions/{institutionId}`.

| Collection | Purpose | Core fields |
| --- | --- | --- |
| `academicYears` | Academic year catalogue | `name`, `startDate`, `endDate`, `status`, `createdAt`, `createdBy` |
| `semesters` | Semester/term catalogue | `name`, `academicYearId`, `startDate`, `endDate`, `status`, `createdAt`, `createdBy` |
| `programmes` | Institution programmes | `name`, `code`, `description`, `status`, `createdAt`, `createdBy` |
| `courseUnits` | Reusable course units shared across programmes | `name`, `code`, `description`, `programmeIds[]`, `status`, `createdAt`, `createdBy` |
| `teachingGroups` | Campus-specific delivery groups | `name`, `code`, `campusId`, `programmeIds[]`, `status`, `createdAt`, `createdBy` |
| `enrolments` | Student-to-course-unit registrations | `studentUid`, `courseUnitId`, `programmeId`, `campusId`, `teachingGroupId`, `academicYearId`, `semesterId`, `status`, `createdAt`, `createdBy` |

## Enrolment identity

Use deterministic enrolment document IDs in the form `{studentUid}_{courseUnitId}`. This prevents duplicate active enrolments for the same learner and course unit within the institution. If repeat attempts or multiple concurrent deliveries of the same unit are required later, the key must be extended with academic year, semester, and delivery/group identifiers before enabling that workflow.

## Session model (next integration step)

A course-unit session must carry `courseUnitId`, `campusId`, `academicYearId`, `semesterId`, `teachingGroupId`, and `sessionGroupMode` (`combined` or `separate`), alongside the existing unique session document ID, QR/code, GPS, expiry, and audit fields. The lecturer creates one session per delivery; a combined session includes all matching eligible enrolments, while separate groups receive separate session IDs.

## Eligibility and reporting invariants

1. Course-unit enrolment—not programme or legacy class membership—determines eligibility for new course-unit sessions.
2. Campus, academic year, semester, and teaching-group constraints must all match the enrolment.
3. A learner can take several course units and a course unit can be mapped to several programmes.
4. Each attendance record must snapshot the learner's programme and enrolment identifiers at check-in so later programme changes do not rewrite historical reports.
5. Staff may open sessions only within their campus assignment. Students must never choose a session ID manually.
6. QR/code, registered-device, GPS, expiry, and duplicate-check protections remain mandatory.
7. Existing `classes`, `classId` sessions, and historical attendance remain readable during migration.

## Current implementation boundary

The feature branch currently adds Firestore rules for the academic catalogue and enrolment collections. The live branch and hosting deployment are untouched. The existing screens and attendance check-in still use the legacy `classId` workflow; do not deploy this foundation as a completed shared-course-unit feature. The next code phase must add admin forms, course-unit enrolment management, invitation metadata, course-unit session creation/discovery, check-in enforcement, programme-aware rosters/reports, and automated rules tests as one coordinated change.
