import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const runSchema = z.object({
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

type RunInput = {
  schoolId: string;
  classId?: string;
  baseUrl: string;
  apiKey: string;
};

async function corePreview(input: RunInput) {
  const payload = await fetchExternal(input.baseUrl, input.apiKey);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabaseAdmin as any;
  const { data: existingRows } = await admin
    .from("students")
    .select("id, name, matricula, external_id, class_id")
    .eq("school_id", input.schoolId);
  const existing = (existingRows ?? []) as ExistingStudent[];
  const cls = classifyStudents(payload.students ?? [], existing);
  const willCreate = new Set(
    cls.toCreate.map((s) => s.external_id ?? s.matricula).filter(Boolean) as string[],
  );
  const evalRef = (r: { student_external_id?: string; student_matricula?: string }) => {
    const k = r.student_external_id ?? r.student_matricula;
    const found = resolveStudentRef(r, existing, new Map());
    return {
      resolved: !!found,
      willResolve: !found && !!k && willCreate.has(k),
      orphan: !found && !(k && willCreate.has(k)),
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
}

async function coreImport(input: RunInput, userId: string) {
  const payload = await fetchExternal(input.baseUrl, input.apiKey);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabaseAdmin as any;

  const { data: existingRows } = await admin
    .from("students")
    .select("id, name, matricula, external_id, class_id")
    .eq("school_id", input.schoolId);
  const existing = ((existingRows ?? []) as ExistingStudent[]).slice();

  const cls = classifyStudents(payload.students ?? [], existing);
  const newlyById = new Map<string, string>();
  const report = {
    students: { linked: 0, created: 0 },
    attendance: { inserted: 0, orphan: 0 },
    grades: { inserted: 0, orphan: 0 },
  };

  for (const link of cls.toLink) {
    const patch: Record<string, unknown> = {};
    if (link.external.matricula && !link.existing.matricula) patch.matricula = link.external.matricula;
    if (link.external.external_id && !link.existing.external_id)
      patch.external_id = link.external.external_id;
    if (input.classId && !link.existing.class_id) patch.class_id = input.classId;
    if (Object.keys(patch).length > 0) {
      await admin.from("students").update(patch).eq("id", link.existing.id);
    }
    report.students.linked++;
    const k = link.external.external_id || link.external.matricula;
    if (k) newlyById.set(k, link.existing.id);
  }

  for (const s of cls.toCreate) {
    const insertRow: Record<string, unknown> = {
      school_id: input.schoolId,
      class_id: input.classId ?? null,
      name: s.name,
      guardian_name: s.guardian_name ?? null,
      guardian_phone: s.guardian_phone ?? null,
      matricula: s.matricula ?? null,
      external_id: s.external_id ?? null,
      created_by: userId,
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
    await admin.from("attendance").insert({
      school_id: input.schoolId,
      class_id: ref.class_id,
      student_id: ref.id,
      date: a.date,
      present: a.present,
      external_id: a.external_id ?? null,
      recorded_by: userId,
    });
    report.attendance.inserted++;
  }

  for (const g of payload.grades ?? []) {
    const ref = resolveStudentRef(g, existing, newlyById);
    if (!ref || !ref.class_id) {
      report.grades.orphan++;
      continue;
    }
    await admin.from("grades").insert({
      school_id: input.schoolId,
      class_id: ref.class_id,
      student_id: ref.id,
      subject: g.subject,
      value: g.value,
      trimester: g.trimester ?? 1,
      external_id: g.external_id ?? null,
      recorded_by: userId,
    });
    report.grades.inserted++;
  }

  return { ok: true, report };
}

// --- Volatile (digited each time) server fns: kept for backward compat ---

export const previewExternalData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => runSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    return corePreview(data);
  });

export const importExternalData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => runSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    return coreImport(data, context.userId);
  });

// --- Saved import sources ---

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(120),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1).max(2048).optional(),
  schoolId: z.string().uuid(),
  classId: z.string().uuid().nullable().optional(),
});

const idSchema = z.object({ id: z.string().uuid() });

export type ImportSourceRow = {
  id: string;
  label: string;
  baseUrl: string;
  schoolId: string;
  classId: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  createdAt: string;
};

export const listImportSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImportSourceRow[]> => {
    await assertMaster(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const { data, error } = await admin
      .from("import_sources")
      .select("id, label, base_url, school_id, class_id, last_run_at, last_status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      label: r.label as string,
      baseUrl: r.base_url as string,
      schoolId: r.school_id as string,
      classId: (r.class_id as string | null) ?? null,
      lastRunAt: (r.last_run_at as string | null) ?? null,
      lastStatus: (r.last_status as string | null) ?? null,
      createdAt: r.created_at as string,
    }));
  });

export const upsertImportSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptApiKey } = await import("@/lib/importCrypto.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    if (data.id) {
      const patch: Record<string, unknown> = {
        label: data.label,
        base_url: data.baseUrl,
        school_id: data.schoolId,
        class_id: data.classId ?? null,
      };
      if (data.apiKey) patch.api_key_encrypted = encryptApiKey(data.apiKey);
      const { error } = await admin.from("import_sources").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    if (!data.apiKey) throw new Error("API key é obrigatória ao criar uma fonte.");
    const { data: ins, error } = await admin
      .from("import_sources")
      .insert({
        label: data.label,
        base_url: data.baseUrl,
        api_key_encrypted: encryptApiKey(data.apiKey),
        school_id: data.schoolId,
        class_id: data.classId ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (ins as { id: string }).id };
  });

export const deleteImportSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;
    const { error } = await admin.from("import_sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function loadSource(id: string): Promise<RunInput> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptApiKey } = await import("@/lib/importCrypto.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabaseAdmin as any;
  const { data, error } = await admin
    .from("import_sources")
    .select("base_url, api_key_encrypted, school_id, class_id")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("Fonte não encontrada.");
  return {
    baseUrl: data.base_url as string,
    apiKey: decryptApiKey(data.api_key_encrypted as string),
    schoolId: data.school_id as string,
    classId: (data.class_id as string | null) ?? undefined,
  };
}

async function markRun(id: string, status: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabaseAdmin as any;
  await admin
    .from("import_sources")
    .update({ last_run_at: new Date().toISOString(), last_status: status })
    .eq("id", id);
}

export const previewImportSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    const src = await loadSource(data.id);
    try {
      const res = await corePreview(src);
      await markRun(data.id, "preview ok");
      return res;
    } catch (e) {
      await markRun(data.id, `preview erro: ${(e as Error).message}`.slice(0, 200));
      throw e;
    }
  });

export const runImportSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    const src = await loadSource(data.id);
    try {
      const res = await coreImport(src, context.userId);
      await markRun(
        data.id,
        `import ok: ${res.report.students.linked}+${res.report.students.created}`,
      );
      return res;
    } catch (e) {
      await markRun(data.id, `import erro: ${(e as Error).message}`.slice(0, 200));
      throw e;
    }
  });
