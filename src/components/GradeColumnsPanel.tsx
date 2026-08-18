import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveSchool } from "@/hooks/useActiveSchool";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createAssessmentType,
  deleteAssessmentType,
  reorderAssessmentTypes,
  updateAssessmentType,
  type AssessmentType,
} from "@/lib/assessmentTypes";

interface Props {
  schoolId: string;
  classId: string;
  bimester: number;
  types: AssessmentType[];
}

/**
 * Lets the teacher rename, weight, reorder, add and remove the grade columns
 * of the diary (P1, P2, Ativ. are only the defaults).
 */
export function GradeColumnsPanel({ schoolId, classId, bimester, types }: Props) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftWeight, setDraftWeight] = useState(1);
  const [draftMax, setDraftMax] = useState(10);
  const { membership } = useActiveSchool();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWeight, setNewWeight] = useState(1);
  const [newMax, setNewMax] = useState(10);
  const [scope, setScope] = useState<"class" | "all">("class");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["assessment-types"] });
    qc.invalidateQueries({ queryKey: ["grade-map"] });
  };

  const startEdit = (t: AssessmentType) => {
    setEditingId(t.id);
    setDraftName(t.name);
    setDraftWeight(t.weight);
    setDraftMax(t.maxValue);
  };

  const commitEdit = async () => {
    if (!editingId) return;
    if (!draftName.trim()) {
      toast.error("Dê um nome à coluna.");
      return;
    }
    setBusy(true);
    try {
      await updateAssessmentType(editingId, {
        name: draftName,
        weight: draftWeight > 0 ? draftWeight : 1,
        maxValue: draftMax > 0 ? draftMax : 10,
      });
      setEditingId(null);
      refresh();
      toast.success("Coluna atualizada.");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao atualizar coluna.");
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...types];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    try {
      await reorderAssessmentTypes(schoolId, classId, bimester, next);
      refresh();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao reordenar.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: AssessmentType) => {
    if (!confirm(`Remover a coluna "${t.name}"? As notas lançadas nela deixam de aparecer.`)) return;
    setBusy(true);
    try {
      await deleteAssessmentType(t.id);
      refresh();
      toast.success("Coluna removida.");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao remover.");
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!newName.trim()) {
      toast.error("Dê um nome à coluna.");
      return;
    }
    setBusy(true);
    try {
      await createAssessmentType({
        schoolId,
        classId: scope === "all" ? null : classId,
        name: newName,
        weight: newWeight > 0 ? newWeight : 1,
        maxValue: newMax > 0 ? newMax : 10,
        bimester,
        position: types.length,
      });
      setNewName("");
      setNewWeight(1);
      setNewMax(10);
      setScope("class");
      setOpen(false);
      refresh();
      toast.success(scope === "all" ? "Coluna criada em todas as suas turmas." : "Coluna criada.");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao criar coluna.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Colunas do diário</h2>
            <p className="text-xs text-muted-foreground">
              Renomeie, defina peso e nota máxima ou acrescente quantas quiser.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Coluna
          </Button>
        </div>

        <ul className="space-y-1.5">
          {types.map((t, i) => {
            const canEditMax = membership?.roleInSchool === "school_admin" || membership?.roleInSchool === "master";
            return (
            <li key={t.id} className="rounded-md border bg-card px-2.5 py-2">
              {editingId === t.id ? (
                <div className="space-y-2">
                  <Input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    aria-label="Nome da coluna"
                    className="h-9"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">Peso</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min={0.5}
                        value={draftWeight}
                        onChange={(e) => setDraftWeight(Number(e.target.value) || 1)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">Máximo</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min={1}
                        value={draftMax}
                        onChange={(e) => setDraftMax(Number(e.target.value) || 10)}
                        disabled={!canEditMax}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={commitEdit} disabled={busy}>
                      <Check className="size-4" /> Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="size-4" /> Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">
                    {i + 1}.
                  </span>
                  <span className="text-sm font-medium truncate flex-1">{t.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    peso {t.weight} · máx {t.maxValue}
                  </span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={`Mover ${t.name} para a esquerda`}
                      disabled={busy || i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp className="size-3.5 rotate-[-90deg]" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={`Mover ${t.name} para a direita`}
                      disabled={busy || i === types.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown className="size-3.5 rotate-[-90deg]" />
                    </Button>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label={`Renomear ${t.name}`}
                    onClick={() => startEdit(t)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive"
                    aria-label={`Remover ${t.name}`}
                    disabled={busy}
                    onClick={() => remove(t)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </li>
            );
          })}
        </ul>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova coluna de nota</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Trabalho, Recuperação, Participação"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Peso</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min={0.5}
                    value={newWeight}
                    onChange={(e) => setNewWeight(Number(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label>Nota máxima</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min={1}
                    value={newMax}
                    onChange={(e) => setNewMax(Number(e.target.value) || 10)}
                  />
                </div>
              </div>
              <div>
                <Label>Aplicar em</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setScope("class")}
                    className={`h-10 rounded-md border text-sm ${scope === "class" ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}
                  >
                    Só esta turma
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope("all")}
                    className={`h-10 rounded-md border text-sm ${scope === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}
                  >
                    Todas as minhas turmas
                  </button>
                </div>
              </div>
              <div>
                <Label>Nota máxima</Label>
                <Input
                  type="number"
                  step="0.5"
                  min={1}
                  disabled={membership?.roleInSchool !== "school_admin" && membership?.roleInSchool !== "master"}
                  value={newMax}
                  onChange={(e) => setNewMax(Number(e.target.value) || 10)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={add} disabled={busy}>
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
