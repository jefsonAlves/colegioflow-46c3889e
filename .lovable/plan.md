# Plano

Quatro blocos independentes. Nada do que já funciona é removido — só ajustes e adições.

## 1. Tela de Desempenho Individual do Aluno

Nova rota `src/routes/app.desempenho.tsx` (link no menu do app, visível para professor/admin).

Fluxo:
- Seletor de escola → turma → aluno (usa `listStudentsByClass` + `StudentSearchInput`).
- Cabeçalho do aluno: nome, turma, frequência do bimestre, média atual (reaproveita `getGrades` + `getClassAttendanceAll`).
- Timeline dos registros de `student_performance_logs` (via `listPerformanceLogs`), com filtro por período (mês/bimestre/semestre).
- Formulário "Novo registro":
  - Data, desempenho (excelente/bom/regular/dificuldade), observações.
  - Campo "Conteúdo/guia do professor" (texto + seletor opcional apontando para um `class_content_logs` já registrado, gravado em `content_ref`).
  - Toggle "Precisa de adaptação (solicitação da secretaria)" → `needs_adaptation=true`.
  - Se `needs_adaptation`, campo extra "Descrição da adaptação solicitada" salvo dentro de `notes` com prefixo `[Adaptação] …` (evita nova coluna/migration).
- Ações: editar/excluir registro próprio (`deletePerformanceLog`), botão "Enviar resumo à secretaria" que usa `createAnnouncement` com `target_role: 'school_admin'` e corpo montado a partir dos últimos N registros.
- Visão da secretaria (quando `is_school_admin`): mesma tela lista todos os alunos com `needs_adaptation=true` recentes + botão "Solicitar ajuste ao professor" (announcement com `target_user_id` = professor do registro).

Sem mudanças de schema. Só componentes/route.

## 2. PWA offline completo (PC + celular) com sync automático

Hoje o projeto tem só `manifest.webmanifest` + `offlineQueue`/`offlineDrain`/`queryPersist`. Falta o service worker de app-shell.

Ações:
- Adicionar `vite-plugin-pwa` (`generateSW`, `registerType: 'autoUpdate'`, `injectRegister: null`, `devOptions.enabled: false`).
- Runtime caching:
  - HTML/navegação: `NetworkFirst` (exclui `/~oauth`, `/[.mcp]`, `/api/`).
  - Assets hasheados same-origin: `CacheFirst`.
  - Chamadas Supabase REST/Storage: `NetworkFirst` com fallback ao cache (24h) para leitura offline.
- Novo `src/lib/pwa/register.ts` — wrapper de registro com guardas obrigatórios: só registra em `PROD`, fora de iframe, hostname não é preview/lovableproject/beta, sem `?sw=off`. Nos contextos negados, chama `unregister()` das SWs existentes.
- Registro chamado uma única vez a partir de `src/routes/__root.tsx` (via `useEffect`).
- Sync automático: já existe `installOfflineDrain()` (dispara em `online`/`focus`). Complementar com listener do SW `controllerchange` → dispara `drainQueue` mais uma vez após ativação.
- Manifest: manter `display: standalone`, adicionar `id: "/"`, `dir: "ltr"`.
- Kill-switch: `?sw=off` documentado; útil se algo travar cache.
- InstallPrompt já existe — só garantir que aparece em desktop também (já cobre `beforeinstallprompt`).

Escopo do offline: leitura das telas visitadas (via `queryPersist` de 24h + cache SW) e escrita enfileirada de presença/notas (já via `offlineQueue`). Sincroniza sozinho ao voltar rede/foco/ativação do SW.

## 3. Total de alunos por turma (visual) + correções de carregamento

Em `src/routes/app.turmas.tsx`:
- Buscar contagem via uma única query `students` agrupada por `class_id` (usar `select('class_id', { count: 'exact', head: false })` em paralelo, ou `listStudentsByClass` já em cache — preferir uma consulta agregada em `src/lib/students.ts` `countStudentsBySchool(schoolId)` retornando `Record<classId, number>`).
- Card da turma: badge grande "N alunos" + barra proporcional (mín/máx da escola) para leitura visual rápida.
- Também exibir no seletor de turma em Frequência/Notas/Desempenho.

Correções de "atualização e carregamento":
- Padronizar `staleTime: 30_000` e `refetchOnWindowFocus: true` para as queries de turmas/alunos/notas/frequência.
- Invalidação explícita nos `onSuccess` que já existem (rename, criar registro etc.) por `queryClient.invalidateQueries({ queryKey: [...] })` — auditar `app.turmas.tsx`, `app.frequencia.tsx`, `app.notas.tsx`.
- Substituir spinners "pendurados" por `Skeleton` shadcn nos cards de turma/aluno.
- Botão "Atualizar" discreto no topo das telas principais chamando `queryClient.invalidateQueries()` do escopo da tela.

## 4. Alerta "aluno frequente sem notas lançadas" (não bloqueante)

Regra: para o bimestre selecionado, se um aluno tem `attendancePct >= 75` **e** `missingGrades > 0` (nenhuma das P1/P2/Ativ preenchida ou parcialmente vazia), sinalizar.

Onde aparece:
- `NotasDashboard`: novo Stat "Frequente sem nota" ao lado dos existentes, e nova seção listando esses alunos (nome + o que falta: "P1, P2").
- `app.notas.tsx`: badge amarelo ao lado do nome do aluno na tabela de lançamento quando cair na regra; tooltip "Aluno frequente sem nota lançada — verifique".
- Toast informativo (não bloqueante) ao abrir a tela de notas: "N alunos frequentes ainda sem nota neste bimestre" com botão "Ver" que rola até a seção.
- Botão "Notificar professor" (visível para admin) → `createAnnouncement` com `target_user_id` do professor da turma listando os alunos.

Implementação: derivar em `attentionReport.ts` (`row.attendancePct >= 75 && row.missingGrades > 0` já é computável com os dados atuais) — adicionar campo `frequentWithoutGrade: boolean` em `AttentionRow` e `totals.frequentWithoutGrade`. Zero migration.

## Fora do escopo

- Push notifications (web-push/FCM).
- Novas colunas em `student_performance_logs` (adaptação segue em `notes` com prefixo).
- Reescrita das RLS existentes.

## Ordem sugerida

1. Bloco 4 (rápido, só derivado).
2. Bloco 3 (contagem + refetch).
3. Bloco 1 (tela de desempenho).
4. Bloco 2 (SW/PWA) por último, para não interferir no preview durante o resto.
