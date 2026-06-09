import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Database, Play, RefreshCw, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyMigration,
  planMigration,
  scanLegacy,
  type ApplyResult,
  type Op,
  type ScanReport,
} from "@/lib/migration";

export const Route = createFileRoute("/app/master/migracao")({
  component: MigrationPage,
});

function MigrationPage() {
  const { userDoc } = useAuth();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [ops, setOps] = useState<Op[] | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (userDoc && userDoc.globalRole !== "master") navigate({ to: "/app" });
  }, [userDoc, navigate]);

  if (!userDoc || userDoc.globalRole !== "master") return null;

  const doScan = async () => {
    setScanning(true);
    try {
      const r = await scanLegacy();
      setReport(r);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao escanear bancos.");
    } finally {
      setScanning(false);
    }
  };

  const doPlan = async () => {
    setPlanning(true);
    try {
      const o = await planMigration();
      setOps(o);
      toast.success(`${o.length} operações planejadas.`);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar plano.");
    } finally {
      setPlanning(false);
    }
  };

  const doApply = async () => {
    if (!ops) return;
    setApplying(true);
    try {
      const r = await applyMigration(ops);
      setResult(r);
      toast.success(`Migração: ${r.applied}/${r.total}`);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao executar.");
    } finally {
      setApplying(false);
      setConfirm(false);
    }
  };

  const opCounts = ops
    ? ops.reduce<Record<string, number>>((acc, o) => {
        acc[o.type] = (acc[o.type] ?? 0) + 1;
        return acc;
      }, {})
    : null;

  return (
    <AppShell title="Migração de dados">
      <Card className="border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20">
        <CardContent className="pt-4 pb-4 flex gap-3 text-sm">
          <ShieldAlert className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <p>
            Esta ferramenta mescla os dados existentes do app antigo (RTDB +
            Firestore) com o novo modelo. Sempre execute o <b>Dry-run</b> antes
            do <b>Executar</b>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Database className="size-4 text-primary" /> 1. Escanear bancos
          </h2>
          <Button onClick={doScan} disabled={scanning} className="w-full">
            <RefreshCw className={`size-4 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Escaneando..." : "Escanear RTDB + Firestore"}
          </Button>
          {report && (
            <div className="space-y-3 text-xs">
              <div>
                <div className="font-medium mb-1">Realtime Database (top-level)</div>
                <pre className="bg-muted rounded p-2 overflow-x-auto">
                  {JSON.stringify(report.rtdb, null, 2)}
                </pre>
              </div>
              <div>
                <div className="font-medium mb-1">Firestore (coleções)</div>
                <pre className="bg-muted rounded p-2 overflow-x-auto max-h-80">
                  {JSON.stringify(report.firestore, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <h2 className="font-semibold">2. Dry-run (planejar)</h2>
          <Button
            onClick={doPlan}
            disabled={planning}
            variant="outline"
            className="w-full"
          >
            {planning ? "Gerando..." : "Gerar plano sem escrever"}
          </Button>
          {opCounts && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(opCounts).map(([k, v]) => (
                  <div key={k} className="rounded border p-2 text-center">
                    <div className="text-lg font-bold text-primary">{v}</div>
                    <div className="text-xs text-muted-foreground">{k}</div>
                  </div>
                ))}
              </div>
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Ver operações em JSON
                </summary>
                <pre className="bg-muted rounded p-2 overflow-x-auto max-h-80 text-xs">
                  {JSON.stringify(ops, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <h2 className="font-semibold">3. Executar migração</h2>
          {!confirm ? (
            <Button
              onClick={() => setConfirm(true)}
              disabled={!ops || ops.length === 0}
              className="w-full"
              variant="destructive"
            >
              <Play className="size-4" /> Executar {ops?.length ?? 0} operações
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                Confirmar gravação de <b>{ops?.length}</b> operações? Esta ação
                grava em <code>users</code>, <code>schools</code>,{" "}
                <code>school_memberships</code> e <code>migration_runs</code>.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirm(false)}
                  disabled={applying}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={doApply}
                  disabled={applying}
                >
                  {applying ? "Executando..." : "Sim, executar"}
                </Button>
              </div>
            </div>
          )}
          {result && (
            <pre className="bg-muted rounded p-2 overflow-x-auto text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
