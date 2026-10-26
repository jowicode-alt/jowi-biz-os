# InterCampus Attendance

A multi-campus attendance platform foundation for educational institutions that legally permit phone-based attendance.

## Pilot foundation
- Firebase email/password authentication and password reset
- Institution workspace setup with institution type, country and time zone
- Institution-scoped Firestore rules and membership records
- Campus, class/course and learner registers
- Session creation, displayed QR and rotating short code, and session closure
- CSV exports for learner and session registers
- Responsive phone, tablet and desktop layout

## Important limitations
This is a pilot foundation, not a production attendance verification system. QR/code generation currently runs in the browser. Trusted server-side verification, student self check-in, server-controlled code rotation, device restrictions, enforced GPS validation, exception review/audit events, PDF reports, invitations and automated security tests still need implementation and testing. Do not treat the displayed QR alone as verified attendance for official or high-stakes decisions.

## Deployment boundary
This repository deploys to the existing jowi-biz-os Firebase project to replace the Jowi Biz OS website at that target. It does not deploy to the attendence-uict-bbit Firebase project and does not change the UICT Attendance repository or APK.
