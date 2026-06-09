import { supabase } from "@/integrations/supabase/client";
import type { MembershipDoc, MembershipStatus, RoleInSchool } from "./types";

function rowTo(m: Record<string, unknown>): MembershipDoc {
  return {
    id: m.id as string,
    schoolId: m.school_id as string,
    userId: m.user_id as string,
    roleInSchool: m.role_in_school as RoleInSchool,
    status: m.status as MembershipStatus,
    approvedBy: (m.approved_by as string | null) ?? undefined,
    createdAt: m.created_at ? new Date(m.created_at as string).getTime() : Date.now(),
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
    .upsert(
      {
        school_id: input.schoolId,
        user_id: input.userId,
        role_in_school: input.roleInSchool,
        status,
        approved_by: input.approvedBy ?? null,
      },
      { onConflict: "school_id,user_id,role_in_school" },
    )
    .select()
    .single();
  if (error) throw error;
  return rowTo(data as Record<string, unknown>);
}

export async function listMembershipsForUser(userId: string): Promise<MembershipDoc[]> {
  const { data } = await supabase.from("school_memberships").select("*").eq("user_id", userId);
  return (data ?? []).map((r) => rowTo(r as Record<string, unknown>));
}

export async function listMembershipsForSchool(schoolId: string): Promise<MembershipDoc[]> {
  const { data } = await supabase.from("school_memberships").select("*").eq("school_id", schoolId);
  return (data ?? []).map((r) => rowTo(r as Record<string, unknown>));
}

export async function setMembershipStatus(id: string, status: MembershipStatus, approvedBy?: string) {
  const { error } = await supabase
    .from("school_memberships")
    .update({ status, approved_by: approvedBy ?? null })
    .eq("id", id);
  if (error) throw error;
}
