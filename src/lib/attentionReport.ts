import { getClassAttendanceAll } from "@/lib/attendance";
import { getGrades } from "@/lib/grades";
import { listStudentsByClass } from "@/lib/students";
import { getMyAttendanceAlert, periodStart, type AlertPeriod } from "@/lib/attendanceAlerts";
import { listClasses } from "@/lib/classes";

export type ReportPeriod = AlertPeriod | "semester";

export interface AttentionRow {
  studentId: string;
  studentName: string;
  absences: number;
  unjustified: number;
  attendancePct: number;
  missingGrades: number; // 0..3 (P1/P2/Ativ)
  missingLabels: string[];
  lowGrade: boolean;
  frequentWithoutGrade: boolean;
  reasons: string[];
}

export interface AttentionReport {
  className: string;
  bimester: number;
  period: ReportPeriod;
  generatedAt: string;
  rows: AttentionRow[];
  allRows: AttentionRow[];
  totals: { students: number; atRisk: number; frequentWithoutGrade: number };
}

const periodStartSemester = (): Date => {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() < 6 ? new Date(y, 0, 1) : new Date(y, 6, 1);
};

export async function buildAttentionReport(input: {
  schoolId: string;
  classId: string;
  bimester: number;
  period?: ReportPeriod;
}): Promise<AttentionReport> {
  const [students, attendance, grades, classes, alert] = await Promise.all([
    listStudentsByClass(input.schoolId, input.classId),
    getClassAttendanceAll(input.schoolId, input.classId),
    getGrades(input.schoolId, input.classId, input.bimester),
    listClasses(input.schoolId),
    getMyAttendanceAlert(input.classId).catch(() => null),
  ]);
  const className = classes.find((c) => c.id === input.classId)?.name ?? "Turma";
  const period = input.period ?? alert?.period ?? "month";
  const start =
    period === "semester" ? periodStartSemester() : periodStart(period as AlertPeriod);
  const startISO = start.toISOString().slice(0, 10);
  const maxAbs = alert?.maxAbsences ?? 5;

  const rows: AttentionRow[] = students.map((s) => {
    let total = 0;
    let unj = 0;
    let daysCount = 0;
    let presentOrJust = 0;
    for (const [d, entries] of Object.entries(attendance)) {
      if (d < startISO) continue;
      const e = entries[s.id];
      if (!e) continue;
      daysCount++;
      if (e.status === "P" || e.status === "J") presentOrJust++;
      if (e.status === "F" || e.status === "J") total++;
      if (e.status === "F") unj++;
    }
    const attendancePct = daysCount === 0 ? 100 : Math.round((presentOrJust / daysCount) * 100);
    const g = grades[s.id] ?? {};
    const isMissing = (v: number | null | undefined) => v == null || Number.isNaN(v);
    const missingLabels: string[] = [];
    if (isMissing(g.p1)) missingLabels.push("P1");
    if (isMissing(g.p2)) missingLabels.push("P2");
    if (isMissing(g.atividade)) missingLabels.push("Ativ.");
    const missingGrades = missingLabels.length;
    const media = g.media ?? 0;
    const lowGrade = missingGrades < 3 && media > 0 && media < 6;
    const frequentWithoutGrade = attendancePct >= 75 && missingGrades > 0;
    const reasons: string[] = [];
    if (total >= maxAbs) reasons.push(`${total} faltas (limite ${maxAbs})`);
    if (attendancePct < 75) reasons.push(`Frequência ${attendancePct}%`);
    if (missingGrades > 0) reasons.push(`Sem ${missingLabels.join(", ")}`);
    if (lowGrade) reasons.push(`Média ${media.toFixed(1)}`);
    if (frequentWithoutGrade) reasons.push(`Frequente sem nota`);
    return {
      studentId: s.id,
      studentName: s.name,
      absences: total,
      unjustified: unj,
      attendancePct,
      missingGrades,
      missingLabels,
      lowGrade,
      frequentWithoutGrade,
      reasons,
    };
  });

  const atRisk = rows.filter((r) => r.reasons.length > 0);
  const frequentWithoutGrade = rows.filter((r) => r.frequentWithoutGrade).length;
  return {
    className,
    bimester: input.bimester,
    period,
    generatedAt: new Date().toISOString(),
    rows: atRisk,
    allRows: rows,
    totals: { students: students.length, atRisk: atRisk.length, frequentWithoutGrade },
  };
}

export function reportToCSV(r: AttentionReport): string {
  const header = ["Aluno", "Faltas", "Sem justificativa", "Frequência %", "Notas faltando", "Média baixa", "Motivos"];
  const lines = [header.join(",")];
  for (const row of r.rows) {
    lines.push(
      [
        `"${row.studentName.replace(/"/g, '""')}"`,
        row.absences,
        row.unjustified,
        row.attendancePct,
        row.missingGrades,
        row.lowGrade ? "sim" : "não",
        `"${row.reasons.join("; ").replace(/"/g, '""')}"`,
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function reportToText(r: AttentionReport): string {
  const period = r.period === "semester" ? "Semestre" : r.period === "year" ? "Ano" : r.period === "bimester" ? "Bimestre" : "Mês";
  const lines = [
    `Relatório de atenção — ${r.className}`,
    `Período: ${period} · Bimestre ${r.bimester}`,
    `Total de alunos: ${r.totals.students} · Em atenção: ${r.totals.atRisk}`,
    "",
  ];
  for (const row of r.rows) {
    lines.push(`• ${row.studentName} — ${row.reasons.join("; ")}`);
  }
  return lines.join("\n");
}

export function downloadCSV(name: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
