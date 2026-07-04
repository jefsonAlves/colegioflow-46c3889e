import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getStudentAllBimesters, type GradeEntry } from "@/lib/grades";
import { getClassAttendanceAll } from "@/lib/attendance";
import { listStudentsByClass } from "@/lib/students";
import { listClasses } from "@/lib/classes";

interface StudentBoletim {
  name: string;
  bimesters: Record<number, GradeEntry>;
  freqPct: number;
  absences: number;
  totalDays: number;
  finalMedia: number;
  situation: "APR" | "REC" | "REP";
}

const situation = (media: number): StudentBoletim["situation"] => {
  if (media >= 6) return "APR";
  if (media >= 4) return "REC";
  return "REP";
};

function header(doc: jsPDF, className: string, subtitle: string) {
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Boletim escolar", 14, 15);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Turma: ${className}`, 14, 22);
  doc.text(subtitle, 14, 27);
  doc.text(`Emitido em ${new Date().toLocaleDateString("pt-BR")}`, 14, 32);
}

async function computeStudent(
  schoolId: string,
  classId: string,
  studentId: string,
  studentName: string,
  cachedAtt?: Awaited<ReturnType<typeof getClassAttendanceAll>>,
): Promise<StudentBoletim> {
  const [bimesters, att] = await Promise.all([
    getStudentAllBimesters(schoolId, classId, studentId),
    cachedAtt ? Promise.resolve(cachedAtt) : getClassAttendanceAll(schoolId, classId),
  ]);
  let present = 0;
  let absences = 0;
  let totalDays = 0;
  for (const day of Object.values(att)) {
    const e = day[studentId];
    if (!e) continue;
    totalDays++;
    if (e.status === "P" || e.status === "J") present++;
    if (e.status === "F") absences++;
  }
  const freqPct = totalDays === 0 ? 0 : Math.round((present / totalDays) * 100);
  const medias = [1, 2, 3, 4].map((b) => bimesters[b]?.media).filter((m): m is number => typeof m === "number");
  const finalMedia = medias.length === 0 ? 0 : Math.round((medias.reduce((a, b) => a + b, 0) / medias.length) * 10) / 10;
  return {
    name: studentName,
    bimesters,
    freqPct,
    absences,
    totalDays,
    finalMedia,
    situation: situation(finalMedia),
  };
}

function drawStudent(doc: jsPDF, b: StudentBoletim, startY: number): number {
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(b.name, 14, startY);
  const rows = [1, 2, 3, 4].map((n) => {
    const g = b.bimesters[n];
    return [
      `${n}º`,
      g?.p1 != null ? String(g.p1) : "—",
      g?.p2 != null ? String(g.p2) : "—",
      g?.atividade != null ? String(g.atividade) : "—",
      g?.media != null ? g.media.toFixed(1) : "—",
    ];
  });
  autoTable(doc, {
    startY: startY + 3,
    head: [["Bim.", "P1", "P2", "Ativ.", "Média"]],
    body: rows,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [30, 64, 175] },
    margin: { left: 14, right: 14 },
  });
  // @ts-expect-error autotable augments jsPDF
  const afterY = (doc.lastAutoTable?.finalY ?? startY + 30) + 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Média final: ${b.finalMedia.toFixed(1)}  ·  Frequência: ${b.freqPct}% (${b.absences} falta(s) em ${b.totalDays} dia(s))  ·  Situação: ${b.situation}`,
    14,
    afterY,
  );
  return afterY + 6;
}

export async function generateStudentBoletimPDF(input: {
  schoolId: string;
  classId: string;
  studentId: string;
  studentName: string;
}): Promise<void> {
  const doc = new jsPDF();
  const classes = await listClasses(input.schoolId);
  const className = classes.find((c) => c.id === input.classId)?.name ?? "Turma";
  header(doc, className, `Aluno: ${input.studentName}`);
  const b = await computeStudent(input.schoolId, input.classId, input.studentId, input.studentName);
  drawStudent(doc, b, 42);
  doc.save(`boletim-${input.studentName.replace(/\s+/g, "_")}.pdf`);
}

export async function generateClassBoletimPDF(input: {
  schoolId: string;
  classId: string;
}): Promise<void> {
  const doc = new jsPDF();
  const [students, classes, att] = await Promise.all([
    listStudentsByClass(input.schoolId, input.classId),
    listClasses(input.schoolId),
    getClassAttendanceAll(input.schoolId, input.classId),
  ]);
  const className = classes.find((c) => c.id === input.classId)?.name ?? "Turma";
  header(doc, className, `Boletim geral · ${students.length} aluno(s)`);
  let y = 42;
  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const b = await computeStudent(input.schoolId, input.classId, s.id, s.name, att);
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    y = drawStudent(doc, b, y);
  }
  doc.save(`boletim-turma-${className.replace(/\s+/g, "_")}.pdf`);
}
