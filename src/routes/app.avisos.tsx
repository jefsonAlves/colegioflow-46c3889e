import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Megaphone, Plus, Trash2, X, Users, School } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SchoolGate } from "@/components/SchoolGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loading, EmptyState } from "@/components/States";
import { useAuth } from "@/contexts/AuthContext";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  listReadIds,
  markRead,
  type Audience,
} from "@/lib/announcements";
import { listClasses } from "@/lib/classes";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/avisos")({
  component: AvisosPage,
});

function AvisosPage() {
  return (
    <AppShell title="Avisos">
      <SchoolGate>{({ schoolId }) => <AvisosContent schoolId={schoolId} />}</SchoolGate>
    </AppShell>
  );
}

const AUDIENCE_LABEL: Record<Audience, string> = {
  all: "Todos",
  parents: "Pais",
  teachers: "Professores",
};

function AvisosContent({ schoolId }: { schoolId: string }) {
  const { firebaseUser, userDoc } = useAuth();
  const qc = useQueryClient();
  const [composing, setComposing] = useState(false);

  const listQ = useQuery({
    queryKey: ["announcements", schoolId],
    queryFn: () => listAnnouncements(schoolId),
  });

  const readsQ = useQuery({
    queryKey: ["ann-reads", firebaseUser?.uid],
    queryFn: () => listReadIds(firebaseUser!.uid),
    enabled: !!firebaseUser,
  });

  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
  });

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`announcements:${schoolId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements", filter: `school_id=eq.${schoolId}` },
        () => qc.invalidateQueries({ queryKey: ["announcements", schoolId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [schoolId, qc]);

  // Auto-mark all currently visible items as read after first render
  const items = listQ.data ?? [];
  const readIds = readsQ.data ?? new Set<string>();
  useEffect(() => {
    if (!firebaseUser) return;
    const unread = items.filter((a) => !readIds.has(a.id));
    if (unread.length === 0) return;
    (async () => {
      for (const a of unread) {
        try {
          await markRead(a.id);
        } catch {
          // ignore
        }
      }
      qc.invalidateQueries({ queryKey: ["ann-reads", firebaseUser.uid] });
      qc.invalidateQueries({ queryKey: ["unread-ann", schoolId, firebaseUser.uid] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, readIds.size]);

  const canCompose = userDoc?.profileType !== "parent";

  const classMap = useMemo(
    () => Object.fromEntries((classesQ.data ?? []).map((c) => [c.id, c.name])),
    [classesQ.data],
  );

  return (
    <>
      {canCompose && !composing && (
        <Button className="w-full" onClick={() => setComposing(true)}>
          <Plus className="size-4" /> Novo aviso
        </Button>
      )}

      {composing && (
        <Composer
          schoolId={schoolId}
          onDone={() => {
            setComposing(false);
            qc.invalidateQueries({ queryKey: ["announcements", schoolId] });
          }}
          onCancel={() => setComposing(false)}
        />
      )}

      {listQ.isLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nenhum aviso ainda"
          description={canCompose ? "Crie o primeiro aviso acima." : "Aguarde comunicados da escola."}
        />
      ) : (
        <div className="space-y-2">
          {items.map((a) => {
            const isUnread = !readIds.has(a.id);
            const isMine = a.authorId === firebaseUser?.uid;
            return (
              <Card key={a.id} className={isUnread ? "border-primary/40 bg-primary/5" : ""}>
                <CardContent className="pt-4 pb-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    {a.classId ? (
                      <Users className="size-3.5 text-secondary-foreground" />
                    ) : (
                      <School className="size-3.5 text-primary" />
                    )}
                    <span className="text-muted-foreground truncate">
                      {a.classId ? (classMap[a.classId] ?? "Turma") : "Escola toda"} ·{" "}
                      {AUDIENCE_LABEL[a.audience]}
                    </span>
                    <span className="ml-auto text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold flex items-center gap-2">
                        {a.title}
                        {isUnread && (
                          <span className="rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 font-bold">
                            NOVO
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>
                    </div>
                    {isMine && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="size-7 p-0 text-destructive shrink-0"
                        onClick={async () => {
                          if (!confirm("Excluir este aviso?")) return;
                          try {
                            await deleteAnnouncement(a.id);
                            toast.success("Aviso removido.");
                            qc.invalidateQueries({ queryKey: ["announcements", schoolId] });
                          } catch (e) {
                            console.error(e);
                            toast.error("Erro ao remover.");
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function Composer({
  schoolId,
  onDone,
  onCancel,
}: {
  schoolId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [audience, setAudience] = useState<Audience>("all");
  const [saving, setSaving] = useState(false);

  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
  });

  const save = async () => {
    if (title.trim().length < 2 || body.trim().length < 2) {
      toast.error("Preencha título e mensagem.");
      return;
    }
    setSaving(true);
    try {
      await createAnnouncement({
        schoolId,
        classId: classId || null,
        audience,
        title,
        body,
      });
      toast.success("Aviso enviado!");
      onDone();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao enviar aviso.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="size-4 text-primary" />
          <span className="font-semibold">Novo aviso</span>
          <Button size="sm" variant="ghost" className="ml-auto size-7 p-0" onClick={onCancel}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Reunião de pais" />
        </div>
        <div className="space-y-1.5">
          <Label>Mensagem</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Escopo</Label>
            <select
              className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">Escola toda</option>
              {(classesQ.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Público</Label>
            <select
              className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
            >
              <option value="all">Todos</option>
              <option value="parents">Pais</option>
              <option value="teachers">Professores</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={save} disabled={saving}>
            {saving ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
