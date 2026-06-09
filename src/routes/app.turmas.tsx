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
  const [newStudent, setNewStudent] = useState("");
  const [adding, setAdding] = useState(false);

  const addStudent = async () => {
    if (newStudent.trim().length < 2) return;
    setAdding(true);
    try {
      await createStudent(schoolId, { name: newStudent, classId: cls.id });
      setNewStudent("");
      qc.invalidateQueries({ queryKey: ["students", schoolId, cls.id] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao adicionar aluno.");
    } finally {
      setAdding(false);
    }
  };

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
          <div className="flex gap-2">
            <Input
              placeholder="Nome do aluno"
              value={newStudent}
              onChange={(e) => setNewStudent(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addStudent()}
            />
            <Button onClick={addStudent} disabled={adding}>
              <Plus className="size-4" />
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
              </li>
            ))}
          </ul>
        )}
      </div>
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
