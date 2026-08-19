import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardCheck,
  NotebookPen,
  Users,
  FileText,
  AlertOctagon,
  BarChart3,
  Building2,
  ChevronRight,
  Activity,
  ListTodo,
  Megaphone,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { NextClassCard } from "@/components/NextClassCard";
import { SchoolGate } from "@/components/SchoolGate";
import { TipsTour } from "@/components/TipsTour";
import { SchoolUsageSummary } from "@/components/SchoolUsageSummary";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { listAnnouncements, listReadIds } from "@/lib/announcements";
import { motion, AnimatePresence } from "framer-motion";


export const Route = createFileRoute("/app/")({
  component: AppHome,
});

interface Action {
  to: "/app/frequencia" | "/app/notas" | "/app/turmas" | "/app/boletim" | "/app/advertencias" | "/app/relatorios" | "/app/desempenho" | "/app/eventualidades" | any;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: "primary" | "secondary" | "accent";
}

const ACTIONS: Action[] = [
  { to: "/app/frequencia", label: "Frequência", description: "Fazer chamada", icon: ClipboardCheck, accent: "primary" },
  { to: "/app/notas", label: "Notas", description: "Lançar notas", icon: NotebookPen, accent: "secondary" },
  { to: "/app/turmas", label: "Turmas", description: "Configurar turmas e horários", icon: Users, accent: "primary" },
  { to: "/app/desempenho", label: "Desempenho", description: "Registro individual", icon: Activity, accent: "accent" },
  { to: "/app/boletim", label: "Boletim", description: "Fechamento do bimestre", icon: FileText, accent: "secondary" },
  { to: "/app/advertencias", label: "Advertências", description: "Registrar ocorrências", icon: AlertOctagon, accent: "accent" },
  { to: "/app/relatorios", label: "Relatórios", description: "Desempenho dos alunos", icon: BarChart3, accent: "primary" },
  { to: "/app/eventualidades", label: "Crie seus Eventos Rápidos", description: "Listas e eventos", icon: ListTodo, accent: "secondary" },
  { to: "/app/pedagogico", label: "Gestão Pedagógica", description: "Dossiês e notificações", icon: Shield, accent: "accent" },
];

function accentClasses(a: Action["accent"]) {
  switch (a) {
    case "secondary":
      return "bg-secondary/15 text-secondary-foreground border-secondary/30";
    case "accent":
      return "bg-accent/15 text-accent-foreground border-accent/30";
    default:
      return "bg-primary/10 text-primary border-primary/20";
  }
}

function AppHome() {
  const { userDoc } = useAuth();
  if (!userDoc) return null;

  const fullName = userDoc.name ?? "";
  const title = `Olá, Professor(a) ${fullName}`;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <AppShell title={title} back={false}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        <SchoolGate>
          {({ schoolId }) => (
            <>
              <motion.div variants={itemVariants}>
                <NextClassCard schoolId={schoolId} />
              </motion.div>

              <motion.div variants={itemVariants}>
                <TipsTour
                  audience={
                    userDoc.globalRole === "master"
                      ? "master"
                      : userDoc.profileType === "school_admin"
                        ? "school_admin"
                        : "teacher"
                  }
                />
              </motion.div>

              {userDoc.profileType === "school_admin" && (
                <motion.div variants={itemVariants}>
                  <SchoolUsageSummary schoolId={schoolId} compact />
                </motion.div>
              )}

              <motion.section variants={itemVariants} className="space-y-1.5">
                <p className="text-xs uppercase tracking-wider font-bold text-primary/80">
                  {userDoc.profileType === "school_admin"
                    ? "Painel Administrativo"
                    : userDoc.profileType === "parent"
                      ? "Acompanhamento escolar"
                      : "Painel do Professor"}
                </p>
                <h2 className="text-2xl font-extrabold tracking-tight">O que você quer fazer hoje?</h2>
              </motion.section>

              <section className="grid grid-cols-2 gap-3">
                {ACTIONS.map((a, index) => {
                  const Icon = a.icon;
                  return (
                    <motion.div key={a.to} variants={itemVariants}>
                      <Link to={a.to} className="group">
                        <Card className="h-full overflow-hidden transition-all duration-300 active:scale-[0.96] hover:scale-[1.02] hover:border-primary/50 shadow-sm hover:shadow-xl border-muted/50 bg-card/50 backdrop-blur-sm relative group">
                          <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <CardContent className="pt-6 pb-5 flex flex-col gap-3 items-start min-h-[140px] relative z-10">
                            <div className={`size-12 rounded-2xl border flex items-center justify-center ${accentClasses(a.accent)} transition-all duration-500 group-hover:rotate-6 group-hover:shadow-lg group-hover:shadow-primary/20`}>
                              <Icon className="size-6" />
                            </div>
                            <div className="space-y-1">
                              <div className="font-bold text-lg leading-tight tracking-tight">{a.label}</div>
                              <div className="text-xs text-muted-foreground font-medium leading-relaxed">{a.description}</div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  );
                })}
              </section>

              <motion.section variants={itemVariants} className="space-y-2">
                <AvisosLink schoolId={schoolId} />

                {userDoc.profileType === "school_admin" && (
                  <Link to="/app/escola">
                    <Card className="transition-all duration-300 active:scale-[0.98] border-muted/50 shadow-sm hover:shadow-xl hover:border-primary/50 group overflow-hidden relative">
                      <div className="absolute inset-0 bg-linear-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <CardContent className="pt-5 pb-5 flex items-center gap-4 relative z-10">
                        <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg group-hover:shadow-primary/10">
                          <Building2 className="size-6" />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-lg leading-tight">Minha escola</div>
                          <div className="text-xs text-muted-foreground font-medium">
                            Aprovar professores, configurar dados
                          </div>
                        </div>
                        <ChevronRight className="size-6 text-muted-foreground group-hover:text-primary transition-colors group-hover:translate-x-1 duration-300" />
                      </CardContent>
                    </Card>
                  </Link>
                )}
              </motion.section>
            </>
          )}
        </SchoolGate>
      </motion.div>
    </AppShell>
  );
}

function AvisosLink({ schoolId }: { schoolId: string }) {
  const { firebaseUser } = useAuth();
  const listQ = useQuery({
    queryKey: ["announcements", schoolId],
    queryFn: () => listAnnouncements(schoolId),
  });
  const readsQ = useQuery({
    queryKey: ["ann-reads", firebaseUser?.uid],
    queryFn: () => listReadIds(firebaseUser!.uid),
    enabled: !!firebaseUser,
  });
  const items = listQ.data ?? [];
  const reads = readsQ.data ?? new Set<string>();
  const unread = items.filter((a) => !reads.has(a.id)).length;
  return (
    <Link to="/app/avisos">
      <Card className="transition-all duration-300 active:scale-[0.98] border-muted/50 shadow-sm hover:shadow-xl hover:border-primary/50 group overflow-hidden relative">
        <div className="absolute inset-0 bg-linear-to-r from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardContent className="pt-5 pb-5 flex items-center gap-4 relative z-10">
          <div className="size-12 rounded-2xl bg-accent/15 text-accent-foreground flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg group-hover:shadow-accent/10">
            <Megaphone className="size-6" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-lg leading-tight flex items-center gap-2">
              Avisos
              {unread > 0 && (
                <span className="rounded-full bg-primary text-primary-foreground text-[10px] px-2 py-0.5 font-black shadow-lg shadow-primary/20">
                  {unread}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Comunicados da escola e turmas</div>
          </div>
          <ChevronRight className="size-6 text-muted-foreground group-hover:text-accent-foreground transition-colors group-hover:translate-x-1 duration-300" />
        </CardContent>
      </Card>
    </Link>
  );
}
