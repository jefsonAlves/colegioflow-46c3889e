import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ListTodo,
  Plus,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  XCircle,
  Hash,
  MessageSquare,
  Trash2,
  Users,
  Save,
  Clock,
  LayoutGrid
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SchoolGate } from "@/components/SchoolGate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loading, EmptyState } from "@/components/States";
import { useAuth } from "@/contexts/AuthContext";
import { listClasses, type ClassDoc } from "@/lib/classes";
import { listMyTaughtClasses } from "@/lib/classTeachers";
import { listStudentsByClass } from "@/lib/students";
import {
  createEventuality,
  listEventualities,
  saveEventualityRecord,
  getEventualityRecords,
  deleteEventuality
} from "@/lib/eventualities";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";

export const Route = createFileRoute("/app/eventualidades")({
  component: EventualidadesPage,
});

function EventualidadesPage() {
  return (
    <AppShell title="Eventualidades">
      <SchoolGate>{({ schoolId }) => <EventualidadesContent schoolId={schoolId} />}</SchoolGate>
    </AppShell>
  );
}

function EventualidadesContent({ schoolId }: { schoolId: string }) {
  const { userDoc, firebaseUser } = useAuth();
  const isAdmin = userDoc?.profileType === "school_admin" || userDoc?.globalRole === "master";
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const eventsQ = useQuery({
    queryKey: ["eventualities", schoolId],
    queryFn: () => listEventualities({ data: { schoolId } }),
  });

  const myTaughtQ = useQuery({
    queryKey: ["my-taught-classes", firebaseUser?.uid],
    queryFn: () => listMyTaughtClasses(firebaseUser!.uid).then(list => list.filter(t => t.active)),
    enabled: !!firebaseUser,
  });

  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
  });

  const taughtIds = new Set((myTaughtQ.data ?? []).map(t => t.classId));
  const classes = isAdmin ? (classesQ.data ?? []) : (classesQ.data ?? []).filter(c => taughtIds.has(c.id));

  if (eventsQ.isLoading || classesQ.isLoading) return <Loading />;

  if (selectedEventId) {
    const event = (eventsQ.data ?? []).find(e => e.id === selectedEventId);
    if (!event) {
      setSelectedEventId(null);
      return null;
    }
    return (
      <EventDetail
        event={event}
        onBack={() => {
          setSelectedEventId(null);
          eventsQ.refetch();
        }}
      />
    );
  }

  if (showNewForm) {
    return (
      <NewEventForm
        schoolId={schoolId}
        classes={classes}
        teacherId={firebaseUser!.uid}
        onBack={() => setShowNewForm(false)}
        onSuccess={() => {
          setShowNewForm(false);
          eventsQ.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ListTodo className="size-5 text-primary" />
          Seus Eventos
        </h2>
        <Button onClick={() => setShowNewForm(true)} size="sm" className="gap-2">
          <Plus className="size-4" /> Novo
        </Button>
      </div>

      {eventsQ.data?.length === 0 ? (
        <EmptyState
          title="Nenhuma eventualidade"
          description="Crie listas de verificação, notas rápidas ou controles para suas turmas."
        />
      ) : (
        <div className="grid gap-3">
          {eventsQ.data?.map(event => {
            const cls = classes.find(c => c.id === event.class_id);
            return (
              <Card
                key={event.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedEventId(event.id)}
              >
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="font-semibold">{event.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Users className="size-3" /> {cls?.name ?? "Turma"}
                      {event.deadline && (
                        <>
                          <Clock className="size-3 ml-1" /> Prazo: {new Date(event.deadline).toLocaleDateString()}
                        </>
                      )}
                    </div>
                  </div>
                  <LayoutGrid className="size-5 text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewEventForm({
  schoolId,
  classes,
  teacherId,
  onBack,
  onSuccess
}: {
  schoolId: string;
  classes: ClassDoc[];
  teacherId: string;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState("");
  const [eventType, setEventType] = useState<'boolean' | 'numeric' | 'status' | 'custom'>('boolean');
  const [deadlineType, setDeadlineType] = useState<'none' | 'today' | 'custom'>('none');
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !classId) {
      toast.error("Preencha o título e selecione a turma.");
      return;
    }

    setLoading(true);
    try {
      let finalDeadline = undefined;
      if (deadlineType === 'today') {
        finalDeadline = new Date().toISOString().split('T')[0];
      } else if (deadlineType === 'custom' && deadline) {
        finalDeadline = deadline;
      }

      await createEventuality({
        data: {
          schoolId,
          classId,
          teacherId,
          title,
          description,
          eventType,
          deadline: finalDeadline,
        }
      });
      toast.success("Evento criado com sucesso!");
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar evento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
        <ArrowLeft className="size-4" /> Voltar
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Nova Eventualidade</CardTitle>
          <CardDescription>o modo de registrar posso mudar a qulaquer momento só não posso auterar o registro salvo com dados ja resistrado lembrando que depois posso apagar as eventulidades</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Título do Evento</Label>
              <Input
                placeholder="Ex: Entrega de Trabalho, Kit Lanche..."
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Turma</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={classId}
                onChange={e => setClassId(e.target.value)}
              >
                <option value="">Selecione a turma...</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Marcação</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={eventType}
                onChange={e => setEventType(e.target.value as any)}
              >
                <option value="boolean">Certo / Errado (Check)</option>
                <option value="numeric">Nota / Valor Numérico</option>
                <option value="status">Recebido / Pendente</option>
                <option value="custom">Personalizado (Texto)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Prazo</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={deadlineType === 'none' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDeadlineType('none')}
                >
                  Sem prazo
                </Button>
                <Button
                  type="button"
                  variant={deadlineType === 'today' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDeadlineType('today')}
                >
                  Para hoje
                </Button>
                <Button
                  type="button"
                  variant={deadlineType === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDeadlineType('custom')}
                >
                  Escolher data
                </Button>
              </div>
              {deadlineType === 'custom' && (
                <Input
                  type="date"
                  className="mt-2"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Descrição (Opcional)</Label>
              <Textarea
                placeholder="Detalhes sobre o que está sendo registrado..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Criando..." : "Criar Lista"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function EventDetail({ event, onBack }: { event: any; onBack: () => void }) {
  const qc = useQueryClient();
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  
  useUnsavedChanges(isDirty);

  const studentsQ = useQuery({
    queryKey: ["students", event.school_id, event.class_id],
    queryFn: () => listStudentsByClass(event.school_id, event.class_id),
  });

  const recordsQ = useQuery({
    queryKey: ["eventuality-records", event.id],
    queryFn: async () => {
      const data = await getEventualityRecords({ data: { eventualityId: event.id } });
      const initialValues: Record<string, any> = {};
      data.forEach(r => {
        initialValues[r.student_id] = r.value;
      });
      setValues(initialValues);
      return data;
    },
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises = Object.entries(values).map(([studentId, value]) =>
        saveEventualityRecord({
          data: {
            eventualityId: event.id,
            studentId,
            value,
          }
        })
      );
      await Promise.all(promises);
      toast.success("Dados salvos!");
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ["eventuality-records", event.id] });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja apagar este evento e todos os seus registros?")) return;
    try {
      await deleteEventuality({ data: { id: event.id } });
      toast.success("Evento removido.");
      onBack();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover.");
    }
  };

  const renderInput = (studentId: string) => {
    const val = values[studentId];

    switch (event.event_type) {
      case 'boolean':
        return (
          <Button
            size="sm"
            variant={val === true ? "default" : "outline"}
            className="size-8 p-0"
            onClick={() => {
              setValues(prev => ({ ...prev, [studentId]: !prev[studentId] }));
              setIsDirty(true);
            }}
          >
            {val === true ? <CheckCircle2 className="size-5" /> : <Plus className="size-4" />}
          </Button>
        );
      case 'numeric':
        return (
          <Input
            type="number"
            className="w-20 h-8 text-center"
            value={val ?? ""}
            onChange={e => {
              setValues(prev => ({ ...prev, [studentId]: e.target.value }));
              setIsDirty(true);
            }}
          />
        );
      case 'status':
        return (
          <Button
            size="sm"
            variant={val === 'recebido' ? 'default' : val === 'pendente' ? 'destructive' : 'outline'}
            className="px-2 h-8 text-[10px] uppercase font-bold"
            onClick={() => {
              const next = val === 'recebido' ? 'pendente' : val === 'pendente' ? null : 'recebido';
              setValues(prev => ({ ...prev, [studentId]: next }));
              setIsDirty(true);
            }}
          >
            {val || "—"}
          </Button>
        );
      default:
        return (
          <Input
            className="h-8 text-sm"
            value={val ?? ""}
            placeholder="..."
            onChange={e => {
              setValues(prev => ({ ...prev, [studentId]: e.target.value }));
              setIsDirty(true);
            }}
          />
        );
    }
  };

  if (studentsQ.isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="size-4" /> Voltar
        </Button>
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="size-4" />
          </Button>
          <Button onClick={handleSave} size="sm" className="gap-2" disabled={saving || !isDirty}>
            <Save className="size-4" /> Salvar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">{event.title}</CardTitle>
          {event.description && <CardDescription>{event.description}</CardDescription>}
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="size-3" /> Criado em: {new Date(event.created_at).toLocaleDateString()}</span>
            {event.deadline && <span className="flex items-center gap-1"><Clock className="size-3" /> Prazo: {new Date(event.deadline).toLocaleDateString()}</span>}
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Estudante</th>
                  <th className="px-4 py-2 text-center font-medium w-32">Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {studentsQ.data?.sort((a,b) => a.name.localeCompare(b.name)).map(student => (
                  <tr key={student.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2 font-medium">{student.name}</td>
                    <td className="px-4 py-2 flex justify-center">{renderInput(student.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
