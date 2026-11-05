# InterCampus Privacy, Security & Compliance Checklist

**Project:** InterCampus Attendance  
**Intended operating organisation:** BULENGA CHRIST LOVE MINISTRIES LIMITED (subject to confirmation of its current legal status and the organisation's authority to operate the project)  
**Status:** Development checklist — items are not represented as completed unless evidence is recorded.

This document is a development and launch-readiness checklist. It is not a legal opinion, a PDPO registration certificate, or proof that the platform is compliant. Keep the existing company structure and Memorandum and Articles unchanged; do not initiate company amendments or NGO registration as part of this checklist.

## 1. Data inventory and accountability

- [ ] Document every personal-data field collected, its purpose, lawful basis, source, retention period, and who can access it.
- [ ] Identify the data controller(s) and processor(s) for each processing activity. Do not assume the platform operator is always the controller: institutions may determine the purposes and means of student attendance processing.
- [ ] Document the relationship between the institution, the organisation operating InterCampus, Firebase/Google, email providers, and any other vendors.
- [ ] Maintain a record of processing activities, data flows, system owners, and vendor/subprocessor contacts.
- [ ] Complete a privacy impact assessment before live deployment with student data, especially for GPS/location tracking, children, photographs, device identifiers, and large-scale attendance records.
- [ ] Use synthetic or anonymised records for development and testing wherever possible.

## 2. Data minimisation and user transparency

- [ ] Collect only fields necessary for the stated attendance and account functions.
- [ ] Explain clearly to students, parents/guardians where appropriate, staff, and institutions what data is collected and why.
- [ ] Explain when GPS is accessed, what location precision is needed, and whether location is collected only during check-in.
- [ ] Explain device binding and what device identifiers are stored; avoid collecting unrelated device information.
- [ ] Publish an accessible privacy notice before personal data is collected.
- [ ] Provide institution-facing terms and a written data-processing agreement defining each party's responsibilities.
- [ ] Provide a clear process for access, correction, deletion, objection, and other applicable data-subject requests.

## 3. Authentication, authorisation, and tenant isolation

- [ ] Enforce institution-level data isolation in Firestore Security Rules; never rely only on hiding records in the interface.
- [ ] Verify every user's institution ID, assigned campus, role, and permitted scope on every protected operation.
- [ ] Enforce the hierarchy: institution owner, institution admin, campus admin, lecturer, and student.
- [ ] Ensure users can read or change only records they are authorised to access.
- [ ] Ensure staff can open/view attendance sessions only for their assigned campus and cannot mark student attendance.
- [ ] Ensure only eligible students can check in, and only to a matching active session for their institution, campus, and class/course.
- [ ] Prevent users from changing their own role, institution, campus, class, student number, or registered-device binding through client-side requests.
- [ ] Test cross-institution and cross-campus access attempts using separate test accounts.
- [ ] Require secure account recovery and protect invitation and password-reset flows against account takeover.

## 4. Attendance integrity and device/location controls

- [ ] Validate session status, institution, campus, class/course, student identity, duplicate check-in, and device binding in trusted enforcement logic.
- [ ] Validate GPS permission, location accuracy, and configured attendance radius; explain location failure states to users.
- [ ] Treat browser-generated QR/code rotation as client-controlled unless independently enforced by trusted server-side logic. Do not describe it as tamper-proof or server-secure without evidence.
- [ ] Do not trust client timestamps, client-calculated distance, or client-supplied role claims without appropriate validation.
- [ ] Record a minimal audit trail for session opening/closing, attendance decisions, role changes, and administrative actions.
- [ ] Test replay, duplicate submission, stale QR/code, modified requests, mock-location risks, and session-close edge cases.

## 5. Storage, encryption, and secrets

- [ ] Use HTTPS for all application traffic and verify Firebase configuration is restricted to the intended projects and domains.
- [ ] Review Firestore Security Rules and test both allowed and denied cases before each release.
- [ ] Ensure sensitive records are not exposed through public database reads, public storage buckets, logs, or client bundles.
- [ ] Store credentials and private API keys only in appropriate secret storage; never commit secrets to GitHub.
- [ ] Review Firebase Authentication, Firestore, and Storage access settings and enable appropriate monitoring.
- [ ] Define backup, recovery, and secure deletion procedures.
- [ ] Confirm vendor data locations, subprocessors, retention, and international-transfer arrangements.

## 6. Retention, deletion, and incident response

- [ ] Define retention periods for student profiles, attendance records, photographs, GPS data, device identifiers, logs, and backups.
- [ ] Implement approved deletion or anonymisation workflows, including handling of backups and legally required records.
- [ ] Establish a process to receive and respond to data-subject requests.
- [ ] Create an incident-response plan covering detection, containment, investigation, documentation, notification assessment, and remediation.
- [ ] Identify who at the organisation and each institution must be contacted during a suspected breach.
- [ ] Test restoration and incident-response procedures before launch.

## 7. Ugandan legal and regulatory readiness

- [ ] Confirm the operating organisation's current URSB status and compliance directly with URSB.
- [ ] Obtain qualified advice on the organisation's legal role and the applicability of the Data Protection and Privacy Act, 2019 and its regulations.
- [ ] Determine whether the organisation must register with Uganda's Personal Data Protection Office (PDPO) as a data controller, data processor, or both, based on actual processing activities.
- [ ] Determine whether each subscribing institution has separate controller registration or other obligations.
- [ ] Complete applicable PDPO registration before commencing processing where required; do not treat development status as an automatic exemption if real personal data is being processed.
- [ ] Review applicable tax, consumer, contracting, and licensing obligations before charging institutions.
- [ ] Keep evidence of registrations, policies, contracts, training, risk assessments, and security testing.

## 8. Release gates

Do not launch with real student data until all applicable critical items below are evidenced:

- [ ] Privacy impact assessment and data inventory approved.
- [ ] Controller/processor roles and institution agreements documented.
- [ ] Privacy notice and terms published.
- [ ] PDPO applicability and registration obligations confirmed and completed where required.
- [ ] Firestore rules pass cross-tenant and role-boundary tests.
- [ ] Attendance integrity tests pass, including duplicate, replay, stale-code, and device-binding tests.
- [ ] Data retention, deletion, backup, and incident-response procedures documented.
- [ ] No secrets or sensitive test data committed to the repository.
- [ ] Production configuration and monitoring reviewed.

## Evidence log

For each completed item, record: date, responsible person, evidence link or test result, and reviewer. Do not mark an item complete based only on an intention or an unverified product setting.
