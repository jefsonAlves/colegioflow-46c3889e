import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Users,
  X,
  MoreVertical,
  ArrowRightLeft,
  Trash2,
  Heart,
  Clock,
  CalendarDays,
  Pencil,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SchoolGate } from "@/components/SchoolGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loading, EmptyState } from "@/components/States";
import { useAuth } from "@/contexts/AuthContext";
import { createClass, listClasses } from "@/lib/classes";
import {
  countStudentsBySchool,
  createStudentsBulk,
  deleteStudent,
  listStudentsByClass,
  updateStudent,
  type StudentDoc,
} from "@/lib/students";
import { listClassTeachers, teachClass, untaughtClass } from "@/lib/classTeachers";
import {
  createSchedule,
  deleteSchedule,
  listSchedulesByClass,
  WEEKDAY_LABELS,
} from "@/lib/classSchedules";
import { listMyClassOverrides, renameClassSmart } from "@/lib/classOverrides";
import { listMyStudentOverrides, renameStudentSmart } from "@/lib/studentOverrides";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ClassDoc } from "@/lib/classes";

export const Route = createFileRoute("/app/turmas")({
  component: TurmasPage,
});

function TurmasPage() {
  return (
    <AppShell title="Turmas">
      <SchoolGate>{({ schoolId }) => <TurmasContent schoolId={schoolId} />}</SchoolGate>
    </AppShell>
  );
}

function TurmasContent({ schoolId }: { schoolId: string }) {
  const { firebaseUser, userDoc } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear());
  const [openClass, setOpenClass] = useState<ClassDoc | null>(null);

  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
    staleTime: 30_000,
  });
  const countsQ = useQuery({
    queryKey: ["students-counts", schoolId],
    queryFn: () => countStudentsBySchool(schoolId),
    staleTime: 30_000,
  });

  const canCreate = !!userDoc && userDoc.globalRole !== undefined;

  const save = async () => {
    if (!firebaseUser) return;
    if (newName.trim().length < 2) {
      toast.error("Nome muito curto.");
      return;
    }
    try {
      await createClass(schoolId, {
        name: newName,
        year: newYear,
        gradeLevel: newGrade.trim() || null,
        teacherUid: userDoc?.profileType === "teacher" ? firebaseUser.uid : null,
        createdBy: firebaseUser.uid,
      });
      toast.success("Turma criada!");
      setCreating(false);
      setNewName("");
      setNewGrade("");
      qc.invalidateQueries({ queryKey: ["classes", schoolId] });
      qc.invalidateQueries({ queryKey: ["students-counts", schoolId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao criar turma.");
    }
  };

  if (classesQ.isLoading) return <Loading />;
  const classes = classesQ.data ?? [];

  return (
    <>
      {canCreate && !creating && (
        <Button className="w-full" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Nova turma
        </Button>
      )}

      {creating && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="space-y-1.5">
              <Label>Nome da turma</Label>
              <Input
                placeholder="Ex.: 5º Ano A"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Série / Ano (ex.: 5º Ano, 3ª Série EM)</Label>
              <Input
                placeholder="5º Ano"
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ano letivo</Label>
              <Input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(Number(e.target.value))}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={save}>
                Criar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {classes.length === 0 ? (
        <EmptyState
          title="Nenhuma turma ainda"
          description={canCreate ? "Crie sua primeira turma acima." : "Aguarde o admin criar uma turma."}
        />
      ) : (
        <div className="space-y-2">
          {(() => {
            const counts = countsQ.data ?? {};
            const max = Math.max(1, ...Object.values(counts));
            return classes.map((c) => (
              <ClassCard
                key={c.id}
                cls={c}
                schoolId={schoolId}
                count={counts[c.id] ?? 0}
                maxCount={max}
                onOpen={() => setOpenClass(c)}
              />
            ));
          })()}
        </div>
      )}

      {openClass && (
        <ClassDetail
          cls={openClass}
          schoolId={schoolId}
          canEdit={canCreate || openClass.teacherUid === firebaseUser?.uid}
          onClose={() => setOpenClass(null)}
        />
      )}
    </>
  );
}

function ClassCard({
  cls,
  onOpen,
  count,
  maxCount,
}: {
  cls: ClassDoc;
  schoolId: string;
  onOpen: () => void;
  count: number;
  maxCount: number;
}) {
  const overridesQ = useQuery({
    queryKey: ["my-class-overrides"],
    queryFn: () => listMyClassOverrides(),
    staleTime: 60_000,
  });
  const displayName = overridesQ.data?.[cls.id] ?? cls.name;
  const pct = Math.max(6, Math.round((count / Math.max(1, maxCount)) * 100));

  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-xl border bg-card p-4 flex items-center gap-3 active:scale-[0.99]"
    >
      <div className="size-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        <Users className="size-5" />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold truncate">{displayName}</div>
          <span className="shrink-0 rounded-full bg-primary/10 text-primary text-xs font-bold px-2 py-0.5">
            {count} {count === 1 ? "aluno" : "alunos"}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary/70 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[11px] text-muted-foreground">
          {cls.gradeLevel ? `${cls.gradeLevel} · ` : ""}
          {cls.year}
        </div>
      </div>
    </button>
  );
}


function ClassDetail({
  cls,
  schoolId,
  canEdit,
  onClose,
}: {
  cls: ClassDoc;
  schoolId: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const studentsQ = useQuery({
    queryKey: ["students", schoolId, cls.id],
    queryFn: () => listStudentsByClass(schoolId, cls.id),
  });
  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
  });
  const [bulkText, setBulkText] = useState("");
  const [adding, setAdding] = useState(false);
  const [transferStudent, setTransferStudent] = useState<StudentDoc | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<StudentDoc | null>(null);
  const [editingNeeds, setEditingNeeds] = useState<StudentDoc | null>(null);
  const [renamingStudent, setRenamingStudent] = useState<StudentDoc | null>(null);
  const [renamingClass, setRenamingClass] = useState(false);
  const [renameText, setRenameText] = useState("");
  const classOverridesQ = useQuery({
    queryKey: ["my-class-overrides"],
    queryFn: () => listMyClassOverrides(),
  });
  const studentOverridesQ = useQuery({
    queryKey: ["my-student-overrides"],
    queryFn: () => listMyStudentOverrides(),
  });
  const classDisplayName = classOverridesQ.data?.[cls.id] ?? cls.name;
  const studentName = (s: StudentDoc) => studentOverridesQ.data?.[s.id] ?? s.name;

  const doRenameClass = async () => {
    const nn = renameText.trim();
    if (nn.length < 2) { toast.error("Nome muito curto."); return; }
    try {
      const scope = await renameClassSmart(cls.id, nn);
      toast.success(scope === "shared" ? "Nome alterado para todos os professores." : "Alterado só para você.");
      setRenamingClass(false);
      qc.invalidateQueries({ queryKey: ["classes", schoolId] });
      qc.invalidateQueries({ queryKey: ["my-class-overrides"] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao renomear.");
    }
  };

  const doRenameStudent = async () => {
    if (!renamingStudent) return;
    const nn = renameText.trim();
    if (nn.length < 2) { toast.error("Nome muito curto."); return; }
    try {
      const scope = await renameStudentSmart(renamingStudent.id, nn);
      toast.success(scope === "shared" ? "Nome alterado para todos os professores." : "Alterado só para você.");
      setRenamingStudent(null);
      qc.invalidateQueries({ queryKey: ["students", schoolId, cls.id] });
      qc.invalidateQueries({ queryKey: ["my-student-overrides"] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao renomear.");
    }
  };


  const addStudents = async () => {
    const raw = bulkText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    if (raw.length === 0) {
      toast.error("Digite ao menos um nome.");
      return;
    }
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const n of raw) {
      const k = n.toLocaleLowerCase("pt-BR");
      if (!seen.has(k)) {
        seen.add(k);
        unique.push(n);
      }
    }
    const existing = new Set(
      (studentsQ.data ?? []).map((s) => s.name.toLocaleLowerCase("pt-BR")),
    );
    const toInsert = unique.filter((n) => !existing.has(n.toLocaleLowerCase("pt-BR")));
    const skipped = unique.length - toInsert.length;
    if (toInsert.length === 0) {
      toast.error("Todos os nomes já existem na turma.");
      return;
    }
    toInsert.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    setAdding(true);
    try {
      await createStudentsBulk(schoolId, cls.id, toInsert);
      setBulkText("");
      qc.invalidateQueries({ queryKey: ["students", schoolId, cls.id] });
      qc.invalidateQueries({ queryKey: ["students-counts", schoolId] });
      toast.success(
        `${toInsert.length} aluno(s) adicionado(s)${skipped > 0 ? ` · ${skipped} ignorado(s)` : ""}.`,
      );
    } catch (e) {
      console.error(e);
      toast.error("Erro ao adicionar alunos.");
    } finally {
      setAdding(false);
    }
  };

  const doTransfer = async (newClassId: string) => {
    if (!transferStudent) return;
    const fromId = cls.id;
    try {
      await updateStudent(schoolId, transferStudent.id, { classId: newClassId });
      toast.success("Aluno transferido!");
      qc.invalidateQueries({ queryKey: ["students", schoolId, fromId] });
      qc.invalidateQueries({ queryKey: ["students", schoolId, newClassId] });
      qc.invalidateQueries({ queryKey: ["students-counts", schoolId] });
      setTransferStudent(null);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao transferir aluno.");
    }
  };

  const doDelete = async () => {
    if (!deletingStudent) return;
    try {
      await deleteStudent(schoolId, deletingStudent.id);
      toast.success("Aluno removido.");
      qc.invalidateQueries({ queryKey: ["students", schoolId, cls.id] });
      qc.invalidateQueries({ queryKey: ["students-counts", schoolId] });
      setDeletingStudent(null);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao remover aluno.");
    }
  };

  const otherClasses = (classesQ.data ?? []).filter((c) => c.id !== cls.id);

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl bg-card p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-lg truncate">{classDisplayName}</h3>
              <button
                onClick={() => { setRenameText(classDisplayName); setRenamingClass(true); }}
                className="text-muted-foreground hover:text-foreground"
                title="Renomear turma"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {cls.gradeLevel ? `${cls.gradeLevel} · ` : ""}{cls.year}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="size-4" />

          </Button>
        </div>

        <TeachToggle cls={cls} schoolId={schoolId} />

        <SchedulesSection cls={cls} schoolId={schoolId} canEdit={canEdit} />

        {canEdit && (
          <div className="space-y-2">
            <Label className="text-xs">
              Adicionar alunos (um por linha, ou separados por vírgula)
            </Label>
            <Textarea
              placeholder={"Maria Silva\nJoão Souza\nAna Lima"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={4}
            />
            <Button onClick={addStudents} disabled={adding} className="w-full">
              <Plus className="size-4" /> {adding ? "Adicionando..." : "Adicionar alunos"}
            </Button>
          </div>
        )}

        {studentsQ.isLoading ? (
          <Loading />
        ) : (studentsQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum aluno nesta turma.
          </p>
        ) : (
          <ul className="space-y-1">
            {studentsQ.data!.map((s, i) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-lg border p-2.5 text-sm"
              >
                <span className="text-xs text-muted-foreground w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{studentName(s)}</span>
                    {s.specialNeeds && (
                      <Heart
                        className="size-3.5 text-primary shrink-0"
                        aria-label={s.specialNeedsNote ?? "Necessidade especial"}
                      />
                    )}
                  </div>
                  {s.specialNeeds && s.specialNeedsNote && (
                    <div className="text-[11px] text-muted-foreground truncate">
                      {s.specialNeedsNote}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="size-7 p-0">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setRenameText(studentName(s)); setRenamingStudent(s); }}>
                        <Pencil className="size-4" /> Renomear aluno
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditingNeeds(s)}>
                        <Heart className="size-4" /> Necessidades especiais
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setTransferStudent(s)}
                        disabled={otherClasses.length === 0}
                      >
                        <ArrowRightLeft className="size-4" /> Transferir de turma
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingStudent(s)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4" /> Excluir aluno
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!transferStudent} onOpenChange={(o) => !o && setTransferStudent(null)}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Transferir {transferStudent?.name}</DialogTitle>
          </DialogHeader>
          {otherClasses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma outra turma disponível.
            </p>
          ) : (
            <div className="space-y-2">
              <Label>Selecione a turma de destino</Label>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {otherClasses.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => doTransfer(c.id)}
                    className="w-full text-left rounded-lg border p-3 text-sm hover:bg-accent active:scale-[0.99]"
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.gradeLevel ? `${c.gradeLevel} · ` : ""}{c.year}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferStudent(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SpecialNeedsDialog
        student={editingNeeds}
        schoolId={schoolId}
        classId={cls.id}
        onClose={() => setEditingNeeds(null)}
      />

      <AlertDialog
        open={!!deletingStudent}
        onOpenChange={(o) => !o && setDeletingStudent(null)}
      >
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aluno?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingStudent?.name} será removido permanentemente, junto com chamadas,
              notas e advertências relacionadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={renamingClass} onOpenChange={(o) => !o && setRenamingClass(false)}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Renomear turma</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input value={renameText} onChange={(e) => setRenameText(e.target.value)} placeholder="Novo nome" />
            <p className="text-xs text-muted-foreground">
              Se for a primeira alteração dessa turma, o novo nome será compartilhado com os
              outros professores. Caso contrário, será salvo apenas para você.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingClass(false)}>Cancelar</Button>
            <Button onClick={doRenameClass}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renamingStudent} onOpenChange={(o) => !o && setRenamingStudent(null)}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Renomear aluno</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input value={renameText} onChange={(e) => setRenameText(e.target.value)} placeholder="Novo nome" />
            <p className="text-xs text-muted-foreground">
              Primeira edição do aluno: nome será compartilhado. Depois disso, alterações ficam
              apenas no seu ambiente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingStudent(null)}>Cancelar</Button>
            <Button onClick={doRenameStudent}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function SpecialNeedsDialog({
  student,
  schoolId,
  classId,
  onClose,
}: {
  student: StudentDoc | null;
  schoolId: string;
  classId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [needs, setNeeds] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (student) {
      setNeeds(student.specialNeeds);
      setNote(student.specialNeedsNote ?? "");
    }
  }, [student]);



  const save = async () => {
    if (!student) return;
    setSaving(true);
    try {
      await updateStudent(schoolId, student.id, {
        specialNeeds: needs,
        specialNeedsNote: needs ? (note.trim() || null) : null,
      });
      qc.invalidateQueries({ queryKey: ["students", schoolId, classId] });
      toast.success("Atualizado.");
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && onClose()}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Necessidades especiais</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">{student?.name}</div>
              <div className="text-xs text-muted-foreground">
                Marcar deficiência ou transtorno
              </div>
            </div>
            <Switch checked={needs} onCheckedChange={setNeeds} />
          </div>
          {needs && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                Condição / observação (ex.: TEA, TDAH, dislexia)
              </Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Descrição breve"
                rows={3}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



function SchedulesSection({
  cls,
  schoolId,
  canEdit,
}: {
  cls: ClassDoc;
  schoolId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const schedulesQ = useQuery({
    queryKey: ["class-schedules", cls.id],
    queryFn: () => listSchedulesByClass(cls.id),
  });
  const [adding, setAdding] = useState(false);
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState("07:30");
  const [end, setEnd] = useState("08:20");
  const [subject, setSubject] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (end <= start) {
      toast.error("Horário de fim deve ser após o início.");
      return;
    }
    if (subject.trim().length < 2) {
      toast.error("Informe a matéria.");
      return;
    }
    setSaving(true);
    try {
      await createSchedule({
        schoolId,
        classId: cls.id,
        weekday,
        startTime: start,
        endTime: end,
        subject: subject.trim(),
      });
      qc.invalidateQueries({ queryKey: ["class-schedules", cls.id] });
      qc.invalidateQueries({ queryKey: ["class-schedules-school", schoolId] });
      setAdding(false);
      setSubject("");
      toast.success("Horário adicionado.");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao adicionar horário.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteSchedule(id);
      qc.invalidateQueries({ queryKey: ["class-schedules", cls.id] });
      qc.invalidateQueries({ queryKey: ["class-schedules-school", schoolId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao remover.");
    }
  };

  const items = schedulesQ.data ?? [];

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-4 text-primary" />
        <span className="text-sm font-medium">Meus horários nesta turma</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum horário cadastrado.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 text-sm rounded-md bg-muted/30 px-2 py-1.5"
            >
              <Clock className="size-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium w-10 shrink-0">{WEEKDAY_LABELS[s.weekday]}</span>
              <span className="text-muted-foreground tabular-nums shrink-0">
                {s.startTime}–{s.endTime}
              </span>
              {s.subject && (
                <span className="truncate text-xs font-medium ml-1">· {s.subject}</span>
              )}
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto size-7 p-0 text-destructive"
                  onClick={() => remove(s.id)}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && !adding && (
        <Button size="sm" variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Adicionar horário
        </Button>
      )}
      {canEdit && adding && (
        <div className="space-y-2 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Matéria</Label>
            <Input
              placeholder="Ex.: Matemática"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Dia da semana</Label>
            <select
              className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
            >
              {WEEKDAY_LABELS.map((l, i) => (
                <option key={i} value={i}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Início</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fim</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setAdding(false)}
            >
              Cancelar
            </Button>
            <Button size="sm" className="flex-1" onClick={add} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeachToggle({ cls, schoolId }: { cls: ClassDoc; schoolId: string }) {
  const { firebaseUser } = useAuth();
  const qc = useQueryClient();
  const teachersQ = useQuery({
    queryKey: ["class-teachers", cls.id],
    queryFn: () => listClassTeachers(cls.id),
  });
  if (!firebaseUser) return null;
  const teaching = (teachersQ.data ?? []).some((t) => t.userId === firebaseUser.uid);
  const onToggle = async () => {
    try {
      if (teaching) {
        await untaughtClass({ classId: cls.id, userId: firebaseUser.uid });
      } else {
        await teachClass({ classId: cls.id, schoolId, userId: firebaseUser.uid });
      }
      qc.invalidateQueries({ queryKey: ["class-teachers", cls.id] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao atualizar.");
    }
  };
  return (
    <div className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
      <span>Eu leciono nesta turma</span>
      <Button size="sm" variant={teaching ? "default" : "outline"} onClick={onToggle}>
        {teaching ? "Sim" : "Marcar"}
      </Button>
    </div>
  );
}
