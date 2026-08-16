export type GlobalRole = "master" | "user";
export type ProfileType = "teacher" | "school_admin" | "parent" | "pedagogical";
export type SchoolStatus = "active" | "pending" | "blocked" | "merged_into";
export type MembershipStatus = "pending" | "approved" | "rejected" | "blocked";
export type RoleInSchool = "school_admin" | "teacher" | "coordinator" | "master";

export interface UserDoc {
  id: string;
  name: string;
  email: string;
  photoUrl?: string | null;
  globalRole: GlobalRole;
  profileType?: ProfileType;
  onboardingComplete: boolean;
  active: boolean;
  gender?: "male" | "female" | "other" | null;
  createdAt: number;
  updatedAt: number;
}

export interface SchoolDoc {
  id: string;
  name: string;
  normalizedName: string;
  city?: string;
  state?: string;
  createdBy: string;
  status: SchoolStatus;
  mergedInto?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MembershipDoc {
  id: string;
  schoolId: string;
  userId: string;
  roleInSchool: RoleInSchool;
  status: MembershipStatus;
  approvedBy?: string;
  createdAt: number;
}
