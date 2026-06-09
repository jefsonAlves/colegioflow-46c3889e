import { useEffect, useState } from "react";
import { ArrowRight, Building2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loading } from "@/components/States";
import {
  createSchool,
  findSimilarSchools,
  searchSchoolsByPrefix,
} from "@/lib/schools";
import type { SchoolDoc } from "@/lib/types";

interface Props {
  onSelect: (schoolId: string) => void;
  onCancel?: () => void;
  saving?: boolean;
  isMaster: boolean;
  createdBy: string;
}

export function SchoolPicker({ onSelect, onCancel, saving, isMaster, createdBy }: Props) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SchoolDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [similar, setSimilar] = useState<SchoolDoc[]>([]);
  const [confirmCreate, setConfirmCreate] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchSchoolsByPrefix(term, 20);
        setResults(r);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const startCreate = async () => {
    setNewName(term);
    setCreating(true);
    const sim = await findSimilarSchools(term);
    setSimilar(sim);
    setConfirmCreate(sim.length === 0);
  };

  const doCreate = async () => {
    const s = await createSchool({ name: newName, createdBy, isMaster });
    onSelect(s.id);
  };

  if (creating) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Nome da escola</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          {similar.length > 0 && !confirmCreate && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Estas escolas parecem similares. É alguma delas?</p>
              <div className="space-y-2">
                {similar.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    className="w-full text-left rounded-lg border p-3 hover:bg-muted"
                  >
                    <div className="font-medium">{s.name}</div>
                    {(s.city || s.state) && (
                      <div className="text-xs text-muted-foreground">
                        {[s.city, s.state].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setConfirmCreate(true)}
              >
                Nenhuma destas — criar nova
              </Button>
            </div>
          )}
          {confirmCreate && (
            <Button
              className="w-full h-12"
              disabled={saving || newName.trim().length < 3}
              onClick={doCreate}
            >
              <Plus className="size-4" /> Criar escola
            </Button>
          )}
          <Button variant="ghost" className="w-full" onClick={() => setCreating(false)}>
            Voltar para a busca
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-2">
          <Label>Busque sua escola</Label>
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Nome da escola"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {loading ? (
          <Loading label="Buscando..." />
        ) : results.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {results.map((s) => (
              <button
                key={s.id}
                disabled={saving}
                onClick={() => onSelect(s.id)}
                className="w-full text-left rounded-lg border p-3 hover:bg-muted flex items-center gap-3"
              >
                <Building2 className="size-5 text-primary" />
                <div className="flex-1">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {s.status === "pending" ? "Aguardando aprovação" : s.status}
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : term.trim().length > 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma escola encontrada com este nome.
          </p>
        ) : null}

        {term.trim().length >= 3 && (
          <Button variant="outline" className="w-full" onClick={startCreate}>
            <Plus className="size-4" /> Criar "{term.trim()}"
          </Button>
        )}

        {onCancel && (
          <Button variant="ghost" className="w-full" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
