import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Trash2, Upload, Paperclip } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loading } from "@/components/States";
import { listStudents } from "@/lib/students";
import {
  createCertificate,
  deleteCertificate,
  listCertificatesBySchool,
  uploadCertificateFile,
} from "@/lib/certificates";

export function SchoolCertificatesSection({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const studentsQ = useQuery({
    queryKey: ["students-all", schoolId],
    queryFn: () => listStudents(schoolId),
    staleTime: 30_000,
  });
  const certsQ = useQuery({
    queryKey: ["certificates", schoolId],
    queryFn: () => listCertificatesBySchool(schoolId),
    staleTime: 30_000,
  });

  const [studentId, setStudentId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const studentMap = useMemo(
    () => Object.fromEntries((studentsQ.data ?? []).map((s) => [s.id, s.name])),
    [studentsQ.data],
  );

  const save = async () => {
    if (!studentId || !startDate || !endDate) {
      toast.error("Preencha aluno e período.");
      return;
    }
    if (endDate < startDate) {
      toast.error("Data final antes do início.");
      return;
    }
    setSaving(true);
    try {
      let attachmentUrl: string | undefined;
      if (file) {
        attachmentUrl = await uploadCertificateFile(schoolId, file);
      }
      await createCertificate({ schoolId, studentId, startDate, endDate, reason, attachmentUrl });
      toast.success("Atestado salvo. Faltas do período foram justificadas.");
      setStudentId("");
      setReason("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["certificates", schoolId] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar atestado.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este atestado? As justificativas já aplicadas continuam.")) return;
    try {
      await deleteCertificate(id);
      qc.invalidateQueries({ queryKey: ["certificates", schoolId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao excluir.");
    }
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
        <FileText className="size-4" /> Atestados médicos
      </h3>
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Aluno</Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {(studentsQ.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fim</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Motivo (opcional)</Label>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: gripe, consulta médica..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Anexar arquivo (opcional)</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <div className="text-[11px] text-muted-foreground">{file.name}</div>}
          </div>
          <Button onClick={save} disabled={saving} className="w-full">
            <Upload className="size-4" /> {saving ? "Salvando..." : "Registrar atestado"}
          </Button>
        </CardContent>
      </Card>

      <div className="mt-3 space-y-2">
        {certsQ.isLoading ? (
          <Loading />
        ) : (certsQ.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhum atestado registrado.</p>
        ) : (
          certsQ.data!.map((c) => (
            <Card key={c.id}>
              <CardContent className="pt-3 pb-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {studentMap[c.studentId] ?? "Aluno"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {c.startDate} → {c.endDate}
                    {c.reason ? ` · ${c.reason}` : ""}
                  </div>
                  {c.attachmentUrl && (
                    <a
                      href={c.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-primary inline-flex items-center gap-1 mt-1"
                    >
                      <Paperclip className="size-3" /> Ver anexo
                    </a>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="size-8 p-0 text-destructive"
                  onClick={() => remove(c.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
