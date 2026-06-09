import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const importSchema = z.object({
  schoolId: z.string().uuid(),
  classId: z.string().uuid().optional(),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1).max(2048),
  dryRun: z.boolean().default(true),
});

type ExternalStudent = {
  external_id?: string;
  name: string;
  guardian_name?: string;
  guardian_phone?: string;
};
type ExternalAttendance = {
  external_id?: string;
  student_external_id: string;
  date: string; // YYYY-MM-DD
  present: boolean;
};
type ExternalGrade = {
  external_id?: string;
  student_external_id: string;
  subject: string;
  value: number;
  period?: string;
};
type ExternalPayload = {
  students?: ExternalStudent[];
  attendance?: ExternalAttendance[];
  grades?: ExternalGrade[];
};

async function fetchExternal(baseUrl: string, apiKey: string): Promise<ExternalPayload> {
  const res = await fetch(baseUrl, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`External fetch failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as ExternalPayload;
}

export const importExternalData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => importSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Only master can import
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isMaster = (roles ?? []).some((r) => r.role === "master");
    if (!isMaster) throw new Error("Apenas o administrador master pode importar dados.");

    const payload = await fetchExternal(data.baseUrl, data.apiKey);
    const report = {
      students: { found: 0, created: 0, updated: 0 },
      attendance: { found: 0, upserted: 0 },
      grades: { found: 0, upserted: 0 },
      sample: { students: payload.students?.slice(0, 3) ?? [] },
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Students
    if (payload.students?.length) {
      report.students.found = payload.students.length;
      if (!data.dryRun) {
        for (const s of payload.students) {
          if (s.external_id) {
            const { data: existing } = await supabaseAdmin
              .from("students")
              .select("id")
              .eq("school_id", data.schoolId)
              .eq("external_id", s.external_id)
              .maybeSingle();
            if (existing) {
              await supabaseAdmin
                .from("students")
                .update({
                  name: s.name,
                  guardian_name: s.guardian_name ?? null,
                  guardian_phone: s.guardian_phone ?? null,
                  class_id: data.classId ?? null,
                })
                .eq("id", existing.id);
              report.students.updated++;
            } else {
              await supabaseAdmin.from("students").insert({
                school_id: data.schoolId,
                class_id: data.classId ?? null,
                name: s.name,
                guardian_name: s.guardian_name ?? null,
                guardian_phone: s.guardian_phone ?? null,
                external_id: s.external_id,
                created_by: userId,
              });
              report.students.created++;
            }
          } else {
            await supabaseAdmin.from("students").insert({
              school_id: data.schoolId,
              class_id: data.classId ?? null,
              name: s.name,
              guardian_name: s.guardian_name ?? null,
              guardian_phone: s.guardian_phone ?? null,
              created_by: userId,
            });
            report.students.created++;
          }
        }
      }
    }

    if (payload.attendance?.length) report.attendance.found = payload.attendance.length;
    if (payload.grades?.length) report.grades.found = payload.grades.length;

    return { ok: true, dryRun: data.dryRun, report };
  });
