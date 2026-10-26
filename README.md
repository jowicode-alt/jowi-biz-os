# InterCampus Attendance

A multi-campus attendance platform foundation for educational institutions that legally permit phone-based attendance.

## Pilot foundation
- Firebase email/password authentication and password reset
- Institution workspace setup with institution type, country and time zone
- Institution-scoped Firestore rules and membership records
- Campus, class/course and learner registers
- Session creation, displayed QR and static pilot code, and session closure
- CSV exports for learner and session registers
- Responsive phone, tablet and desktop layout

## Important limitations
This is a pilot foundation, not a production attendance verification system. QR/code generation currently runs in the browser. Trusted server-side verification, student self check-in, secure server-controlled code rotation, device restrictions, enforced GPS validation, exception review/audit events, PDF reports, invitations and automated security tests still need implementation and testing. The free deployment workflow intentionally skips Cloud Functions because Google Cloud Functions deployment requires billing-enabled project services. The browser-generated QR/code is a demonstration only and can be manipulated; do not use it as proof of attendance. Do not treat the displayed QR alone as verified attendance for official or high-stakes decisions.

## Deployment boundary
This repository deploys to the existing jowi-biz-os Firebase project to replace the Jowi Biz OS website at that target. It does not deploy to the attendence-uict-bbit Firebase project and does not change the UICT Attendance repository or APK.


## Free deployment

The current workflow deploys Firestore rules and Firebase Hosting without attempting to deploy Cloud Functions. The backend function source is retained as a future option if billing becomes available, but those functions are not deployed in the current free setup. The session code is static and browser-generated; this is not secure attendance verification.
