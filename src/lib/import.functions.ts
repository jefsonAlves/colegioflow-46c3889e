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
  trimester?: number;
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
  class_id: string | null;
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

async function assertMaster(supabase: unknown, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
  const isMaster = (roles ?? []).some((r: { role: string }) => r.role === "master");
  if (!isMaster) throw new Error("Apenas o administrador master pode importar dados.");
}

type Classification = {
  toLink: Array<{
    external: ExternalStudent;
    existing: ExistingStudent;
    matchedBy: "matricula" | "external_id" | "name";
  }>;
  toCreate: ExternalStudent[];
};

function classifyStudents(payload: ExternalStudent[], existing: ExistingStudent[]): Classification {
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
    if (match && matchedBy) toLink.push({ external: s, existing: match, matchedBy });
    else toCreate.push(s);
  }
  return { toLink, toCreate };
}

function resolveStudentRef(
  ref: { student_external_id?: string; student_matricula?: string },
  existing: ExistingStudent[],
  newlyById: Map<string, string>,
): ExistingStudent | { id: string; class_id: string | null } | null {
  const findKey = (k?: string) => {
    if (!k) return null;
    const found = existing.find((e) => e.external_id === k || e.matricula === k);
    if (found) return found;
    if (newlyById.has(k)) {
      const id = newlyById.get(k)!;
      const created = existing.find((e) => e.id === id);
      if (created) return created;
    }
    return null;
  };
  return findKey(ref.student_external_id) ?? findKey(ref.student_matricula);
}

export const previewExternalData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => baseSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    const payload = await fetchExternal(data.baseUrl, data.apiKey);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const { data: existingRows } = await admin
      .from("students")
      .select("id, name, matricula, external_id, class_id")
      .eq("school_id", data.schoolId);
    const existing = (existingRows ?? []) as ExistingStudent[];

    const cls = classifyStudents(payload.students ?? [], existing);

    const studentKeysWillBeCreated = new Set(
      cls.toCreate.map((s) => s.external_id ?? s.matricula).filter(Boolean) as string[],
    );

    const evalRef = (r: { student_external_id?: string; student_matricula?: string }) => {
      const k = r.student_external_id ?? r.student_matricula;
      const found = resolveStudentRef(r, existing, new Map());
      return {
        resolved: !!found,
        willResolve: !found && !!k && studentKeysWillBeCreated.has(k),
        orphan: !found && !(k && studentKeysWillBeCreated.has(k)),
      };
    };
    const attRefs = (payload.attendance ?? []).map(evalRef);
    const grdRefs = (payload.grades ?? []).map(evalRef);

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
        willResolve: attRefs.filter((r) => r.willResolve).length,
        orphan: attRefs.filter((r) => r.orphan).length,
      },
      grades: {
        total: grdRefs.length,
        resolved: grdRefs.filter((r) => r.resolved).length,
        willResolve: grdRefs.filter((r) => r.willResolve).length,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    const { data: existingRows } = await admin
      .from("students")
      .select("id, name, matricula, external_id, class_id")
      .eq("school_id", data.schoolId);
    const existing = ((existingRows ?? []) as ExistingStudent[]).slice();

    const cls = classifyStudents(payload.students ?? [], existing);
    const newlyById = new Map<string, string>(); // key -> new student id
    const report = {
      students: { linked: 0, created: 0 },
      attendance: { inserted: 0, orphan: 0 },
      grades: { inserted: 0, orphan: 0 },
    };

    for (const link of cls.toLink) {
      const patch: Record<string, unknown> = {};
      if (link.external.matricula && !link.existing.matricula) patch.matricula = link.external.matricula;
      if (link.external.external_id && !link.existing.external_id) patch.external_id = link.external.external_id;
      if (data.classId && !link.existing.class_id) patch.class_id = data.classId;
      if (Object.keys(patch).length > 0) {
        await admin.from("students").update(patch).eq("id", link.existing.id);
      }
      report.students.linked++;
      const k = link.external.external_id || link.external.matricula;
      if (k) newlyById.set(k, link.existing.id);
    }

    for (const s of cls.toCreate) {
      const insertRow: Record<string, unknown> = {
        school_id: data.schoolId,
        class_id: data.classId ?? null,
        name: s.name,
        guardian_name: s.guardian_name ?? null,
        guardian_phone: s.guardian_phone ?? null,
        matricula: s.matricula ?? null,
        external_id: s.external_id ?? null,
        created_by: context.userId,
      };
      const { data: ins } = await admin
        .from("students")
        .insert(insertRow)
        .select("id, name, matricula, external_id, class_id")
        .single();
      if (ins) {
        existing.push(ins as ExistingStudent);
        report.students.created++;
        const k = s.external_id || s.matricula;
        if (k) newlyById.set(k, (ins as { id: string }).id);
      }
    }

    for (const a of payload.attendance ?? []) {
      const ref = resolveStudentRef(a, existing, newlyById);
      if (!ref || !ref.class_id) {
        report.attendance.orphan++;
        continue;
      }
      const row: Record<string, unknown> = {
        school_id: data.schoolId,
        class_id: ref.class_id,
        student_id: ref.id,
        date: a.date,
        present: a.present,
        external_id: a.external_id ?? null,
        recorded_by: context.userId,
      };
      await admin.from("attendance").insert(row);
      report.attendance.inserted++;
    }

    for (const g of payload.grades ?? []) {
      const ref = resolveStudentRef(g, existing, newlyById);
      if (!ref || !ref.class_id) {
        report.grades.orphan++;
        continue;
      }
      const row: Record<string, unknown> = {
        school_id: data.schoolId,
        class_id: ref.class_id,
        student_id: ref.id,
        subject: g.subject,
        value: g.value,
        trimester: g.trimester ?? 1,
        external_id: g.external_id ?? null,
        recorded_by: context.userId,
      };
      await admin.from("grades").insert(row);
      report.grades.inserted++;
    }

    return { ok: true, report };
  });
