import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AbsenceReport } from "@/lib/absenceReport";

const fmt = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export function generateAbsenceReportPDF(r: AbsenceReport, className?: string): void {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de alunos faltosos", 14, 15);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let y = 22;
  if (r.schoolName) {
    doc.text(`Escola: ${r.schoolName}`, 14, y);
    y += 5;
  }
  doc.text(`Turma: ${className ?? "Todas"}`, 14, y);
  y += 5;
  doc.text(`Período: ${fmt(r.from)} a ${fmt(r.to)}`, 14, y);
  y += 5;
  doc.text(
    `Alunos com faltas: ${r.totals.flagged} · Total de faltas: ${r.totals.absences} · Mínimo considerado: ${r.minAbsences}`,
    14,
    y,
  );
  y += 5;
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, 14, y);

  autoTable(doc, {
    startY: y + 5,
    head: [["Aluno", "Turma", "Faltas", "Just.", "Dias", "Freq. %"]],
    body: r.rows.map((row) => [
      row.studentName,
      row.className,
      String(row.absences),
      String(row.justified),
      String(row.days),
      `${row.attendancePct}%`,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 64, 175] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`faltosos-${r.from}-a-${r.to}.pdf`);
}
