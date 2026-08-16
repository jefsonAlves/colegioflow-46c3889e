import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Trash2, Plus, UserPlus, FileUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading, EmptyState } from "@/components/States";
import { listClasses, deleteClass, createClass, updateClass } from "@/lib/classes";
import { listStudents, createStudent, createStudentsBulk, updateStudent } from "@/lib/students";
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
import { useAuth } from "@/contexts/AuthContext";

export function SchoolClassesManager({ schoolId }: { schoolId: string }) {
  const { firebaseUser } = useAuth();
  const qc = useQueryClient();
  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
    staleTime: 30_000,
  });

  const studentsQ = useQuery({
    queryKey: ["students-all", schoolId],
    queryFn: () => listStudents(schoolId),
    staleTime: 30_000,
  });

  const studentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (studentsQ.data ?? []).forEach((s) => {
      counts[s.classId] = (counts[s.classId] || 0) + 1;
    });
    return counts;
  }, [studentsQ.data]);

  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [addingStudent, setAddingStudent] = useState<{ id: string; name: string } | null>(null);
  const [editingClass, setEditingClass] = useState<{ id: string; name: string; gradeLevel: string | null; year: number } | null>(null);
  const [editingStudent, setEditingStudent] = useState<{ id: string; name: string; classId: string } | null>(null);
  
  const [newName, setNewName] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear());

  const [studentName, setStudentName] = useState("");
  const [bulkImport, setBulkImport] = useState(false);
  const [bulkList, setBulkList] = useState("");

  const [editName, setEditName] = useState("");
  const [editGrade, setEditGrade] = useState("");
  const [editYear, setEditYear] = useState(0);

  const doDelete = async () => {
    if (!deleting) return;
    try {
      await deleteClass(schoolId, deleting.id);
      toast.success("Turma excluída com sucesso.");
      qc.invalidateQueries({ queryKey: ["classes", schoolId] });
      setDeleting(null);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao excluir turma.");
    }
  };

  const doCreate = async () => {
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

  const doAddStudent = async () => {
    if (!firebaseUser || !addingStudent) return;
    
    try {
      if (bulkImport) {
        const names = bulkList
          .split("\n")
          .map((n) => n.trim())
          .filter((n) => n.length > 2);
        
        if (names.length === 0) {
          toast.error("Insira ao menos um nome.");
          return;
        }

        await createStudentsBulk(schoolId, addingStudent.id, names, firebaseUser.uid);
        toast.success(`${names.length} alunos importados!`);
      } else {
        if (studentName.trim().length < 2) {
          toast.error("Nome muito curto.");
          return;
        }
        await createStudent(schoolId, {
          name: studentName.trim(),
          classId: addingStudent.id,
          createdBy: firebaseUser.uid,
        });
        toast.success("Aluno cadastrado!");
      }

      setAddingStudent(null);
      setStudentName("");
      setBulkList("");
      qc.invalidateQueries({ queryKey: ["students-all", schoolId] });
      qc.invalidateQueries({ queryKey: ["students", schoolId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao cadastrar aluno.");
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Users className="size-4" /> Gestão de Turmas
        </h3>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreating(true)}>
          <Plus className="size-3.5 mr-1" /> Nova Turma
        </Button>
      </div>

      {creating && (
        <Card className="mb-3">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input placeholder="Ex: 1º Ano A" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Série</Label>
                <Input placeholder="Ex: 1º Ano" value={newGrade} onChange={e => setNewGrade(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ano Letivo</Label>
              <Input
                type="number"
                value={newYear}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewYear(val === "" ? 0 : Number(val));
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setCreating(false)}>Cancelar</Button>
              <Button size="sm" className="flex-1" onClick={doCreate}>Criar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4 pb-4">
          {classesQ.isLoading ? (
            <Loading />
          ) : (classesQ.data ?? []).length === 0 ? (
            <EmptyState title="Nenhuma turma" />
          ) : (
            <div className="space-y-1">
              {(classesQ.data ?? []).map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
                      {c.gradeLevel ? `${c.gradeLevel} · ` : ""}{c.year}
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {studentCounts[c.id] || 0} alunos
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-8 p-0 text-primary hover:bg-primary/10"
                      onClick={() => setAddingStudent({ id: c.id, name: c.name })}
                    >
                      <UserPlus className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-8 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleting({ id: c.id, name: c.name })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!addingStudent} onOpenChange={(o) => !o && setAddingStudent(null)}>
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cadastrar Alunos</AlertDialogTitle>
            <AlertDialogDescription>
              Adicione alunos à turma "{addingStudent?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-4 text-sm font-medium">
              <button 
                className={`pb-1 border-b-2 transition-colors ${!bulkImport ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                onClick={() => setBulkImport(false)}
              >
                Individual
              </button>
              <button 
                className={`pb-1 border-b-2 transition-colors ${bulkImport ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                onClick={() => setBulkImport(true)}
              >
                Importar Lista
              </button>
            </div>

            {bulkImport ? (
              <div className="space-y-2">
                <Label className="text-xs">Lista de Nomes (um por linha)</Label>
                <textarea
                  className="w-full min-h-[150px] rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Nome do Aluno 1&#10;Nome do Aluno 2&#10;Nome do Aluno 3"
                  value={bulkList}
                  onChange={(e) => setBulkList(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs">Nome do Aluno</Label>
                <Input
                  placeholder="Nome completo"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doAddStudent}>
              {bulkImport ? (
                <><FileUp className="size-4 mr-2" /> Importar</>
              ) : (
                <><Plus className="size-4 mr-2" /> Cadastrar</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir turma permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              A turma "{deleting?.name}" será removida da escola. Isso afetará todos os professores e registros vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}