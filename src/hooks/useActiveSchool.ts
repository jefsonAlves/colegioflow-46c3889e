import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { listMembershipsForUser } from "@/lib/memberships";
import { getSchool } from "@/lib/schools";
import type { MembershipDoc, SchoolDoc } from "@/lib/types";

export interface ActiveSchool {
  schoolId: string | null;
  school: SchoolDoc | null;
  membership: MembershipDoc | null;
  approvedSchools: { school: SchoolDoc; membership: MembershipDoc }[];
  pendingSchools: { membership: MembershipDoc; schoolId: string }[];
  isLoading: boolean;
  setActive: (schoolId: string) => void;
  refresh: () => void;
}

export function useActiveSchool(): ActiveSchool {
  const { firebaseUser } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("activeSchool") : null,
  );

  const memQ = useQuery({
    queryKey: ["memberships", firebaseUser?.uid],
    queryFn: () => listMembershipsForUser(firebaseUser!.uid),
    enabled: !!firebaseUser,
  });

  const approved = (memQ.data ?? []).filter((m) => m.status === "approved");
  const pending = (memQ.data ?? []).filter((m) => m.status === "pending");

  const schoolsQ = useQuery({
    queryKey: ["schools-of-user", approved.map((m) => m.schoolId).join(",")],
    queryFn: async () => {
      const list = await Promise.all(approved.map((m) => getSchool(m.schoolId)));
      return list
        .map((s, i) => (s ? { school: s, membership: approved[i] } : null))
        .filter(Boolean) as { school: SchoolDoc; membership: MembershipDoc }[];
    },
    enabled: approved.length > 0,
  });

  useEffect(() => {
    // Auto-select first approved if no active set yet
    if (!activeId && (schoolsQ.data?.length ?? 0) > 0) {
      const first = schoolsQ.data![0].school.id;
      setActiveId(first);
      localStorage.setItem("activeSchool", first);
    }
  }, [activeId, schoolsQ.data]);

  const current = (schoolsQ.data ?? []).find((x) => x.school.id === activeId) ?? null;

  return {
    schoolId: activeId,
    school: current?.school ?? null,
    membership: current?.membership ?? null,
    approvedSchools: schoolsQ.data ?? [],
    pendingSchools: pending.map((m) => ({ membership: m, schoolId: m.schoolId })),
    isLoading: memQ.isLoading || schoolsQ.isLoading,
    setActive: (id: string) => {
      setActiveId(id);
      localStorage.setItem("activeSchool", id);
    },
    refresh: () => {
      memQ.refetch();
      schoolsQ.refetch();
    },
  };
}
