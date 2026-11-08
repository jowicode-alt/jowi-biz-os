import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, serverTimestamp, writeBatch, GeoPoint } from "firebase/firestore";
import { strict as assert } from "node:assert";

const projectId = "demo-intercampus";
const rules = await readFile("firestore.rules", "utf8");
const env = await initializeTestEnvironment({ projectId, firestore: { rules } });
const owner = env.authenticatedContext("owner-1").firestore();
const lecturer = env.authenticatedContext("lecturer-1").firestore();
const campusAdmin = env.authenticatedContext("campus-admin-1").firestore();
const institutionAdmin = env.authenticatedContext("institution-admin-1").firestore();
const outsider = env.authenticatedContext("outsider-1").firestore();
const unauth = env.unauthenticatedContext().firestore();
const invitedStudent = env.authenticatedContext("student-new", { email: "student-new@example.test" }).firestore();
const studentReader = env.authenticatedContext("student-reader", { email: "reader@example.test" }).firestore();
const studentOtherReader = env.authenticatedContext("student-other", { email: "other@example.test" }).firestore();

try {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/owner-1"), { uid: "owner-1", name: "Owner", email: "owner@example.test", institutionId: "inst-1", institutionCode: "IC-ABCD-2345", role: "owner", status: "active", createdAt: new Date() });
    await setDoc(doc(db, "institutions/inst-1"), { name: "Test Institution", type: "College", country: "Uganda", timezone: "Africa/Kampala", ownerId: "owner-1", institutionCode: "IC-ABCD-2345", status: "pilot", createdAt: new Date(), createdBy: "owner-1" });
    await setDoc(doc(db, "institutions/inst-1/members/owner-1"), { uid: "owner-1", name: "Owner", email: "owner@example.test", role: "owner", status: "active", createdAt: new Date() });
    await setDoc(doc(db, "users/lecturer-1"), { uid: "lecturer-1", name: "Lecturer", email: "lecturer@example.test", institutionId: "inst-1", role: "lecturer", status: "active", assignedCampusId: "campus-1", createdAt: new Date() });
    await setDoc(doc(db, "institutions/inst-1/members/lecturer-1"), { uid: "lecturer-1", name: "Lecturer", email: "lecturer@example.test", role: "lecturer", status: "active", assignedCampusId: "campus-1", createdAt: new Date() });
    await setDoc(doc(db, "users/campus-admin-1"), { uid: "campus-admin-1", name: "Campus Admin", email: "campus@example.test", institutionId: "inst-1", role: "campus_admin", status: "active", assignedCampusId: "campus-1", createdAt: new Date() });
    await setDoc(doc(db, "institutions/inst-1/members/campus-admin-1"), { uid: "campus-admin-1", name: "Campus Admin", email: "campus@example.test", role: "campus_admin", status: "active", assignedCampusId: "campus-1", createdAt: new Date() });
    await setDoc(doc(db, "users/institution-admin-1"), { uid: "institution-admin-1", name: "Institution Admin", email: "institution-admin@example.test", institutionId: "inst-1", role: "institution_admin", status: "active", createdAt: new Date() });
    await setDoc(doc(db, "institutions/inst-1/members/institution-admin-1"), { uid: "institution-admin-1", name: "Institution Admin", email: "institution-admin@example.test", role: "institution_admin", status: "active", createdAt: new Date() });
    await setDoc(doc(db, "institutions/inst-1/members/lecturer-campus-2"), { uid: "lecturer-campus-2", name: "Other Campus Lecturer", role: "lecturer", status: "active", assignedCampusId: "campus-2" });
    await setDoc(doc(db, "users/outsider-1"), { uid: "outsider-1", name: "Outsider", email: "outsider@example.test", institutionId: "inst-2", role: "owner", status: "active", createdAt: new Date() });
    await setDoc(doc(db, "institutions/inst-2"), { name: "Other Institution", ownerId: "outsider-1", status: "pilot" });
    await setDoc(doc(db, "institutions/inst-2/members/outsider-1"), { uid: "outsider-1", role: "owner", status: "active" });
    await setDoc(doc(db, "institutions/inst-1/campuses/campus-1"), { name: "Main Campus", city: "Kampala", timezone: "Africa/Kampala", createdAt: new Date(), createdBy: "owner-1" });
    await setDoc(doc(db, "institutions/inst-1/campuses/campus-2"), { name: "Other Campus", city: "Entebbe", timezone: "Africa/Kampala", createdAt: new Date(), createdBy: "owner-1" });
    await setDoc(doc(db, "institutions/inst-1/classes/class-1"), { name: "Class 1", code: "C1", campusId: "campus-1", createdAt: new Date(), createdBy: "owner-1" });
    await setDoc(doc(db, "institutions/inst-1/classes/class-2"), { name: "Class 2", code: "C2", campusId: "campus-2", createdAt: new Date(), createdBy: "owner-1" });
    await setDoc(doc(db, "users/student-reader"), { uid: "student-reader", name: "Reader", email: "reader@example.test", institutionId: "inst-1", role: "student", status: "active" });
    await setDoc(doc(db, "institutions/inst-1/members/student-reader"), { uid: "student-reader", role: "student", status: "active" });
    await setDoc(doc(db, "institutions/inst-1/students/student-reader"), { authUid: "student-reader", classId: "class-1", campusId: "campus-1", status: "active", deviceId: "device-reader" });
    await setDoc(doc(db, "institutions/inst-1/students/student-other"), { authUid: "student-other", classId: "class-1", campusId: "campus-1", status: "active", deviceId: "device-other" });
    await setDoc(doc(db, "users/student-other"), { uid: "student-other", name: "Other", email: "other@example.test", institutionId: "inst-1", role: "student", status: "active" });
    await setDoc(doc(db, "institutions/inst-1/members/student-other"), { uid: "student-other", role: "student", status: "active" });
    await setDoc(doc(db, "institutions/inst-1/enrolments/student-other_cu-comm"), { studentUid: "student-other", courseUnitId: "cu-comm", programmeId: "programme-business", academicYearId: "year-2026", semesterId: "semester-1", campusId: "campus-1", teachingGroupId: "", status: "active" });
    await setDoc(doc(db, "institutions/inst-1/students/student-other-campus"), { authUid: "student-other-campus", classId: "class-2", campusId: "campus-2", status: "active", deviceId: "device-other-campus" });
    await setDoc(doc(db, "institutions/inst-1/courseUnits/cu-comm"), { name: "Communication Skills", code: "COM101", programmeIds: ["programme-it", "programme-business"], status: "active" });
    await setDoc(doc(db, "institutions/inst-1/programmes/programme-it"), { name: "Information Technology", status: "active" });
    await setDoc(doc(db, "institutions/inst-1/programmes/programme-business"), { name: "Business", status: "active" });
    await setDoc(doc(db, "institutions/inst-1/academicYears/year-2026"), { name: "2026", status: "active" });
    await setDoc(doc(db, "institutions/inst-1/semesters/semester-1"), { name: "Semester 1", academicYearId: "year-2026", status: "active" });
    await setDoc(doc(db, "institutions/inst-1/semesters/semester-2"), { name: "Semester 2", academicYearId: "year-2026", status: "active" });
    await setDoc(doc(db, "institutions/inst-1/enrolments/student-reader_cu-comm"), { studentUid: "student-reader", courseUnitId: "cu-comm", programmeId: "programme-it", academicYearId: "year-2026", semesterId: "semester-1", campusId: "campus-1", teachingGroupId: "", status: "active" });
    await setDoc(doc(db, "institutions/inst-1/sessions/session-shared-course-unit"), { status: "active", courseUnitId: "cu-comm", academicYearId: "year-2026", semesterId: "semester-1", teachingGroupId: "", campusId: "campus-1", sessionGroupMode: "combined", expiresAt: Date.now() + 60000 });
    await setDoc(doc(db, "institutions/inst-1/sessions/session-class-course-unit"), { status: "active", sessionType: "class", classId: "class-1", courseUnitId: "cu-comm", campusId: "campus-1", expiresAt: Date.now() + 60000 });
    await setDoc(doc(db, "institutions/inst-1/sessions/session-course-unit-wrong-semester"), { status: "active", courseUnitId: "cu-comm", academicYearId: "year-2026", semesterId: "semester-2", teachingGroupId: "", campusId: "campus-1", sessionGroupMode: "combined", expiresAt: Date.now() + 60000 });
    await setDoc(doc(db, "institutions/inst-1/sessions/session-student-allowed"), { status: "active", classId: "class-1", campusId: "campus-1", expiresAt: Date.now() + 60000 });
    await setDoc(doc(db, "institutions/inst-1/sessions/session-student-denied"), { status: "active", classId: "class-2", campusId: "campus-2", expiresAt: Date.now() + 60000 });
    await setDoc(doc(db, "institutions/inst-1/sessions/session-student-closed"), { status: "closed", classId: "class-1", campusId: "campus-1", expiresAt: Date.now() + 60000 });
    await setDoc(doc(db, "institutions/inst-1/attendance/session-1_student-reader"), { sessionId: "session-1", studentId: "student-reader", classId: "class-1", status: "present" });
    await setDoc(doc(db, "institutions/inst-1/attendance/session-1_student-other"), { sessionId: "session-1", studentId: "student-other", classId: "class-1", status: "present" });
    await setDoc(doc(db, "institutions/inst-1/attendance/session-2_student-other-campus"), { sessionId: "session-2", studentId: "student-other-campus", classId: "class-2", status: "present" });
  });

  await assertSucceeds(getDoc(doc(owner, "institutions/inst-1")));
  await assertFails(getDoc(doc(unauth, "institutions/inst-1")));
  await assertFails(getDoc(doc(outsider, "institutions/inst-1")));
  await assertSucceeds(getDoc(doc(outsider, "institutions/inst-2")));
  await assertFails(getDocs(collection(outsider, "institutions/inst-1/students")));
  await assertFails(setDoc(doc(outsider, "institutions/inst-1/classes/cross-tenant-write"), { name: "Cross tenant", code: "X1", campusId: "campus-1", createdAt: new Date(), createdBy: "outsider-1" }));
  await assertFails(setDoc(doc(owner, "institutions/inst-1/attendance/forged"), { studentId: "x", present: true }));
  await assertFails(updateDoc(doc(owner, "users/owner-1"), { email: "forged@example.test" }));
  // Learners may read only their own attendance; staff are limited by role and assigned campus.
  await assertSucceeds(getDoc(doc(studentReader, "institutions/inst-1/attendance/session-1_student-reader")));
  await assertFails(getDoc(doc(studentReader, "institutions/inst-1/attendance/session-1_student-other")));
  await assertFails(getDocs(collection(studentReader, "institutions/inst-1/attendance")));
  // Students can fetch only their own learner document and assigned campus/class metadata.
  await assertSucceeds(getDoc(doc(studentReader, "institutions/inst-1/students/student-reader")));
  await assertFails(getDoc(doc(studentReader, "institutions/inst-1/students/student-other")));
  await assertFails(getDocs(collection(studentReader, "institutions/inst-1/students")));
  await assertSucceeds(getDoc(doc(studentReader, "institutions/inst-1/campuses/campus-1")));
  await assertFails(getDoc(doc(studentReader, "institutions/inst-1/campuses/campus-2")));
  await assertSucceeds(getDoc(doc(studentReader, "institutions/inst-1/classes/class-1")));
  await assertFails(getDoc(doc(studentReader, "institutions/inst-1/classes/class-2")));
  await assertSucceeds(getDoc(doc(studentReader, "institutions/inst-1/sessions/session-student-allowed")));
  // Shared course-unit sessions are readable through the student's active enrolment context.
  await assertSucceeds(getDoc(doc(studentReader, "institutions/inst-1/enrolments/student-reader_cu-comm")));
  await assertSucceeds(getDoc(doc(studentOtherReader, "institutions/inst-1/sessions/session-shared-course-unit")));
  const sharedSessionNow = Date.now();
  await assertSucceeds(setDoc(doc(owner, "institutions/inst-1/sessions/session-course-unit-created"), { title: "Shared Communication Skills", campusId: "campus-1", courseUnitId: "cu-comm", academicYearId: "year-2026", semesterId: "semester-1", teachingGroupId: "", sessionGroupMode: "combined", status: "active", durationMinutes: 45, requiresGps: false, createdAt: serverTimestamp(), createdBy: "owner-1", openedAt: sharedSessionNow, expiresAt: sharedSessionNow + 45 * 60000, activeCode: "654321", codeUpdatedAt: sharedSessionNow, codeVersion: 1 }));
  await assertSucceeds(getDoc(doc(studentReader, "institutions/inst-1/sessions/session-shared-course-unit")));
  await assertFails(getDoc(doc(studentReader, "institutions/inst-1/sessions/session-course-unit-wrong-semester")));
  const ownEnrolments = await getDocs(query(collection(studentReader, "institutions/inst-1/enrolments"), where("studentUid", "==", "student-reader"), where("status", "==", "active")));
  assert.equal(ownEnrolments.size, 1);
  await assertFails(getDoc(doc(studentReader, "institutions/inst-1/sessions/session-student-denied")));
  await assertSucceeds(getDoc(doc(studentReader, "institutions/inst-1/sessions/session-student-closed")));
  const learnerSessions = await getDocs(query(collection(studentReader, "institutions/inst-1/sessions"), where("status", "==", "active"), where("classId", "==", "class-1"), where("campusId", "==", "campus-1"), where("courseUnitId", "==", "cu-comm")));
  assert.equal(learnerSessions.size, 1);
  await assertSucceeds(getDoc(doc(studentReader, "institutions/inst-1/sessions/session-class-course-unit")));
  await assertSucceeds(getDoc(doc(lecturer, "institutions/inst-1/attendance/session-1_student-reader")));
  await assertFails(getDoc(doc(lecturer, "institutions/inst-1/attendance/session-2_student-other-campus")));
  // Campus staff can read only their assigned campus documents and constrained query results.
  await assertSucceeds(getDoc(doc(lecturer, "institutions/inst-1/campuses/campus-1")));
  await assertFails(getDoc(doc(lecturer, "institutions/inst-1/campuses/campus-2")));
  await assertSucceeds(getDoc(doc(lecturer, "institutions/inst-1/classes/class-1")));
  await assertFails(getDoc(doc(lecturer, "institutions/inst-1/classes/class-2")));
  await assertSucceeds(getDoc(doc(lecturer, "institutions/inst-1/students/student-reader")));
  await assertFails(getDoc(doc(lecturer, "institutions/inst-1/students/student-other-campus")));
  await assertSucceeds(getDoc(doc(lecturer, "institutions/inst-1/sessions/session-student-allowed")));
  await assertFails(getDoc(doc(lecturer, "institutions/inst-1/sessions/session-student-denied")));
  await assertSucceeds(getDocs(query(collection(lecturer, "institutions/inst-1/classes"), where("campusId", "==", "campus-1"))));
  await assertFails(getDocs(query(collection(lecturer, "institutions/inst-1/classes"), where("campusId", "==", "campus-2"))));
  await assertSucceeds(getDocs(query(collection(lecturer, "institutions/inst-1/students"), where("campusId", "==", "campus-1"))));
  await assertFails(getDocs(query(collection(lecturer, "institutions/inst-1/students"), where("campusId", "==", "campus-2"))));
  await assertSucceeds(getDocs(query(collection(lecturer, "institutions/inst-1/sessions"), where("campusId", "==", "campus-1"))));
  await assertFails(getDocs(query(collection(lecturer, "institutions/inst-1/sessions"), where("campusId", "==", "campus-2"))));
  await assertSucceeds(getDocs(collection(owner, "institutions/inst-1/classes")));
  await assertSucceeds(getDocs(collection(owner, "institutions/inst-1/students")));
  await assertSucceeds(getDocs(collection(owner, "institutions/inst-1/sessions")));
  await assertSucceeds(getDoc(doc(campusAdmin, "institutions/inst-1/attendance/session-1_student-reader")));
  await assertFails(getDoc(doc(campusAdmin, "institutions/inst-1/attendance/session-2_student-other-campus")));
  await assertSucceeds(getDoc(doc(owner, "institutions/inst-1/attendance/session-1_student-reader")));
  await assertFails(getDoc(doc(outsider, "institutions/inst-1/attendance/session-1_student-reader")));
  await assertFails(updateDoc(doc(campusAdmin, "institutions/inst-1/members/lecturer-1"), { role: "institution_admin" }));
  await assertSucceeds(getDoc(doc(campusAdmin, "institutions/inst-1/members/lecturer-1")));
  await assertFails(getDoc(doc(campusAdmin, "institutions/inst-1/members/lecturer-campus-2")));
  await assertFails(getDoc(doc(lecturer, "institutions/inst-1/members/lecturer-campus-2")));
  await assertFails(updateDoc(doc(institutionAdmin, "institutions/inst-1/members/campus-admin-1"), { role: "owner" }));
  await assertFails(updateDoc(doc(owner, "institutions/inst-1/members/campus-admin-1"), { role: "owner" }));
  await assertFails(updateDoc(doc(campusAdmin, "institutions/inst-1"), { name: "Hijacked institution" }));
  await assertSucceeds(setDoc(doc(campusAdmin, "institutions/inst-1/classes/class-campus-allowed"), { name: "Allowed class", code: "A1", campusId: "campus-1", createdAt: new Date(), createdBy: "campus-admin-1" }));
  await assertFails(setDoc(doc(campusAdmin, "institutions/inst-1/classes/class-campus-denied"), { name: "Denied class", code: "D1", campusId: "campus-2", createdAt: new Date(), createdBy: "campus-admin-1" }));
  await assertFails(setDoc(doc(campusAdmin, "institutions/inst-1/campuses/campus-2"), { name: "Hijacked campus", city: "Entebbe", timezone: "Africa/Kampala", createdAt: new Date(), createdBy: "campus-admin-1" }));
  const now = Date.now();
  const validSession = { title: "Morning class", campusId: "campus-1", classId: "class-1", status: "active", durationMinutes: 45, requiresGps: false, createdAt: serverTimestamp(), createdBy: "owner-1", openedAt: now, expiresAt: now + 45 * 60000, activeCode: "123456", codeUpdatedAt: now, codeVersion: 1 };
  await assertSucceeds(setDoc(doc(owner, "institutions/inst-1/sessions/session-valid"), validSession));
  // Session code rotation is restricted to staff authorized for that session's campus.
  await assertSucceeds(updateDoc(doc(campusAdmin, "institutions/inst-1/sessions/session-valid"), { activeCode: "234567", codeUpdatedAt: now + 30000, codeVersion: 2 }));
  await assertSucceeds(setDoc(doc(owner, "institutions/inst-1/sessions/session-owned-campus-2"), { ...validSession, campusId: "campus-2", classId: "class-2", activeCode: "345678" }));
  await assertFails(updateDoc(doc(campusAdmin, "institutions/inst-1/sessions/session-owned-campus-2"), { activeCode: "456789", codeUpdatedAt: now + 30000, codeVersion: 2 }));
  await assertFails(updateDoc(doc(lecturer, "institutions/inst-1/sessions/session-valid"), { activeCode: "567890", codeUpdatedAt: now + 30000, codeVersion: 2 }));

  await assertFails(setDoc(doc(owner, "institutions/inst-1/sessions/session-bad-code"), { ...validSession, activeCode: "123" }));
  await assertFails(setDoc(doc(owner, "institutions/inst-1/sessions/session-wrong-campus"), { ...validSession, campusId: "campus-2" }));
  await assertFails(setDoc(doc(owner, "institutions/inst-1/sessions/session-extra-field"), { ...validSession, unapproved: true }));
  await assertFails(setDoc(doc(outsider, "institutions/inst-1/sessions/session-cross-tenant"), { ...validSession, createdBy: "outsider-1" }));
  // Campus-scoped staff cannot open a class session outside their assigned campus.
  await assertSucceeds(setDoc(doc(lecturer, "institutions/inst-1/sessions/session-lecturer-campus-allowed"), { ...validSession, createdBy: "lecturer-1", activeCode: "222222" }));
  await assertFails(setDoc(doc(lecturer, "institutions/inst-1/sessions/session-lecturer-campus-denied"), { ...validSession, campusId: "campus-2", classId: "class-2", createdBy: "lecturer-1", activeCode: "333333" }));
  await assertFails(setDoc(doc(campusAdmin, "institutions/inst-1/sessions/session-campus-admin-campus-denied"), { ...validSession, campusId: "campus-2", classId: "class-2", createdBy: "campus-admin-1", activeCode: "444444" }));
  await assertFails(setDoc(doc(lecturer, "institutions/inst-1/attendance/session-forged_student-reader"), { sessionId: "session-forged", studentId: "student-reader", studentName: "Reader", studentNumber: "S-READ", classId: "class-1", status: "present", deviceId: "device-reader", code: "123456", location: new GeoPoint(0,0), accuracyMeters: 5, checkedAt: serverTimestamp() }));

  await assertSucceeds(setDoc(doc(owner, "institutions/inst-1/sessions/session-lecturer-close-test"), { ...validSession, createdBy: "owner-1", activeCode: "654321" }));
  await assertFails(updateDoc(doc(lecturer, "institutions/inst-1/sessions/session-lecturer-close-test"), { status: "closed", closedAt: Date.now(), closedBy: "lecturer-1" }));
  await assertSucceeds(setDoc(doc(lecturer, "institutions/inst-1/sessions/session-lecturer-owned-close-test"), { ...validSession, createdBy: "lecturer-1", activeCode: "765432" }));
  await assertFails(updateDoc(doc(campusAdmin, "institutions/inst-1/sessions/session-lecturer-owned-close-test"), { status: "closed", closedAt: Date.now(), closedBy: "campus-admin-1" }));
  await assertSucceeds(updateDoc(doc(lecturer, "institutions/inst-1/sessions/session-lecturer-owned-close-test"), { status: "closed", closedAt: Date.now(), closedBy: "lecturer-1" }));
  await assertSucceeds(updateDoc(doc(owner, "institutions/inst-1/sessions/session-valid"), { status: "closed", closedAt: Date.now(), closedBy: "owner-1" }));
  await assertFails(updateDoc(doc(owner, "institutions/inst-1/sessions/session-valid"), { title: "Tampered title", status: "closed", closedAt: Date.now(), closedBy: "owner-1" }));
  // Expired sessions: only the original session owner may create absence records.
  const expiredAt = Date.now() - 5000;
  const expiredSession = { ...validSession, status: "active", createdBy: "owner-1", openedAt: expiredAt - 45 * 60000, expiresAt: expiredAt, codeUpdatedAt: expiredAt - 45 * 60000, activeCode: "909090" };
  await assertSucceeds(setDoc(doc(owner, "institutions/inst-1/sessions/session-expired-absence"), expiredSession));
  const classAbsence = { sessionId: "session-expired-absence", studentId: "student-reader", studentName: "Reader", studentNumber: "S-READ", classId: "class-1", status: "absent", finalizedBy: "owner-1", finalizedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(owner, "institutions/inst-1/absences/session-expired-absence_student-reader"), classAbsence));
  await assertSucceeds(getDoc(doc(studentReader, "institutions/inst-1/absences/session-expired-absence_student-reader")));
  await assertFails(setDoc(doc(lecturer, "institutions/inst-1/absences/session-expired-absence_student-other"), { ...classAbsence, studentId: "student-other", finalizedBy: "lecturer-1" }));
  await assertFails(setDoc(doc(owner, "institutions/inst-1/absences/session-expired-absence_student-other-campus"), { ...classAbsence, studentId: "student-other-campus", finalizedBy: "owner-1" }));

  const expiredUnitSession = { ...expiredSession, courseUnitId: "cu-comm", academicYearId: "year-2026", semesterId: "semester-1", teachingGroupId: "", sessionGroupMode: "combined" };
  await assertSucceeds(setDoc(doc(owner, "institutions/inst-1/sessions/session-expired-unit-absence"), expiredUnitSession));
  const unitAbsence = { sessionId: "session-expired-unit-absence", studentId: "student-reader", studentName: "Reader", studentNumber: "S-READ", classId: "class-1", courseUnitId: "cu-comm", programmeId: "programme-it", academicYearId: "year-2026", semesterId: "semester-1", teachingGroupId: "", enrolmentId: "student-reader_cu-comm", status: "absent", finalizedBy: "owner-1", finalizedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(owner, "institutions/inst-1/absences/session-expired-unit-absence_student-reader"), unitAbsence));

  // Promote the lecturer only after verifying campus-scoped lecturer permissions.
  await assertSucceeds(updateDoc(doc(owner, "institutions/inst-1/members/lecturer-1"), { role: "institution_admin" }));

  const inviteRef = doc(owner, "invitations/student-new@example.test__inst-1");
  const invite = { name: "New Student", email: "student-new@example.test", contact: "+256700000001", institutionId: "inst-1", institutionCode: "IC-ABCD-2345", role: "student", assignedCampusId: "campus-1", classId: "class-1", className: "Class 1", studentNumber: "S-100", createdBy: "owner-1", createdByRole: "owner", status: "pending", createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(inviteRef, invite));
  await assertSucceeds(getDoc(doc(invitedStudent, "invitations/student-new@example.test__inst-1")));
  const registration = writeBatch(invitedStudent);
  registration.update(doc(invitedStudent, "invitations/student-new@example.test__inst-1"), { status: "accepted", acceptedUid: "student-new", acceptedAt: serverTimestamp() });
  const photoDataUrl = "data:image/jpeg;base64,AAAA";
  registration.set(doc(invitedStudent, "users/student-new"), { uid: "student-new", name: "New Student", email: "student-new@example.test", contact: "+256700000001", dateOfBirth: "2008-04-12", gender: "Female", photoDataUrl, institutionId: "inst-1", institutionCode: "IC-ABCD-2345", role: "student", status: "active", createdAt: serverTimestamp(), createdBy: "owner-1", assignedCampusId: "campus-1", classId: "class-1", studentNumber: "S-100", parentName: "Guardian", parentPhone: "+256700000002", registeredDeviceId: "device-token-123" });
  registration.set(doc(invitedStudent, "institutions/inst-1/members/student-new"), { uid: "student-new", name: "New Student", email: "student-new@example.test", contact: "+256700000001", dateOfBirth: "2008-04-12", gender: "Female", photoDataUrl, role: "student", status: "active", createdAt: serverTimestamp(), createdBy: "owner-1", assignedCampusId: "campus-1" });
  registration.set(doc(invitedStudent, "institutions/inst-1/students/student-new"), { name: "New Student", studentNumber: "S-100", classId: "class-1", campusId: "campus-1", authUid: "student-new", deviceId: "device-token-123", status: "active", contact: "+256700000001", parentName: "Guardian", parentPhone: "+256700000002", dateOfBirth: "2008-04-12", gender: "Female", photoDataUrl, createdAt: serverTimestamp(), createdBy: "owner-1" });
  await assertSucceeds(registration.commit());
  await assertSucceeds(getDoc(doc(invitedStudent, "institutions/inst-1/students/student-new")));

  // Attendance writes must be made by the learner account itself, with a fresh code and valid GPS accuracy.
  const checkinNow = Date.now();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, "institutions/inst-1/sessions/session-checkin-valid"), {
      status: "active", classId: "class-1", campusId: "campus-1",
      expiresAt: checkinNow + 60000, activeCode: "777777",
      codeUpdatedAt: checkinNow, requiresGps: false
    });
    await setDoc(doc(db, "institutions/inst-1/sessions/session-checkin-stale"), {
      status: "active", classId: "class-1", campusId: "campus-1",
      expiresAt: checkinNow + 60000, activeCode: "888888",
      codeUpdatedAt: checkinNow - 1806000, requiresGps: false
    });
  });
  const validAttendance = {
    sessionId: "session-checkin-valid", studentId: "student-reader",
    studentName: "Reader", studentNumber: "S-READ", classId: "class-1",
    status: "present", deviceId: "device-reader", code: "777777",
    location: new GeoPoint(0, 0), accuracyMeters: 5, checkedAt: serverTimestamp()
  };
  await assertSucceeds(setDoc(doc(studentReader, "institutions/inst-1/attendance/session-checkin-valid_student-reader"), validAttendance));
  await assertFails(setDoc(doc(studentReader, "institutions/inst-1/attendance/session-checkin-valid_student-reader"), validAttendance));
  await assertFails(setDoc(doc(studentReader, "institutions/inst-1/attendance/session-checkin-stale_student-reader"), {
    ...validAttendance, sessionId: "session-checkin-stale", code: "888888"
  }));
  await assertFails(setDoc(doc(studentReader, "institutions/inst-1/attendance/session-checkin-valid_student-other"), {
    ...validAttendance, studentId: "student-other", deviceId: "device-other"
  }));
  await assertFails(setDoc(doc(studentReader, "institutions/inst-1/attendance/session-checkin-invalid-accuracy_student-reader"), {
    ...validAttendance, sessionId: "session-checkin-valid", accuracyMeters: 101
  }));

  console.log("PASS: Firestore access control, role hierarchy, invitation acceptance and automatic learner UID/device binding");
} finally {
  await env.cleanup();
}
