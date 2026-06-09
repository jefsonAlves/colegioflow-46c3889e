import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { readNode, listTopLevel } from "@/integrations/firebase/rtdb";
import { normalizeName } from "./normalize";
import type {
  MembershipDoc,
  RoleInSchool,
  SchoolDoc,
  UserDoc,
} from "./types";

// Known legacy Firestore collection names (PT-BR convention)
const LEGACY_FS_COLLECTIONS = [
  "usuarios",
  "escolas",
  "professores",
  "admins",
  "alunos",
  "turmas",
  "chamadas",
  "notas",
  "avisos",
];

// Known new collections (current model)
const NEW_FS_COLLECTIONS = ["users", "schools", "school_memberships"];

export interface ScanReport {
  rtdb: Record<string, number>;
  firestore: Record<string, { count: number; sample: unknown | null }>;
}

export async function scanLegacy(): Promise<ScanReport> {
  const rtdbInfo = await listTopLevel().catch((e) => {
    console.error("RTDB scan failed", e);
    return {} as Record<string, number>;
  });

  const fsInfo: ScanReport["firestore"] = {};
  for (const name of [...LEGACY_FS_COLLECTIONS, ...NEW_FS_COLLECTIONS]) {
    try {
      const snap = await getDocs(collection(db, name));
      fsInfo[name] = {
        count: snap.size,
        sample: snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null,
      };
    } catch (e) {
      console.warn(`Skip collection ${name}`, e);
    }
  }
  return { rtdb: rtdbInfo, firestore: fsInfo };
}

// ===== Plan / Apply =====
export type Op =
  | { type: "user.upsert"; uid: string; data: Partial<UserDoc>; reason: string }
  | { type: "school.upsert"; id: string; data: Partial<SchoolDoc>; reason: string }
  | { type: "membership.create"; data: Omit<MembershipDoc, "id" | "createdAt">; reason: string };

interface LegacyUser {
  nome?: string;
  name?: string;
  email?: string;
  foto?: string;
  photoUrl?: string;
  tipo?: string;
  profileType?: string;
  escolaId?: string;
}

interface LegacySchool {
  nome?: string;
  name?: string;
  cidade?: string;
  city?: string;
  uf?: string;
  state?: string;
  criadoPor?: string;
  createdBy?: string;
}

function pickProfileType(tipo?: string): UserDoc["profileType"] | undefined {
  if (!tipo) return undefined;
  const t = tipo.toLowerCase();
  if (t.includes("prof")) return "teacher";
  if (t.includes("adm") || t.includes("dir") || t.includes("coord")) return "school_admin";
  if (t.includes("pai") || t.includes("resp") || t.includes("parent")) return "parent";
  return undefined;
}

function pickRoleInSchool(tipo?: string): RoleInSchool {
  const pt = pickProfileType(tipo);
  if (pt === "school_admin") return "school_admin";
  if (tipo?.toLowerCase().includes("coord")) return "coordinator";
  return "teacher";
}

/**
 * Build a migration plan. Reads legacy Firestore + RTDB data and produces ops
 * without writing anything. Inspect the result before calling applyMigration.
 */
export async function planMigration(): Promise<Op[]> {
  const ops: Op[] = [];

  // --- Schools ---
  const schoolIdMap = new Map<string, string>(); // legacyId -> newId
  const seenSchoolKeys = new Map<string, string>(); // normalizedName|city -> newId

  // Existing new schools (to dedupe)
  try {
    const existing = await getDocs(collection(db, "schools"));
    existing.forEach((d) => {
      const data = d.data() as SchoolDoc;
      const key = `${data.normalizedName}|${(data.city ?? "").toLowerCase()}`;
      seenSchoolKeys.set(key, d.id);
    });
  } catch (e) {
    console.warn(e);
  }

  const legacySchools: Array<{ id: string; data: LegacySchool }> = [];

  // Firestore legacy
  try {
    const snap = await getDocs(collection(db, "escolas"));
    snap.forEach((d) => legacySchools.push({ id: d.id, data: d.data() as LegacySchool }));
  } catch {
    /* ignore */
  }

  // RTDB legacy
  const rtdbEscolas = await readNode<Record<string, LegacySchool>>("/escolas").catch(() => null);
  if (rtdbEscolas) {
    for (const [id, data] of Object.entries(rtdbEscolas)) {
      if (!legacySchools.find((s) => s.id === id)) legacySchools.push({ id, data });
    }
  }

  for (const { id, data } of legacySchools) {
    const name = (data.name ?? data.nome ?? "").trim();
    if (!name) continue;
    const city = (data.city ?? data.cidade ?? "").trim();
    const state = (data.state ?? data.uf ?? "").trim();
    const norm = normalizeName(name);
    const key = `${norm}|${city.toLowerCase()}`;

    let targetId = seenSchoolKeys.get(key);
    if (!targetId) {
      targetId = id; // preserve legacy id when possible
      seenSchoolKeys.set(key, targetId);
      ops.push({
        type: "school.upsert",
        id: targetId,
        data: {
          name,
          normalizedName: norm,
          city,
          state,
          createdBy: data.createdBy ?? data.criadoPor ?? "migration",
          status: "active",
        },
        reason: `Escola legada "${name}"`,
      });
    }
    schoolIdMap.set(id, targetId);
  }

  // --- Users ---
  const legacyUsers = new Map<string, LegacyUser>();
  try {
    const snap = await getDocs(collection(db, "usuarios"));
    snap.forEach((d) => legacyUsers.set(d.id, d.data() as LegacyUser));
  } catch {
    /* ignore */
  }
  const rtdbUsers = await readNode<Record<string, LegacyUser>>("/usuarios").catch(() => null);
  if (rtdbUsers) {
    for (const [uid, data] of Object.entries(rtdbUsers)) {
      if (!legacyUsers.has(uid)) legacyUsers.set(uid, data);
    }
  }

  for (const [uid, u] of legacyUsers) {
    const profileType = pickProfileType(u.tipo ?? u.profileType);
    ops.push({
      type: "user.upsert",
      uid,
      data: {
        name: u.name ?? u.nome ?? "",
        email: u.email ?? "",
        photoUrl: u.photoUrl ?? u.foto ?? null,
        profileType,
        onboardingComplete: Boolean(profileType),
        active: true,
      },
      reason: `Usuário legado ${u.email ?? uid}`,
    });
  }

  // --- Memberships (from professores / admins) ---
  const legacyMembers: Array<{ uid: string; data: LegacyUser; defaultRole: RoleInSchool }> = [];

  for (const [coll, role] of [
    ["professores", "teacher" as RoleInSchool],
    ["admins", "school_admin" as RoleInSchool],
  ] as const) {
    try {
      const snap = await getDocs(collection(db, coll));
      snap.forEach((d) =>
        legacyMembers.push({ uid: d.id, data: d.data() as LegacyUser, defaultRole: role }),
      );
    } catch {
      /* ignore */
    }
    const rtdbMembers = await readNode<Record<string, LegacyUser>>(`/${coll}`).catch(() => null);
    if (rtdbMembers) {
      for (const [uid, data] of Object.entries(rtdbMembers)) {
        legacyMembers.push({ uid, data, defaultRole: role });
      }
    }
  }

  // Existing memberships (dedupe)
  const existingMembershipKeys = new Set<string>();
  try {
    const snap = await getDocs(collection(db, "school_memberships"));
    snap.forEach((d) => {
      const m = d.data() as MembershipDoc;
      existingMembershipKeys.add(`${m.schoolId}|${m.userId}|${m.roleInSchool}`);
    });
  } catch {
    /* ignore */
  }

  for (const { uid, data, defaultRole } of legacyMembers) {
    const legacySchoolId = data.escolaId;
    if (!legacySchoolId) continue;
    const schoolId = schoolIdMap.get(legacySchoolId) ?? legacySchoolId;
    const role = pickRoleInSchool(data.tipo) || defaultRole;
    const key = `${schoolId}|${uid}|${role}`;
    if (existingMembershipKeys.has(key)) continue;
    existingMembershipKeys.add(key);
    ops.push({
      type: "membership.create",
      data: {
        schoolId,
        userId: uid,
        roleInSchool: role,
        status: "approved",
        approvedBy: "migration",
      },
      reason: `Vínculo legado ${uid} → ${schoolId}`,
    });
  }

  return ops;
}

export interface ApplyResult {
  runId: string;
  total: number;
  applied: number;
  errors: string[];
}

export async function applyMigration(ops: Op[]): Promise<ApplyResult> {
  const runId = `run_${Date.now()}`;
  const errors: string[] = [];
  let applied = 0;

  // process in chunks of 400
  for (let i = 0; i < ops.length; i += 400) {
    const chunk = ops.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const op of chunk) {
      try {
        if (op.type === "user.upsert") {
          batch.set(
            doc(db, "users", op.uid),
            {
              ...op.data,
              id: op.uid,
              globalRole: "user",
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
            },
            { merge: true },
          );
        } else if (op.type === "school.upsert") {
          batch.set(
            doc(db, "schools", op.id),
            {
              ...op.data,
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
            },
            { merge: true },
          );
        } else if (op.type === "membership.create") {
          const ref = doc(collection(db, "school_memberships"));
          batch.set(ref, { ...op.data, createdAt: serverTimestamp() });
        }
      } catch (e) {
        errors.push(`${op.type}: ${(e as Error).message}`);
      }
    }
    try {
      await batch.commit();
      applied += chunk.length;
    } catch (e) {
      errors.push(`batch ${i}: ${(e as Error).message}`);
    }
  }

  // Log the run
  try {
    await setDoc(doc(db, "migration_runs", runId), {
      runId,
      total: ops.length,
      applied,
      errors,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error("Failed to log migration run", e);
  }

  return { runId, total: ops.length, applied, errors };
}

/**
 * Try to hydrate a UserDoc from legacy sources (Firestore `usuarios` / RTDB)
 * when the user logs in for the first time but already had data in the old app.
 */
export async function tryHydrateLegacyUser(uid: string, email: string): Promise<Partial<UserDoc> | null> {
  // 1. Firestore /usuarios/{uid}
  try {
    const snap = await getDocs(query(collection(db, "usuarios"), where("__name__", "==", uid)));
    if (!snap.empty) {
      const u = snap.docs[0].data() as LegacyUser;
      return {
        name: u.name ?? u.nome ?? "",
        photoUrl: u.photoUrl ?? u.foto ?? null,
        profileType: pickProfileType(u.tipo ?? u.profileType),
        onboardingComplete: Boolean(pickProfileType(u.tipo ?? u.profileType)),
      };
    }
  } catch {
    /* ignore */
  }

  // 2. RTDB /usuarios/{uid}
  const node = await readNode<LegacyUser>(`/usuarios/${uid}`).catch(() => null);
  if (node) {
    return {
      name: node.name ?? node.nome ?? "",
      photoUrl: node.photoUrl ?? node.foto ?? null,
      profileType: pickProfileType(node.tipo ?? node.profileType),
      onboardingComplete: Boolean(pickProfileType(node.tipo ?? node.profileType)),
    };
  }

  // 3. Fallback: search by email in /usuarios (RTDB) — limited; skipped
  void email;
  return null;
}
