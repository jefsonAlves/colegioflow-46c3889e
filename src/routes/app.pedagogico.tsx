import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  Bell, 
  FileText, 
  Search, 
  User, 
  ShieldAlert, 
  MessageSquare,
  Download,
  History,
  AlertTriangle
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SchoolGate } from "@/components/SchoolGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loading, EmptyState } from "@/components/States";
import { useAuth } from "@/contexts/AuthContext";
import { listStudents, type StudentDoc } from "@/lib/students";
import { listClasses } from "@/lib/classes";
import { createPedagogicalRequest, getStudentDossier } from "@/lib/pedagogical";
import { jsPDF } from "jspdf";

export const Route = createFileRoute("/app/pedagogico")({
  component: () => (
    <AppShell title="Espaço Pedagógico">
      <SchoolGate>{({ schoolId }) => <PedagogicoPanel schoolId={schoolId} />}</SchoolGate>
    </AppShell>
  ),
});

function PedagogicoPanel({ schoolId }: { schoolId: string }) {
  const { userDoc } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentDoc | null>(null);
  const [requestType, setRequestType] = useState<'urgency' | 'notice'>('notice');
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const studentsQ = useQuery({
    queryKey: ["students-all", schoolId],
    queryFn: () => listStudents(schoolId),
  });

  const dossierQ = useQuery({
    queryKey: ["student-dossier", schoolId, selectedStudent?.id],
    queryFn: () => getStudentDossier(schoolId, selectedStudent!.id),
    enabled: !!selectedStudent,
  });

  const filtered = useMemo(() => {
    const list = studentsQ.data ?? [];
    if (!search.trim()) return [];
    return list.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).slice(0, 5);
  }, [studentsQ.data, search]);

  const sendRequest = async () => {
    if (!selectedStudent || !message.trim()) return;
    setSending(true);
    try {
      await createPedagogicalRequest({
        schoolId,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        type: requestType,
        message: message.trim(),
      });
      toast.success("Solicitação enviada aos responsáveis.");
      setMessage("");
    } catch (e) {
      toast.error("Erro ao enviar solicitação.");
    } finally {
      setSending(false);
    }
  };

  const downloadDossier = () => {
    if (!selectedStudent || !dossierQ.data) return;
    const doc = new jsPDF();
    const { disciplinary, grades, attendance } = dossierQ.data;
    
    doc.setFontSize(18);
    doc.text(`Dossiê do Aluno: ${selectedStudent.name}`, 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 20, 30);
    
    doc.text("Resumo de Advertências:", 20, 45);
    let y = 55;
    disciplinary.forEach((d: any) => {
      doc.text(`- ${d.date}: [${d.severity}] ${d.description.slice(0, 50)}...`, 25, y);
      y += 7;
    });

    doc.text(`Frequência: ${attendance.length} registros encontrados`, 20, y + 10);
    doc.text(`Notas: ${grades.length} lançamentos encontrados`, 20, y + 20);
    
    if (selectedStudent.status === 'school_transfer') {
      doc.setTextColor(220, 38, 38);
      doc.text("ALUNO TRANSFERIDO DA ESCOLA", 20, y + 35);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.text(`Motivo: ${selectedStudent.transferReason || 'Não informado'}`, 20, y + 42);
      doc.text(`Data: ${selectedStudent.transferDate ? new Date(selectedStudent.transferDate).toLocaleDateString() : 'Não informada'}`, 20, y + 49);
    }

    doc.save(`dossie_${selectedStudent.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2"><Search className="size-4" /> Buscar Aluno</Label>
            <Input 
              placeholder="Digite o nome do aluno..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          {filtered.length > 0 && !selectedStudent && (
            <div className="border rounded-lg divide-y bg-muted/20">
              {filtered.map(s => (
                <button 
                  key={s.id} 
                  className="w-full p-3 text-left hover:bg-muted/40 flex items-center gap-2"
                  onClick={() => {
                    setSelectedStudent(s);
                    setSearch("");
                  }}
                >
                  <User className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{s.name}</span>
                </button>
              ))}
            </div>
          )}

          {selectedStudent && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 text-primary">
                <ShieldAlert className="size-5" />
                <span className="font-semibold">{selectedStudent.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>Trocar</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStudent && (
        <>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Bell className="size-4" /> Notificar Responsáveis
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant={requestType === 'notice' ? 'default' : 'outline'}
                  onClick={() => setRequestType('notice')}
                  className="w-full"
                >
                  <MessageSquare className="size-4 mr-2" /> Aviso
                </Button>
                <Button 
                  variant={requestType === 'urgency' ? 'destructive' : 'outline'}
                  onClick={() => setRequestType('urgency')}
                  className="w-full"
                >
                  <AlertTriangle className="size-4 mr-2" /> Urgência
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label>Mensagem</Label>
                <Textarea 
                  placeholder="Descreva o motivo do contato..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>

              <Button className="w-full" disabled={sending} onClick={sendRequest}>
                {sending ? "Enviando..." : "Enviar Notificação"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4" /> Dossiê e Relatórios
                </div>
                <Button variant="outline" size="sm" onClick={downloadDossier}>
                  <Download className="size-4 mr-2" /> Baixar PDF
                </Button>
              </div>

              {dossierQ.isLoading ? <Loading /> : (
                <div className="space-y-4">
                  <div className="rounded-lg border p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                      <History className="size-3" /> Histórico de Advertências
                    </h4>
                    {dossierQ.data?.disciplinary.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma advertência registrada.</p>
                    ) : (
                      <div className="space-y-2">
                        {dossierQ.data?.disciplinary.map((d: any) => (
                          <div key={d.id} className="text-sm border-b pb-2 last:border-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted">
                                {new Date(d.date).toLocaleDateString()}
                              </span>
                              <span className="text-[10px] text-destructive uppercase font-bold">{d.severity}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{d.description}</p>
                            <div className="mt-1 text-[10px] italic text-muted-foreground">
                              Aplicada por: {d.recorded_by === userDoc?.id ? 'Você' : 'Outro Educador'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!selectedStudent && (
        <EmptyState 
          title="Selecione um aluno"
          description="Busque um aluno acima para visualizar seu dossiê completo, advertências e enviar notificações urgentes aos pais."
        />
      )}
    </div>
  );
}
