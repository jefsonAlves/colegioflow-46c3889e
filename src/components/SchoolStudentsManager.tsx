import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, ArrowRightLeft, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/States";
import { StudentSearchInput, matchesInitial } from "@/components/StudentSearchInput";
import { listStudents, updateStudent } from "@/lib/students";
import { listClasses } from "@/lib/classes";
import { moveStudentsToClass } from "@/lib/studentMovement";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function SchoolStudentsManager({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const studentsQ = useQuery({
    queryKey: ["students-all", schoolId],
    queryFn: () => listStudents(schoolId),
    staleTime: 30_000,
  });
  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
    staleTime: 30_000,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterClass, setFilterClass] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [target, setTarget] = useState("");
  const [moving, setMoving] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [editName, setEditName] = useState("");

  const classMap = useMemo(
    () => Object.fromEntries((classesQ.data ?? []).map((c) => [c.id, `${c.name} (${c.year})`])),
    [classesQ.data],
  );

  const students = useMemo(() => {
    const list = studentsQ.data ?? [];
    return list.filter((s) => {
      if (filterClass && s.classId !== filterClass) return false;
      if (filter.trim() && !matchesInitial(s.name, filter)) return false;
      return true;
    });
  }, [studentsQ.data, filter, filterClass]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const move = async () => {
    if (!target || selected.size === 0) return;
    setMoving(true);
    try {
      const n = await moveStudentsToClass(Array.from(selected), target);
      toast.success(`${n} aluno(s) movido(s).`);
      setSelected(new Set());
      setTarget("");
      qc.invalidateQueries({ queryKey: ["students-all", schoolId] });
      qc.invalidateQueries({ queryKey: ["students-counts", schoolId] });
      qc.invalidateQueries({ queryKey: ["students", schoolId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao mover alunos.");
    } finally {
      setMoving(false);
    }
  };

  const saveEdit = async () => {
    if (!editing || !editName.trim()) return;
    try {
      await updateStudent(schoolId, editing.id, { name: editName.trim() });
      toast.success("Nome atualizado!");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["students-all", schoolId] });
      qc.invalidateQueries({ queryKey: ["students", schoolId] });
      qc.invalidateQueries({ queryKey: ["students-counts", schoolId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao atualizar nome.");
    }
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
        <Users className="size-4" /> Alunos da escola
      </h3>
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              className="h-10 rounded-md border bg-background px-2 text-sm"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
            >
              <option value="">Todas as turmas</option>
              {(classesQ.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.year})
                </option>
              ))}
            </select>
            <StudentSearchInput value={filter} onChange={setFilter} />
          </div>

          {selected.size > 0 && (
            <div className="rounded-lg border p-2 flex items-center gap-2 bg-primary/5">
              <span className="text-xs font-medium">{selected.size} selecionado(s)</span>
              <select
                className="flex-1 h-9 rounded-md border bg-background px-2 text-sm"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Mover para...</option>
                {(classesQ.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.year})
                  </option>
                ))}
              </select>
              <Button size="sm" disabled={!target || moving} onClick={move}>
                <ArrowRightLeft className="size-3.5" /> Mover
              </Button>
            </div>
          )}

          {studentsQ.isLoading ? (
            <Loading />
          ) : students.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum aluno.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-1">
              {students.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  <span className="flex-1 truncate">{s.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground mr-1">
                      {classMap[s.classId] ?? "sem turma"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0 hover:bg-primary/10 text-primary"
                      onClick={(e) => {
                        e.preventDefault();
                        setEditing(s);
                        setEditName(s.name);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar Aluno</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do Aluno</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={saveEdit}>Salvar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}