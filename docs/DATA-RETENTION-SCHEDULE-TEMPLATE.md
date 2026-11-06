# InterCampus Attendance — Data Retention Schedule (Draft)

**Status:** Proposed baseline for institutional/privacy review, not an approved policy or a statement of statutory Ugandan retention periods. The institution must approve each period against applicable education, employment, audit and legal obligations before live use.

| Data | Proposed starting point for review | End-of-period action |
|---|---:|---|
| Account profile and role | Active account + 90 days after deactivation | Delete or minimise; retain only required audit facts |
| Learner profile | Active enrolment + 12 months | Delete/minimise unless a documented requirement justifies longer retention |
| Attendance outcome | Academic year end + 24 months | Delete/anonymise unless a documented legal or academic hold applies |
| Precise GPS coordinates and accuracy | 30 days, only if genuinely needed | Delete precise coordinates; retain minimal attendance outcome/audit data |
| Device installation token | While binding is active + 30 days | Remove on re-registration/deactivation |
| Profile photograph | Active account only, if necessary | Delete on removal/deactivation; avoid collection if unnecessary |
| Parent/guardian contact | Active enrolment + 90 days, if necessary | Delete when no longer needed |
| Pending invitation | 30 days | Expire and delete |
| Security/diagnostic logs | 90 days, subject to vendor controls | Delete or aggregate |
| Backups | Confirm provider-specific lifecycle | Expire under documented backup schedule |

## Application rules
1. These are proposals for review, not legal deadlines.
2. Record who approved each period, the purpose and any legal/academic basis for longer retention.
3. Use the shortest practical period, especially for GPS, photos and children's information.
4. Do not retain precise GPS merely for convenience. Consider retaining the attendance decision and a derived validation result instead.
5. Address primary records, exports, derived copies and backups. Document unavoidable backup expiry delays.
6. Apply legal holds only to necessary records and record authorisation and end date.
7. Review at least annually and whenever the service, institution policy or law changes.

**Implementation gap:** This document does not implement automatic deletion. Define, implement and test deletion, audit evidence and backup expiry before claiming records expire automatically.
