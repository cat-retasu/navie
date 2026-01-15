// lib/setUserRole.ts

import { db } from "@/lib/firebase";
import { doc, writeBatch, serverTimestamp } from "firebase/firestore";

export type UserRole = "pending" | "user" | "rejected" | "admin" | "suspended";
export type ProfileStatus = "pending" | "approved" | "rejected" | "suspended";

const roleToStatus = (role: UserRole): ProfileStatus => {
  switch (role) {
    case "pending":
      return "pending";
    case "rejected":
      return "rejected";
    case "suspended":
      return "suspended";
    case "user":
    case "admin":
    default:
      return "approved";
  }
};

export async function setUserRole(userId: string, role: UserRole) {
  const status = roleToStatus(role);

  const batch = writeBatch(db);
  batch.update(doc(db, "users", userId), {
    role,
    updatedAt: serverTimestamp(),
  });
  batch.set(
    doc(db, "profiles", userId),
    { status, updatedAt: serverTimestamp() },
    { merge: true }
  );

  await batch.commit();
}