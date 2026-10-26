# InterCampus Attendance

A multi-campus attendance platform foundation for educational institutions that legally permit phone-based attendance.

## Pilot foundation
- Separate institution-owner and invited-individual login screens; Institution ID is required to match an account to its institution
- Strong password registration with confirmation, verified email-link invitations, and profile completion
- Firebase email/password authentication after invitation acceptance and password reset
- Institution workspace setup with institution type, country and time zone
- Institution-scoped Firestore rules and membership records
- Session creation rules validate permitted duration, code format, timestamps and expiry consistency
- Session closure is restricted to the session creator and validates the closing identity
- Campus, class/course and learner registers
- Role-based invitations: institution owner → institution administrator / campus administrator / lecturer / student; institution administrator → campus administrator / lecturer / student; campus administrator → lecturer / student; lecturer → student
- Learner invitation form collects full name, Institution ID, email, contact, campus, class/course and student number; UID and device token are generated automatically on registration
- Profile fields include date of birth, gender and photo; photos are compressed in the browser and stored in Firestore (no Firebase Storage upload is used)
- Session creation, displayed QR and static pilot code, and session closure
- CSV exports for learner and session registers
- Responsive phone, tablet and desktop layout

## Important limitations
This remains a pilot foundation, not a production attendance verification system. Session QR/code rotation and parts of attendance validation run in the browser and are not tamper-proof. The learner device token is an app-generated browser installation token, not an immutable hardware identifier; clearing browser data or switching devices will require an administrator-assisted re-registration. Profile photos are resized/compressed and stored as data URLs in Firestore to avoid Firebase Storage and Cloud Functions billing dependencies; keep uploads small. Enable Email link (passwordless) sign-in in Firebase Authentication and ensure the Firebase Hosting domain is listed under Authentication → Settings → Authorized domains before using invitations. The free deployment workflow intentionally skips Cloud Functions because Google Cloud Functions deployment requires billing-enabled project services. Do not treat the displayed QR alone as verified attendance for official or high-stakes decisions.

## Deployment boundary
This repository deploys to the existing jowi-biz-os Firebase project to replace the Jowi Biz OS website at that target. It does not deploy to the attendence-uict-bbit Firebase project and does not change the UICT Attendance repository or APK.


## Free deployment

The current workflow deploys Firestore rules and Firebase Hosting without attempting to deploy Cloud Functions. Invitation email links use Firebase Authentication's email-link provider; no custom email server or Cloud Function is used.
