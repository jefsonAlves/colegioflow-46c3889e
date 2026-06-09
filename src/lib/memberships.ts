import { supabase } from "@/integrations/supabase/client";
import type { MembershipDoc, MembershipStatus, RoleInSchool } from "./types";

type Row = {
  id: string;
  school_id: string;
  user_id: string;
  role_in_school: RoleInSchool;
  status: MembershipStatus;
  approved_by: string | null;
  created_at: string;
};

function rowToDoc(r: Row): MembershipDoc {
  return {
    id: r.id,
    schoolId: r.school_id,
    userId: r.user_id,
    roleInSchool: r.role_in_school,
    status: r.status,
    approvedBy: r.approved_by ?? undefined,
    createdAt: new Date(r.created_at).getTime(),
  };
}

export async function requestMembership(input: {
  schoolId: string;
  userId: string;
  roleInSchool: RoleInSchool;
  autoApprove?: boolean;
  approvedBy?: string;
}): Promise<MembershipDoc> {
  const status: MembershipStatus = input.autoApprove ? "approved" : "pending";
  const { data, error } = await supabase
    .from("school_memberships")
    .insert({
      school_id: input.schoolId,
      user_id: input.userId,
      role_in_school: input.roleInSchool,
      status,
      approved_by: input.approvedBy ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToDoc(data as Row);
}

export async function listMembershipsForUser(userId: string): Promise<MembershipDoc[]> {
  const { data, error } = await supabase.from("school_memberships").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => rowToDoc(r as Row));
}

export async function listMembershipsForSchool(schoolId: string): Promise<MembershipDoc[]> {
  const { data, error } = await supabase.from("school_memberships").select("*").eq("school_id", schoolId);
  if (error) throw error;
  return (data ?? []).map((r) => rowToDoc(r as Row));
}

export async function setMembershipStatus(
  id: string,
  status: MembershipStatus,
  approvedBy?: string,
) {
  const { error } = await supabase
    .from("school_memberships")
    .update({ status, approved_by: approvedBy ?? null })
    .eq("id", id);
  if (error) throw error;
}
