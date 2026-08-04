import { supabase } from "@/integrations/supabase/client";
import { listClasses } from "@/lib/classes";
import { listStudents } from "@/lib/students";

export type AbsencePeriodKey = "month" | "bimester" | "semester" | "year" | "custom";

export interface AbsenceRow {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  gradeLevel?: string | null;
  days: number;
  absences: number; // F
  justified: number; // J
  present: number; // P
  attendancePct: number;
}

export interface AbsenceReport {
  schoolName?: string;
  from: string;
  to: string;
  classFilter: string | null;
  minAbsences: number;
  generatedAt: string;
  rows: AbsenceRow[];
  totals: { students: number; flagged: number; absences: number };
}

export function periodRange(key: Exclude<AbsencePeriodKey, "custom">): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const to = iso(now);
  if (key === "month") return { from: iso(new Date(y, now.getMonth(), 1)), to };
  if (key === "semester") return { from: iso(new Date(y, now.getMonth() < 6 ? 0 : 6, 1)), to };
  if (key === "year") return { from: iso(new Date(y, 0, 1)), to };
  // bimester: 2-month block
  const startMonth = Math.floor(now.getMonth() / 2) * 2;
  return { from: iso(new Date(y, startMonth, 1)), to };
}

export async function buildAbsenceReport(input: {
  schoolId: string;
  from: string;
  to: string;
  classId?: string | null;
  minAbsences?: number;
  schoolName?: string;
}): Promise<AbsenceReport> {
  const minAbsences = input.minAbsences ?? 1;
  let q = supabase
    .from("attendance")
    .select("student_id, class_id, date, status")
    .eq("school_id", input.schoolId)
    .gte("date", input.from)
    .lte("date", input.to);
  if (input.classId) q = q.eq("class_id", input.classId);
  const [{ data, error }, classes, students] = await Promise.all([
    q,
    listClasses(input.schoolId),
    listStudents(input.schoolId),
  ]);
  if (error) throw error;

  const classNames = new Map(classes.map((c) => [c.id, c.name]));
  const classGrades = new Map(classes.map((c) => [c.id, c.gradeLevel]));
  const studentNames = new Map(students.map((s) => [s.id, s.name]));

  const acc = new Map<string, AbsenceRow>();
  for (const r of data ?? []) {
    const studentId = r.student_id as string;
    const classId = (r.class_id as string) ?? "";
    const key = `${studentId}:${classId}`;
    let row = acc.get(key);
    if (!row) {
      row = {
        studentId,
        classId,
        studentName: studentNames.get(studentId) ?? "Aluno",
        className: classNames.get(classId) ?? "Turma",
        gradeLevel: classGrades.get(classId),
        days: 0,
        absences: 0,
        justified: 0,
        present: 0,
        attendancePct: 100,
      };
      acc.set(key, row);
    }
    row.days++;
    const st = (r.status as string) ?? "P";
    if (st === "F") row.absences++;
    else if (st === "J") row.justified++;
    else row.present++;
  }

  const all = [...acc.values()].map((r) => ({
    ...r,
    attendancePct: r.days === 0 ? 100 : Math.round(((r.present + r.justified) / r.days) * 100),
  }));

  const rows = all
    .filter((r) => r.absences + r.justified >= minAbsences)
    .sort((a, b) => b.absences - a.absences || a.studentName.localeCompare(b.studentName));

  return {
    schoolName: input.schoolName,
    from: input.from,
    to: input.to,
    classFilter: input.classId ?? null,
    minAbsences,
    generatedAt: new Date().toISOString(),
    rows,
    totals: {
      students: all.length,
      flagged: rows.length,
      absences: rows.reduce((a, b) => a + b.absences, 0),
    },
  };
}

export function absenceReportToCSV(r: AbsenceReport): string {
  const header = ["Aluno", "Turma", "Faltas", "Justificadas", "Dias registrados", "Frequência %"];
  const lines = [header.join(",")];
  for (const row of r.rows) {
    lines.push(
      [
        `"${row.studentName.replace(/"/g, '""')}"`,
        `"${row.className.replace(/"/g, '""')}"`,
        row.absences,
        row.justified,
        row.days,
        row.attendancePct,
      ].join(","),
    );
  }
  return lines.join("\n");
}
