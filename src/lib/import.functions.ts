import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const baseSchema = z.object({
  schoolId: z.string().uuid(),
  classId: z.string().uuid().optional(),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1).max(2048),
});

type ExternalStudent = {
  external_id?: string;
  matricula?: string;
  name: string;
  guardian_name?: string;
  guardian_phone?: string;
};
type ExternalAttendance = {
  external_id?: string;
  student_external_id?: string;
  student_matricula?: string;
  date: string;
  present: boolean;
};
type ExternalGrade = {
  external_id?: string;
  student_external_id?: string;
  student_matricula?: string;
  subject: string;
  value: number;
  period?: string;
};
type ExternalPayload = {
  students?: ExternalStudent[];
  attendance?: ExternalAttendance[];
  grades?: ExternalGrade[];
};

type ExistingStudent = {
  id: string;
  name: string;
  matricula: string | null;
  external_id: string | null;
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

async function fetchExternal(baseUrl: string, apiKey: string): Promise<ExternalPayload> {
  const res = await fetch(baseUrl, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Falha ao buscar dados externos: ${res.status} ${res.statusText}`);
  return (await res.json()) as ExternalPayload;
}

async function assertMaster(supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>, userId: string) {
  const { data: roles } = await (supabase as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isMaster = (roles ?? []).some((r: { role: string }) => r.role === "master");
  if (!isMaster) throw new Error("Apenas o administrador master pode importar dados.");
}

type Classification = {
  toLink: Array<{ external: ExternalStudent; existing: ExistingStudent; matchedBy: "matricula" | "external_id" | "name" }>;
  toCreate: ExternalStudent[];
  resolveById: Map<string, ExistingStudent | null>; // key = external_id || matricula || name
};

function classifyStudents(
  payload: ExternalStudent[],
  existing: ExistingStudent[],
): Classification {
  const byMatricula = new Map<string, ExistingStudent>();
  const byExternal = new Map<string, ExistingStudent>();
  const byName = new Map<string, ExistingStudent>();
  for (const e of existing) {
    if (e.matricula) byMatricula.set(e.matricula, e);
    if (e.external_id) byExternal.set(e.external_id, e);
    byName.set(norm(e.name), e);
  }
  const toLink: Classification["toLink"] = [];
  const toCreate: ExternalStudent[] = [];
  const resolveById = new Map<string, ExistingStudent | null>();
  for (const s of payload) {
    let match: ExistingStudent | undefined;
    let matchedBy: "matricula" | "external_id" | "name" | undefined;
    if (s.matricula && byMatricula.has(s.matricula)) {
      match = byMatricula.get(s.matricula);
      matchedBy = "matricula";
    } else if (s.external_id && byExternal.has(s.external_id)) {
      match = byExternal.get(s.external_id);
      matchedBy = "external_id";
    } else if (byName.has(norm(s.name))) {
      match = byName.get(norm(s.name));
      matchedBy = "name";
    }
    const key = s.external_id || s.matricula || norm(s.name);
    if (match && matchedBy) {
      toLink.push({ external: s, existing: match, matchedBy });
      resolveById.set(key, match);
    } else {
      toCreate.push(s);
      resolveById.set(key, null);
    }
  }
  return { toLink, toCreate, resolveById };
}

function resolveStudentRef(
  ref: { student_external_id?: string; student_matricula?: string },
  existing: ExistingStudent[],
  newlyKeyed: Map<string, string>, // key -> new student id (filled after insert; empty in dry-run)
): { id: string | null; key: string | null } {
  if (ref.student_external_id) {
    const found = existing.find((e) => e.external_id === ref.student_external_id);
    if (found) return { id: found.id, key: ref.student_external_id };
    if (newlyKeyed.has(ref.student_external_id))
      return { id: newlyKeyed.get(ref.student_external_id)!, key: ref.student_external_id };
    return { id: null, key: ref.student_external_id };
  }
  if (ref.student_matricula) {
    const found = existing.find((e) => e.matricula === ref.student_matricula);
    if (found) return { id: found.id, key: ref.student_matricula };
    if (newlyKeyed.has(ref.student_matricula))
      return { id: newlyKeyed.get(ref.student_matricula)!, key: ref.student_matricula };
    return { id: null, key: ref.student_matricula };
  }
  return { id: null, key: null };
}

export const previewExternalData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => baseSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    const payload = await fetchExternal(data.baseUrl, data.apiKey);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingRows } = await supabaseAdmin
      .from("students")
      .select("id, name, matricula, external_id")
      .eq("school_id", data.schoolId);
    const existing = (existingRows ?? []) as ExistingStudent[];

    const cls = classifyStudents(payload.students ?? [], existing);

    const attRefs = (payload.attendance ?? []).map((a) => {
      const r = resolveStudentRef(a, existing, new Map());
      // For preview, also consider students that WILL be created (matching by external_id/matricula)
      const willCreate = !r.id && r.key
        ? cls.toCreate.some((s) => (s.external_id ?? s.matricula) === r.key)
        : false;
      return { resolved: !!r.id, willCreate, orphan: !r.id && !willCreate };
    });
    const grdRefs = (payload.grades ?? []).map((g) => {
      const r = resolveStudentRef(g, existing, new Map());
      const willCreate = !r.id && r.key
        ? cls.toCreate.some((s) => (s.external_id ?? s.matricula) === r.key)
        : false;
      return { resolved: !!r.id, willCreate, orphan: !r.id && !willCreate };
    });

    return {
      students: {
        toLink: cls.toLink.map((l) => ({
          payloadName: l.external.name,
          payloadMatricula: l.external.matricula ?? null,
          existingName: l.existing.name,
          matchedBy: l.matchedBy,
        })),
        toCreate: cls.toCreate.map((s) => ({ name: s.name, matricula: s.matricula ?? null })),
      },
      attendance: {
        total: attRefs.length,
        resolved: attRefs.filter((r) => r.resolved).length,
        willResolve: attRefs.filter((r) => r.willCreate).length,
        orphan: attRefs.filter((r) => r.orphan).length,
      },
      grades: {
        total: grdRefs.length,
        resolved: grdRefs.filter((r) => r.resolved).length,
        willResolve: grdRefs.filter((r) => r.willCreate).length,
        orphan: grdRefs.filter((r) => r.orphan).length,
      },
    };
  });

export const importExternalData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => baseSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    const payload = await fetchExternal(data.baseUrl, data.apiKey);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existingRows } = await supabaseAdmin
      .from("students")
      .select("id, name, matricula, external_id")
      .eq("school_id", data.schoolId);
    let existing = ((existingRows ?? []) as ExistingStudent[]).slice();

    const cls = classifyStudents(payload.students ?? [], existing);
    const newlyKeyed = new Map<string, string>();
    const report = {
      students: { linked: 0, created: 0 },
      attendance: { inserted: 0, orphan: 0 },
      grades: { inserted: 0, orphan: 0 },
    };

    // Link existing: fill missing matricula/external_id, set class_id if not set
    for (const link of cls.toLink) {
      const patch: Record<string, unknown> = {};
      if (link.external.matricula && !link.existing.matricula) patch.matricula = link.external.matricula;
      if (link.external.external_id && !link.existing.external_id) patch.external_id = link.external.external_id;
      if (data.classId) patch.class_id = data.classId;
      if (Object.keys(patch).length > 0) {
        await supabaseAdmin.from("students").update(patch).eq("id", link.existing.id);
      }
      report.students.linked++;
      const key = link.external.external_id || link.external.matricula;
      if (key) newlyKeyed.set(key, link.existing.id);
    }

    // Create new
    for (const s of cls.toCreate) {
      const { data: ins } = await supabaseAdmin
        .from("students")
        .insert({
          school_id: data.schoolId,
          class_id: data.classId ?? null,
          name: s.name,
          guardian_name: s.guardian_name ?? null,
          guardian_phone: s.guardian_phone ?? null,
          matricula: s.matricula ?? null,
          external_id: s.external_id ?? null,
          created_by: context.userId,
        })
        .select("id, name, matricula, external_id")
        .single();
      if (ins) {
        existing.push(ins as ExistingStudent);
        report.students.created++;
        const key = s.external_id || s.matricula;
        if (key) newlyKeyed.set(key, (ins as { id: string }).id);
      }
    }

    // Attendance
    for (const a of payload.attendance ?? []) {
      const r = resolveStudentRef(a, existing, newlyKeyed);
      if (!r.id) {
        report.attendance.orphan++;
        continue;
      }
      await supabaseAdmin.from("attendance").insert({
        school_id: data.schoolId,
        student_id: r.id,
        date: a.date,
        present: a.present,
        external_id: a.external_id ?? null,
        created_by: context.userId,
      });
      report.attendance.inserted++;
    }

    // Grades
    for (const g of payload.grades ?? []) {
      const r = resolveStudentRef(g, existing, newlyKeyed);
      if (!r.id) {
        report.grades.orphan++;
        continue;
      }
      await supabaseAdmin.from("grades").insert({
        school_id: data.schoolId,
        student_id: r.id,
        subject: g.subject,
        value: g.value,
        period: g.period ?? null,
        external_id: g.external_id ?? null,
        created_by: context.userId,
      });
      report.grades.inserted++;
    }

    return { ok: true, report };
  });
