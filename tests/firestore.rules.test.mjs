import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { strict as assert } from "node:assert";

const projectId = "demo-intercampus";
const rules = await readFile("firestore.rules", "utf8");
const env = await initializeTestEnvironment({ projectId, firestore: { rules } });
const owner = env.authenticatedContext("owner-1").firestore();
const lecturer = env.authenticatedContext("lecturer-1").firestore();
const outsider = env.authenticatedContext("outsider-1").firestore();
const unauth = env.unauthenticatedContext().firestore();

try {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/owner-1"), { uid: "owner-1", name: "Owner", email: "owner@example.test", institutionId: "inst-1", role: "owner", status: "active", createdAt: new Date() });
    await setDoc(doc(db, "institutions/inst-1"), { name: "Test Institution", type: "College", country: "Uganda", timezone: "Africa/Kampala", ownerId: "owner-1", status: "pilot", createdAt: new Date(), createdBy: "owner-1" });
    await setDoc(doc(db, "institutions/inst-1/members/owner-1"), { uid: "owner-1", name: "Owner", email: "owner@example.test", role: "owner", status: "active", createdAt: new Date() });
    await setDoc(doc(db, "users/lecturer-1"), { uid: "lecturer-1", name: "Lecturer", email: "lecturer@example.test", institutionId: "inst-1", role: "lecturer", status: "active", createdAt: new Date() });
    await setDoc(doc(db, "institutions/inst-1/members/lecturer-1"), { uid: "lecturer-1", name: "Lecturer", email: "lecturer@example.test", role: "lecturer", status: "active", createdAt: new Date() });
    await setDoc(doc(db, "users/outsider-1"), { uid: "outsider-1", name: "Outsider", email: "outsider@example.test", institutionId: "inst-2", role: "owner", status: "active", createdAt: new Date() });
    await setDoc(doc(db, "institutions/inst-2"), { name: "Other Institution", ownerId: "outsider-1", status: "pilot" });
    await setDoc(doc(db, "institutions/inst-2/members/outsider-1"), { uid: "outsider-1", role: "owner", status: "active" });
    await setDoc(doc(db, "institutions/inst-1/classes/class-1"), { name: "Class 1", code: "C1", campusId: "campus-1", createdAt: new Date(), createdBy: "owner-1" });
  });

  await assertSucceeds(getDoc(doc(owner, "institutions/inst-1")));
  await assertFails(getDoc(doc(unauth, "institutions/inst-1")));
  await assertFails(getDoc(doc(outsider, "institutions/inst-1")));
  await assertFails(setDoc(doc(owner, "institutions/inst-1/attendance/forged"), { studentId: "x", present: true }));

  const now = Date.now();
  const validSession = { title: "Morning class", classId: "class-1", status: "active", durationMinutes: 45, requiresGps: true, createdAt: serverTimestamp(), createdBy: "owner-1", openedAt: now, expiresAt: now + 45 * 60000, activeCode: "123456", codeUpdatedAt: now, codeVersion: 1 };
  await assertSucceeds(setDoc(doc(owner, "institutions/inst-1/sessions/session-valid"), validSession));
  await assertFails(setDoc(doc(owner, "institutions/inst-1/sessions/session-bad-code"), { ...validSession, activeCode: "123" }));
  await assertFails(setDoc(doc(owner, "institutions/inst-1/sessions/session-extra-field"), { ...validSession, unapproved: true }));
  await assertFails(setDoc(doc(outsider, "institutions/inst-1/sessions/session-cross-tenant"), { ...validSession, createdBy: "outsider-1" }));

  await assertSucceeds(setDoc(doc(owner, "institutions/inst-1/sessions/session-lecturer-close-test"), { ...validSession, createdBy: "owner-1", activeCode: "654321" }));
  await assertFails(updateDoc(doc(lecturer, "institutions/inst-1/sessions/session-lecturer-close-test"), { status: "closed", closedAt: Date.now(), closedBy: "lecturer-1" }));
  await assertSucceeds(updateDoc(doc(owner, "institutions/inst-1/sessions/session-valid"), { status: "closed", closedAt: Date.now(), closedBy: "owner-1" }));
  await assertFails(updateDoc(doc(owner, "institutions/inst-1/sessions/session-valid"), { title: "Tampered title", status: "closed", closedAt: Date.now(), closedBy: "owner-1" }));

  console.log("PASS: 11 Firestore access-control assertions");
} finally {
  await env.cleanup();
}
