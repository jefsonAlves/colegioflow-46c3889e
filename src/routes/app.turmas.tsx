import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Users, X, MoreVertical, ArrowRightLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SchoolGate } from "@/components/SchoolGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loading, EmptyState } from "@/components/States";
import { useAuth } from "@/contexts/AuthContext";
import { createClass, listClasses } from "@/lib/classes";
import { createStudentsBulk, listStudentsByClass, updateStudent, type StudentDoc } from "@/lib/students";
import { listClassTeachers, teachClass, untaughtClass } from "@/lib/classTeachers";
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
  });

  // Any school member can create classes (RLS enforces it).
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
          {classes.map((c) => (
            <ClassCard key={c.id} cls={c} schoolId={schoolId} onOpen={() => setOpenClass(c)} />
          ))}
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
  schoolId,
  onOpen,
}: {
  cls: ClassDoc;
  schoolId: string;
  onOpen: () => void;
}) {
  const studentsQ = useQuery({
    queryKey: ["students", schoolId, cls.id],
    queryFn: () => listStudentsByClass(schoolId, cls.id),
  });

  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-xl border bg-card p-4 flex items-center gap-3 active:scale-[0.99]"
    >
      <div className="size-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        <Users className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{cls.name}</div>
        <div className="text-xs text-muted-foreground">
          {cls.year} · {(studentsQ.data ?? []).length} aluno(s)
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

  const addStudents = async () => {
    const raw = bulkText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    if (raw.length === 0) {
      toast.error("Digite ao menos um nome.");
      return;
    }
    // dedupe within input (case-insensitive)
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const n of raw) {
      const k = n.toLocaleLowerCase("pt-BR");
      if (!seen.has(k)) {
        seen.add(k);
        unique.push(n);
      }
    }
    // dedupe vs existing
    const existing = new Set(
      (studentsQ.data ?? []).map((s) => s.name.toLocaleLowerCase("pt-BR")),
    );
    const toInsert = unique.filter((n) => !existing.has(n.toLocaleLowerCase("pt-BR")));
    const skipped = unique.length - toInsert.length;
    if (toInsert.length === 0) {
      toast.error("Todos os nomes já existem na turma.");
      return;
    }
    // sort alphabetically pt-BR
    toInsert.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    setAdding(true);
    try {
      await createStudentsBulk(schoolId, cls.id, toInsert);
      setBulkText("");
      qc.invalidateQueries({ queryKey: ["students", schoolId, cls.id] });
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
      setTransferStudent(null);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao transferir aluno.");
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
          <div>
            <h3 className="font-bold text-lg">{cls.name}</h3>
            <p className="text-xs text-muted-foreground">
              {cls.gradeLevel ? `${cls.gradeLevel} · ` : ""}{cls.year}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <TeachToggle cls={cls} schoolId={schoolId} />

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
                <span className="flex-1">{s.name}</span>
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="size-7 p-0">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setTransferStudent(s)}
                        disabled={otherClasses.length === 0}
                      >
                        <ArrowRightLeft className="size-4" /> Transferir de turma
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
