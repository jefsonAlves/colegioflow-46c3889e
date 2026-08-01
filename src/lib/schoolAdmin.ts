import { supabase } from "@/integrations/supabase/client";
import { asPlanKey, asPlanStatus, type PlanKey, type PlanStatus } from "./plans";

export interface SchoolUsage {
  staffCount: number;
  adminCount: number;
  teacherCount: number;
  pendingCount: number;
  classCount: number;
  studentCount: number;
  plan: PlanKey;
  planStatus: PlanStatus;
  planExpiresAt: string | null;
  maxStaff: number;
  maxStudents: number;
}

export interface SchoolOverview extends SchoolUsage {
  schoolId: string;
  name: string;
  city: string | null;
  state: string | null;
  status: string;
  masterNotes: string | null;
  createdAt: number;
}

export interface StaffMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  roleInSchool: string;
  status: string;
  createdAt: number;
}

export async function getSchoolUsage(schoolId: string): Promise<SchoolUsage | null> {
  const { data, error } = await supabase.rpc("school_usage", { _school_id: schoolId });
  if (error) throw error;
  const row = (data ?? [])[0];
  if (!row) return null;
  return {
    staffCount: row.staff_count ?? 0,
    adminCount: row.admin_count ?? 0,
    teacherCount: row.teacher_count ?? 0,
    pendingCount: row.pending_count ?? 0,
    classCount: row.class_count ?? 0,
    studentCount: row.student_count ?? 0,
    plan: asPlanKey(row.plan),
    planStatus: asPlanStatus(row.plan_status),
    planExpiresAt: row.plan_expires_at ?? null,
    maxStaff: row.max_staff ?? 0,
    maxStudents: row.max_students ?? 0,
  };
}

export async function listSchoolStaff(schoolId: string): Promise<StaffMember[]> {
  const { data, error } = await supabase.rpc("school_staff", { _school_id: schoolId });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    membershipId: r.membership_id,
    userId: r.user_id,
    name: r.name ?? "",
    email: r.email ?? "",
    roleInSchool: r.role_in_school,
    status: r.status,
    createdAt: new Date(r.created_at).getTime(),
  }));
}

export async function listMasterSchoolsOverview(): Promise<SchoolOverview[]> {
  const { data, error } = await supabase.rpc("master_schools_overview");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    schoolId: r.school_id,
    name: r.name,
    city: r.city ?? null,
    state: r.state ?? null,
    status: r.status,
    masterNotes: r.master_notes ?? null,
    createdAt: new Date(r.created_at).getTime(),
    staffCount: r.staff_count ?? 0,
    adminCount: r.admin_count ?? 0,
    teacherCount: r.teacher_count ?? 0,
    pendingCount: r.pending_count ?? 0,
    classCount: r.class_count ?? 0,
    studentCount: r.student_count ?? 0,
    plan: asPlanKey(r.plan),
    planStatus: asPlanStatus(r.plan_status),
    planExpiresAt: r.plan_expires_at ?? null,
    maxStaff: r.max_staff ?? 0,
    maxStudents: r.max_students ?? 0,
  }));
}

export async function setSchoolPlan(input: {
  schoolId: string;
  plan: PlanKey;
  planStatus: PlanStatus;
  planExpiresAt: string | null;
  maxStaff: number;
  maxStudents: number;
  masterNotes: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("master_set_school_plan", {
    _school_id: input.schoolId,
    _plan: input.plan,
    _plan_status: input.planStatus,
    _plan_expires_at: input.planExpiresAt,
    _max_staff: input.maxStaff,
    _max_students: input.maxStudents,
    _master_notes: input.masterNotes,
  });
  if (error) throw error;
}
