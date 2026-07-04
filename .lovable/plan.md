
# Plano de melhorias

Escopo grande. Divido em 6 blocos independentes, todos entregues no mesmo build.

## 1. MCP: nova tool `search_students`

Arquivo: `src/lib/mcp/tools/search-students.ts` + registro em `src/lib/mcp/index.ts`.

- Entrada (Zod): `query` (string opcional, busca por nome), `school_id` (uuid, obrigatório), `class_id` (uuid opcional), `teacher_id` (uuid opcional — filtra alunos das turmas em que o professor leciona via `class_teachers`), `limit` (1–100, default 25), `offset` (default 0).
- Usa cliente Supabase com token do usuário (RLS aplica).
- Query: `students` filtrado por `school_id`, `class_id` se fornecido, `name ilike %query%` se fornecido, join lógico com `class_teachers` quando `teacher_id`.
- Retorno: `{ students: [...], total, limit, offset, hasMore }` em `structuredContent` + `content` texto.
- Rodar `app_mcp_server--extract_mcp_manifest` após para regenerar manifest.

## 2. Relatórios muito mais completos (`src/routes/app.relatorios.tsx`)

Novo layout com filtros no topo e visão por turma expandível.

**Filtros:**
- Turma (multi-select — default: todas as minhas)
- Período: mês atual / bimestre / intervalo customizado (date range)
- Bimestre (1–4) para as notas
- Toggle: "Só minhas turmas" (default on para professor, off para admin)

**KPIs (cards no topo):** Turmas, Alunos ativos, Frequência média %, Média geral, **# alunos em atenção** (freq < 75% OU média < 6 OU sem nota lançada no bimestre).

**Por turma (cards expansíveis):**
- Barra de progresso da frequência (verde ≥85, amarelo 75–84, vermelho <75)
- Média geral por matéria (do professor)
- **Lista "Alunos que precisam de atenção"**: cada aluno mostra motivo (badges: "Freq X%", "Sem nota", "Média Y", "Z faltas sem justificativa"), com botão "Ver aluno".
- **Dias com mais faltas** (top 5 datas do período).
- Botão "Exportar CSV" por turma (frequência + notas).

Nova lib helper `src/lib/reports.ts` para consolidar os cálculos (compartilhada com o dashboard da Frequência abaixo).

## 3. Turmas: renome pessoal + edição de alunos (`src/routes/app.turmas.tsx` + migração)

Modelo "override por professor" para nome de turma sem afetar os outros.

**Migração:**
- Nova tabela `class_overrides` (`user_id`, `class_id`, `custom_name`, timestamps, PK `(user_id, class_id)`). RLS: cada usuário só lê/escreve o seu. GRANT authenticated + service_role.
- Nova tabela `student_overrides` (`user_id`, `student_id`, `custom_name`, `notes`, timestamps, PK `(user_id, student_id)`). Mesmas RLS.
- **Nome canônico**: mantém `classes.name` / `students.name`. Se um professor editar e for a **primeira alteração daquela turma no sistema** (nenhum override existente para essa turma por ninguém e ele é o criador OU admin), atualiza `classes.name` direto (formato compartilhado). Caso contrário, grava em `class_overrides` (só pra ele). Regra semelhante para aluno — a "primeira edição compartilhada" é decidida no lado do servidor por trigger/RPC `rename_class_smart(class_id, new_name)` e `rename_student_smart(student_id, new_name)`.

**UI:**
- Em cada turma: ícone lápis abre inline edit do nome. Ao salvar, toast informa "Alterado só para você" ou "Compartilhado com os outros professores".
- Na lista de alunos da turma: ícone lápis por aluno, mesma regra. Admin sempre edita o canônico.
- `listClasses`/`listStudents` fazem merge com overrides do usuário atual antes de exibir.

## 4. Frequência: dashboard, animação de sucesso, alertas de faltas, registro de conteúdo (`src/routes/app.frequencia.tsx`)

**Ao selecionar turma**, aparece painel dashboard acima da lista de chamada:
- Top 5 alunos mais faltosos (período configurável: mês/bimestre)
- Faltas **sem justificativa** por aluno com datas
- Alerta configurável: **"Limite de faltas"** por turma (`class_attendance_alerts` tabela: `class_id`, `teacher_id`, `max_absences`, `period` enum `month|bimester|year`). Alunos que atingirem/passarem viram badge vermelho "Encaminhar à secretaria" com botão que gera aviso (usa `announcements` audience=`all`, prefill do texto).
- Contador em tempo real dos ausentes do dia atual.

**Salvamento:**
- Substituir toast simples por animação: check verde animado (Framer Motion / CSS keyframes) + toast Sonner "Frequência salva com sucesso · N alunos marcados como presentes automaticamente".
- Botão "Salvar" com estado loading → success → volta ao normal em 1.5s.

**Registro de conteúdo da aula (nova aba na tela de frequência):**
- Formulário: título, descrição, objetivo, reação da turma (textarea), houve êxito? (radio: sim/parcial/não), anexo (arquivo).
- Nova tabela `class_content_logs` (`school_id`, `class_id`, `teacher_id`, `date`, `title`, `description`, `objective`, `reaction`, `success` enum, `attachment_path`, timestamps). RLS: professor lê/edita os seus; admin da escola lê todos; anexos via bucket privado `class-content` (novo, RLS espelhando).
- Lista histórica filtrável por data/turma, com botão "Baixar anexo". Admin tem visão consolidada em nova rota `/app/registros` (ou aba dentro de Relatórios).

## 5. Notas: dashboard equivalente + botão "Mais" para tipos de avaliação (`src/routes/app.notas.tsx`)

**Dashboard ao selecionar turma:**
- Top alunos com menor média, alunos sem nota lançada, distribuição de notas (histograma simples).
- Alerta configurável de média mínima (mesma ideia do de faltas — `class_grade_alerts`), com botão "Encaminhar à secretaria".

**Botão "+" ao lado das colunas de avaliação:**
- Modal: nome da avaliação (ex: "Trabalho 3"), peso, tipo. Pergunta escopo: **"Aplicar em: [esta turma] / [todas as minhas turmas]"**.
- Nova tabela `assessment_types` (`teacher_id`, `class_id` nullable — null = todas as turmas do professor, `name`, `weight`, `bimester`, timestamps). RLS por professor. `grades` ganha coluna `assessment_type_id` opcional para vincular.
- Ao criar com escopo "todas", replica registro para cada turma do professor.

## 6. Ambientes por tipo de usuário (limitações finas)

Consolidar `AppShell` + rotas para respeitar papéis:
- **Professor**: vê apenas suas turmas, seus lançamentos, seus registros de conteúdo. Não vê configurações de escola nem migração.
- **Admin da escola**: vê tudo da escola, incluindo consolidação de registros de conteúdo e alertas.
- **Pais** (se vinculado): vê apenas os próprios filhos — boletim, frequência, avisos. Sem edição.
- **Master**: mantém painel atual.

Implementação: helper `useUserScope()` centraliza `{ role, isAdmin, isTeacher, isParent, isMaster }` e cada rota usa isso para esconder botões/abas. Nada de checagem só client — RLS já garante no banco.

## Detalhes técnicos (resumo)

- **Migrations (uma só, ordenada):** `class_overrides`, `student_overrides`, `class_attendance_alerts`, `class_grade_alerts`, `class_content_logs`, `assessment_types` + coluna `grades.assessment_type_id` + RPCs `rename_class_smart`, `rename_student_smart`. Todas com GRANT + RLS + policies + `updated_at` trigger.
- **Bucket storage:** `class-content` privado, policies por `teacher_id` e admin da escola.
- **Libs novas:** `src/lib/reports.ts`, `src/lib/classOverrides.ts`, `src/lib/studentOverrides.ts`, `src/lib/attendanceAlerts.ts`, `src/lib/gradeAlerts.ts`, `src/lib/classContent.ts`, `src/lib/assessmentTypes.ts`, `src/lib/userScope.ts`.
- **MCP:** nova tool + regeneração de manifest.
- **UI:** Framer Motion já pode ser adicionado (`bun add framer-motion`) para a animação de sucesso.

## Fora de escopo (posso fazer depois)

- Push notifications reais (fica só como aviso no app).
- Exportar PDF (por ora só CSV).
- Chat em tempo real entre professor e pais.

Confirma que posso seguir com tudo isso? Se preferir, começo só pelos blocos 1–4 e deixo 5–6 para um segundo passo.
