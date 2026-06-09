import { get, push, ref, set, update } from "firebase/database";
import { rtdb } from "@/integrations/firebase/client";
import type { MembershipDoc, MembershipStatus, RoleInSchool } from "./types";

const ROOT = "school_memberships";

export async function requestMembership(input: {
  schoolId: string;
  userId: string;
  roleInSchool: RoleInSchool;
  autoApprove?: boolean;
  approvedBy?: string;
}): Promise<MembershipDoc> {
  const status: MembershipStatus = input.autoApprove ? "approved" : "pending";
  const now = Date.now();
  const newRef = push(ref(rtdb, ROOT));
  const payload = {
    schoolId: input.schoolId,
    userId: input.userId,
    roleInSchool: input.roleInSchool,
    status,
    approvedBy: input.approvedBy ?? null,
    createdAt: now,
  };
  await set(newRef, payload);
  return {
    id: newRef.key as string,
    schoolId: input.schoolId,
    userId: input.userId,
    roleInSchool: input.roleInSchool,
    status,
    approvedBy: input.approvedBy,
    createdAt: now,
  };
}

export async function listMembershipsForUser(userId: string): Promise<MembershipDoc[]> {
  const snap = await get(ref(rtdb, ROOT));
  if (!snap.exists()) return [];
  const out: MembershipDoc[] = [];
  snap.forEach((c) => {
    const v = c.val() as Omit<MembershipDoc, "id">;
    if (v?.userId === userId) out.push({ id: c.key as string, ...v });
  });
  return out;
}

export async function listMembershipsForSchool(schoolId: string): Promise<MembershipDoc[]> {
  const snap = await get(ref(rtdb, ROOT));
  if (!snap.exists()) return [];
  const out: MembershipDoc[] = [];
  snap.forEach((c) => {
    const v = c.val() as Omit<MembershipDoc, "id">;
    if (v?.schoolId === schoolId) out.push({ id: c.key as string, ...v });
  });
  return out;
}

export async function setMembershipStatus(
  id: string,
  status: MembershipStatus,
  approvedBy?: string,
) {
  await update(ref(rtdb, `${ROOT}/${id}`), {
    status,
    approvedBy: approvedBy ?? null,
    updatedAt: Date.now(),
  });
}
