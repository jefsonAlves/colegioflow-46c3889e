import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import type { MembershipDoc, MembershipStatus, RoleInSchool } from "./types";

const COLL = collection(db, "school_memberships");

export async function requestMembership(input: {
  schoolId: string;
  userId: string;
  roleInSchool: RoleInSchool;
  autoApprove?: boolean;
  approvedBy?: string;
}): Promise<MembershipDoc> {
  const status: MembershipStatus = input.autoApprove ? "approved" : "pending";
  const payload = {
    schoolId: input.schoolId,
    userId: input.userId,
    roleInSchool: input.roleInSchool,
    status,
    approvedBy: input.approvedBy ?? null,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(COLL, payload);
  return {
    id: ref.id,
    schoolId: input.schoolId,
    userId: input.userId,
    roleInSchool: input.roleInSchool,
    status,
    approvedBy: input.approvedBy,
    createdAt: Date.now(),
  };
}

export async function listMembershipsForUser(userId: string): Promise<MembershipDoc[]> {
  const snap = await getDocs(query(COLL, where("userId", "==", userId), limit(100)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MembershipDoc, "id">) }));
}

export async function listMembershipsForSchool(schoolId: string): Promise<MembershipDoc[]> {
  const snap = await getDocs(query(COLL, where("schoolId", "==", schoolId), limit(200)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MembershipDoc, "id">) }));
}

export async function setMembershipStatus(
  id: string,
  status: MembershipStatus,
  approvedBy?: string,
) {
  await updateDoc(doc(db, "school_memberships", id), {
    status,
    approvedBy: approvedBy ?? null,
    updatedAt: serverTimestamp(),
  });
}
