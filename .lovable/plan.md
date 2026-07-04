# Plano — Notas com dash, offline/PWA, boletim PDF, MCP e segurança

Vou implementar em 6 blocos. Cada bloco é independente e pode ser revisado.

## 1. Painel-dash em Notas (por turma / bimestre / semestre)

Novo componente `NotasDashboard` no topo de `app.notas.tsx`, ligado à turma selecionada:

- Filtro de período: **Bimestre (1–4)** ou **Semestre (1–2)**. Semestre = média ponderada dos 2 bimestres correspondentes.
- Cards:
  - Média geral da turma, % de aprovados (≥6), % em recuperação (4–5.9), % reprovando (<4).
  - **Alunos em atenção**: nota <6 em qualquer avaliação OU sem nota lançada OU frequência abaixo do limite do alerta da turma.
  - Distribuição por matéria/avaliação (barras simples com CSS).
- Cada aluno em atenção mostra: motivo (nota baixa / sem nota / faltas), professores responsáveis (via `class_teachers`) e público-alvo do alerta (professor, coordenação, secretaria).
- Botão **"Notificar responsáveis"** cria um `announcement` direcionado (ver bloco 5 sobre destinatários).

## 2. Exportação e compartilhamento do resumo de atenção

- Novo `src/lib/attentionReport.ts` que consolida por turma:
  - Faltas sem justificativa (do período).
  - Alunos sem notas lançadas.
  - Alunos com frequência < limite configurado (`class_attendance_alerts`).
- Botões no dash de Notas e no dash de Frequência:
  - **Exportar CSV** (download direto — `/mnt`-style client blob).
  - **Exportar PDF** (usando `jspdf` + `jspdf-autotable`, já adequado a Worker/edge — roda no cliente).
  - **Enviar à secretaria/admin**: cria `announcement` com `target_role='school_admin'` anexando o resumo textual.

## 3. Notas — UX melhorada

- **Filtro por iniciais**: input de busca acima da lista de alunos (client-side, `startsWith` case-insensitive + normalização de acentos).
- **Soma automática das notas do bimestre**: já existe `calcMedia`; adiciono badge de "soma parcial" ao lado da média (P1+P2+Ativ. + avaliações extras do `assessment_types`).
- **Saneamento no salvar**: se o valor digitado for inválido (`", "`, `"11"`, `"-2"`, `"1,2,3"`), clamp para 0–10 e substitui vírgula por ponto. Salva sempre em formato padrão.
- **Editar depois de salvar**: os inputs continuam editáveis; toast de "Atualizado" no re-save; log em `grades.updated_by/updated_at`.
- **Suporte a semestre**: prop `period: 'bimester'|'semester'` no dash — as notas continuam sendo salvas por bimestre; semestre é derivado.

## 4. MCP `search_students` — cursor, ordenação e busca parcial

Atualizar `src/lib/mcp/tools/search-students.ts`:

- Input adicional: `sort` (`name_asc`|`name_desc`|`created_desc`), `query` (busca parcial `ilike %q%`), `cursor` (base64 de `{ lastSortValue, lastId }`), `limit` (default 20, max 100).
- Filtros mantidos: `school_id`, `class_id`, `teacher_id` (via `class_teachers`).
- Paginação estável: keyset em `(sort_column, id)` — evita duplicações quando alunos são inseridos entre páginas.
- Retorna `{ items, nextCursor, hasMore }`. `offset/total` marcados como deprecated mas ainda aceitos.
- Atualizar `.lovable/mcp/manifest.json`.

## 5. Notificações direcionadas

Migration adiciona a `announcements`:
- `target_user_id uuid null` (aluno/professor específico)
- `target_role text null` (`teacher`|`school_admin`|`parent`)
- `target_class_id uuid null`

Atualiza políticas RLS para: usuário vê o aviso se for autor, ou target_user_id = auth.uid(), ou target_role bate com sua role no `school_memberships`, ou é membro da `target_class_id`. Escola continua vendo o que ela mesma enviou. Corrige o problema de "todo mundo vê tudo".

## 6. Boletim em PDF (`app.boletim.tsx`)

- Botões: **Baixar boletim individual** e **Baixar boletim geral (turma)**.
- Usa `jspdf` + `autotable`: cabeçalho com escola/turma/ano, tabela com bimestres × matérias (média), coluna Frequência (% presença + total de faltas), média final e situação (APR/REC/REP).
- A secretaria (perfil `school_admin`) tem botão extra "**Solicitar revisão ao professor**" por aluno → gera `announcement` direcionado ao(s) professor(es) da turma com o motivo digitado.

## 7. Desempenho individual + laudos/adaptação

Nova tabela `student_profiles_extra`:
- `student_id`, `has_disability boolean`, `disability_notes text`, `accommodation_request text`, `requested_by uuid`, `updated_at`.

Nova tabela `student_performance_logs`:
- `student_id`, `teacher_id`, `class_id`, `date`, `content_ref` (id opcional de `class_content_logs`), `performance` (`excelente|bom|regular|dificuldade`), `notes text`, `needs_adaptation boolean`.

No dash de Notas e no perfil do aluno:
- **Badge de alerta** quando `has_disability` OU `accommodation_request` presentes — visível para os professores da turma e para admin. Texto: "Este aluno tem adaptação solicitada".
- Botão "Registrar desempenho" abre modal (ligado opcionalmente ao último `class_content_logs`).

Secretaria pode editar `student_profiles_extra`; professor só lê.

## 8. Offline + PWA + sincronização

- Ativar PWA via `vite-plugin-pwa` (`generateSW`, `registerType: autoUpdate`) seguindo o skill/pwa: registro guardado (nunca em preview/iframe), `NetworkFirst` para navegações, `CacheFirst` só para assets hasheados, kill-switch `?sw=off`.
- Manifest com nome "Colégio em Movimento", ícones, `display: standalone`, theme color.
- **Banner "Instalar app"** (`InstallPrompt`) escutando `beforeinstallprompt` (Android/desktop) + instrução iOS "Adicionar à tela inicial" via `<ClientOnly>`.
- **Fila de sincronização offline**:
  - Novo `src/lib/offlineQueue.ts` usando IndexedDB (via `idb`).
  - Wrappers `queueAttendance()`, `queueGrade()`, `queueContentLog()` que:
    - Tentam salvar direto quando `navigator.onLine`.
    - Se falhar/offline, enfileiram com timestamp + payload + tabela alvo.
  - Worker de sync no cliente: on `online` e a cada foco de janela, drena a fila em ordem, respeitando idempotência (upsert por `(class_id, student_id, date)` para frequência, por `(class_id, student_id, bimester, tipo)` para notas).
  - Badge "N alterações pendentes" no `AppShell`.
- **Leitura offline**: React Query com `persistQueryClient` (localStorage) para turmas/alunos/notas/frequência do professor. TTL de 24h.

## 9. Segurança (correções sem quebrar nada)

- Revisar RLS de `announcements` (bloco 5) para evitar leitura cruzada.
- `student_overrides` / `class_overrides`: garantir política `USING (auth.uid() = user_id)`.
- `student_profiles_extra`: SELECT restrito a professores da turma + admin da escola; UPDATE só admin.
- `student_performance_logs`: SELECT para professor autor + admin da escola + professores da mesma turma; INSERT só professor da turma.
- Rodar `security--run_security_scan` no fim e corrigir apenas achados novos introduzidos por esta mudança (sem tocar em código existente que funciona).
- MCP: validar `limit` (1..100) e sanitizar `query` (`ilike` com escape de `%` e `_`) para evitar wildcard injection.

## Detalhes técnicos

Novos/alterados:

```text
src/lib/
  offlineQueue.ts            # IndexedDB + drain worker
  attentionReport.ts         # CSV + PDF + payload de anúncio
  pdf/boletim.ts             # jsPDF + autotable
  studentExtras.ts           # CRUD de laudos/adaptação
  performanceLogs.ts         # CRUD
src/components/
  NotasDashboard.tsx
  StudentFilterInput.tsx
  InstallPrompt.tsx
  PendingSyncBadge.tsx
src/routes/
  app.notas.tsx              # + dash + filtro por iniciais + editar/salvar padrão
  app.boletim.tsx            # + PDF individual/geral
  app.relatorios.tsx         # + exportações e envio à secretaria
  __root.tsx                 # + registro PWA guardado + persistQueryClient
public/
  manifest.webmanifest       # atualizado
  sw-register.ts             # wrapper com guardas
vite.config.ts               # + VitePWA
.lovable/mcp/manifest.json   # search_students v2
src/lib/mcp/tools/search-students.ts  # cursor + ilike + sort
```

Migrations:
1. `announcements`: colunas `target_user_id`, `target_role`, `target_class_id` + novas policies.
2. `student_profiles_extra` (com GRANTs + RLS + policies).
3. `student_performance_logs` (com GRANTs + RLS + policies).
4. `grades`: `updated_by uuid`, trigger `touch_updated_at`.

Dependências novas (via `bun add`): `vite-plugin-pwa`, `workbox-window`, `idb`, `jspdf`, `jspdf-autotable`, `@tanstack/react-query-persist-client`, `@tanstack/query-sync-storage-persister`.

## Fora do escopo

- Push notifications (FCM) — só o app instalável e sync offline.
- Reconhecimento por voz para frequência.
- App nativo (Capacitor).

## Ordem sugerida de implementação

1. Bloco 4 (MCP) — isolado, rápido.
2. Blocos 1+2+3 (Notas dash + export + UX).
3. Bloco 5 (notificações direcionadas) + 9 (segurança) — juntos, mesma área.
4. Bloco 6+7 (Boletim PDF + laudos/desempenho).
5. Bloco 8 (PWA/offline) por último, para não interferir na iteração.

Confirma que sigo nessa ordem?
