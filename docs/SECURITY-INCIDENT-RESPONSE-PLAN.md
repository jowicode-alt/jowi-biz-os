# InterCampus Attendance — Security Incident Response Plan (Draft)

**Status:** Operational draft. Complete named contacts and test this plan before live student data is used.

## Contacts
- Platform incident lead: [NAME / ROLE / CONTACT]
- Institution incident lead: [NAME / ROLE / CONTACT]
- Privacy lead: [NAME / ROLE / CONTACT]
- Technical responder: [NAME / ROLE / CONTACT]
- Legal/regulatory adviser: [NAME / ROLE / CONTACT]

The institution and platform operator must agree who leads incidents, who can disable accounts/services, and who assesses notification obligations.

## Initial response
1. Record detection time, reporter, affected system and initial facts.
2. Preserve relevant logs, timestamps and evidence; restrict access to evidence.
3. Identify affected projects, institutions, accounts, data categories and likely duration.
4. Notify the named incident leads promptly.
5. Avoid deleting evidence or making public statements before coordinating with the authorised lead, except where immediate protective action is required.

## Containment
Depending on the incident, disable compromised accounts, reset credentials, suspend invitations, restrict affected access, or pause the affected feature/pilot. Preserve configuration and logs. Do not deploy unreviewed rules or destructive fixes. Record emergency changes and verify the Firebase project before acting. Never change the UICT Attendance project as part of an InterCampus response.

## Investigation
Establish what happened, when, how it was detected, which records and people were affected, whether data was accessed/copied/altered/lost, whether children, location data, photos or credentials were involved, likely consequences, and what evidence remains uncertain. Separate verified facts from assumptions.

## Notification decision
The institution/controller and platform operator must assess applicable legal, contractual and supervisory-authority notification duties and deadlines with qualified advice. Do not assume one universal deadline. Record the decision-maker, reasoning and time. If notification is required, provide accurate details of the incident, affected data, likely consequences, actions taken, protective steps and contact details.

## Recovery and closure
Restore service only after the cause is sufficiently understood, access controls are checked, compromised credentials are rotated and relevant tests pass. Record the timeline, evidence, decisions, affected data, notifications, containment, recovery and corrective actions. Assign owners and due dates. Review rules, tests and training.

## Tabletop exercise
Before pilot, rehearse: cross-campus attendance exposure; compromised owner account; student attendance records exposed to other learners; and accidental sharing of a GPS-containing report. Use synthetic data only and record actions and retest evidence.
