import { useQuery } from "@tanstack/react-query";
import { PlanUsageCard } from "@/components/PlanUsageCard";
import { getSchoolUsage } from "@/lib/schoolAdmin";

/**
 * Plan + usage snapshot for a school. Renders nothing while loading or when the
 * caller has no access to the school's usage data.
 */
export function SchoolUsageSummary({ schoolId, compact = false }: { schoolId: string; compact?: boolean }) {
  const usageQ = useQuery({
    queryKey: ["school-usage", schoolId],
    queryFn: () => getSchoolUsage(schoolId),
    staleTime: 60_000,
  });

  const u = usageQ.data;
  if (!u) return null;

  return (
    <PlanUsageCard
      plan={u.plan}
      planStatus={u.planStatus}
      planExpiresAt={u.planExpiresAt}
      staffCount={u.staffCount}
      maxStaff={u.maxStaff}
      studentCount={u.studentCount}
      maxStudents={u.maxStudents}
      classCount={u.classCount}
      pendingCount={u.pendingCount}
      compact={compact}
    />
  );
}
