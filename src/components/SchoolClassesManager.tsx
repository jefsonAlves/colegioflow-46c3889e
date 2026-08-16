import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Trash2, Plus, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading, EmptyState } from "@/components/States";
import { listClasses, deleteClass, createClass } from "@/lib/classes";
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

  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear());

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
                <Input size="sm" placeholder="Ex: 1º Ano A" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Série</Label>
                <Input size="sm" placeholder="Ex: 1º Ano" value={newGrade} onChange={e => setNewGrade(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ano Letivo</Label>
              <Input
                type="number"
                size="sm"
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
                    <div className="text-[11px] text-muted-foreground truncate">
                      {c.gradeLevel ? `${c.gradeLevel} · ` : ""}{c.year}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="size-8 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleting({ id: c.id, name: c.name })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
