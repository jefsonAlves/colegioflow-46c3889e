## Objetivo

Reorganizar o fluxo de dados por perfil (escola × professor), permitir que a escola gerencie alunos/turmas/professores de forma centralizada, e que atestados registrados pela secretaria reflitam automaticamente como falta justificada. Também melhorar sincronização e visualização.

## Blocos

### 1. Cadastro de alunos compartilhado por escola (não por professor)
Hoje cada professor lida com sua turma. Vamos deixar explícito que **alunos pertencem à escola** e ficam disponíveis para todos os professores da mesma escola.

- Em `app.escola.tsx` (secretaria/admin): nova aba "Alunos da escola" com CRUD central, busca, filtro por turma/série/modalidade e ação em massa "mover para turma".
- Em `app.turmas.tsx` (professor): botão "Adicionar aluno" passa a abrir um seletor com **alunos já cadastrados na escola** + opção "criar novo". Evita duplicidade.
- Regras compartilhadas × pessoais:
  - **Dados do aluno** (nome, série, modalidade, laudo) → compartilhado (escola).
  - **Notas e frequência** → permanecem **por professor + turma** (cada professor tem seu diário; nada muda no fluxo atual).
- Ajuste em `src/lib/students.ts`: `listStudentsBySchool(schoolId)` já existe via `countStudentsBySchool` — expor `listAllStudentsBySchool` com paginação e filtros.

### 2. Modalidade/etapa da instituição e do professor
Escolas de anos iniciais têm um professor polivalente; escolas de fundamental II/médio têm professor por disciplina. Precisamos representar isso.

- Novos campos:
  - `schools.stages` (array): `["infantil","fund1","fund2","medio","eja"]` — o que a escola atende.
  - `classes.stage` (enum) e `classes.modality` (`regular` | `eja` | `integral`).
  - `class_teachers.subject` (texto opcional; vazio = polivalente/todas as matérias).
  - `students.stage` espelha a turma mas pode ser sobrescrito individualmente (ex.: aluno multisseriado).
- UI:
  - Em `app.escola.tsx`: seleção das etapas atendidas (marcadores).
  - Em `app.turmas.tsx`: ao criar/editar turma, escolher etapa/modalidade; ao vincular professor, escolher disciplina ou "todas".
  - Em Notas/Frequência: se professor for polivalente, mostra seletor de disciplina no topo do diário (Português/Matemática/…); se for por disciplina, fixa a dele.

### 3. Atestado → falta justificada automática
Hoje justificar é manual no diário. Vamos ligar atestado da secretaria à frequência.

- Nova tabela `student_certificates`: `student_id`, `school_id`, `start_date`, `end_date`, `reason`, `attachment_url` (bucket `class-content`), `created_by`.
- Ao inserir um atestado, um trigger/serverFn (`applyCertificateToAttendance`):
  - Para cada dia no intervalo em que já existe registro `F`, converte para `J` (justificada).
  - Para dias futuros, marca automaticamente `J` quando o professor abrir o diário (fallback client-side lê `student_certificates` no `getClassAttendanceAll` e sugere `J` como default, mostrando ícone "atestado" — professor ainda pode alterar).
- UI:
  - Em `app.escola.tsx` → aba "Atestados": lista, upload PDF/imagem, gera log.
  - Em `app.frequencia.tsx`: badge "Atestado vigente (dd/mm–dd/mm)" ao lado do aluno; célula `J` fica com tooltip do motivo.
- RLS: secretaria (school_admin) grava; professor lê apenas dos alunos das suas turmas.

### 4. Remanejamento de alunos e professores pela escola
- Em `app.escola.tsx` → aba "Turmas & pessoas":
  - Tabela de alunos com seletor "mover para turma X" (bulk).
  - Tabela de professores com "atribuir/remover de turma" e "disciplina".
- ServerFns: `moveStudentsToClass(studentIds, classId)`, `assignTeacherToClass(userId, classId, subject)`.
- Preserva histórico: registro em `student_class_history` (nova tabela: `student_id`, `from_class_id`, `to_class_id`, `moved_at`, `moved_by`) para o boletim manter o vínculo do bimestre anterior.

### 5. Fluxo de acesso por perfil (afinar RLS + UI)
Padronizar quem enxerga o quê, e esconder ações que o usuário não pode executar (evita erro 401 na UI).

| Ação | Master | Secretaria (school_admin) | Professor | Responsável |
|---|---|---|---|---|
| CRUD escola | ✓ | ✓ (a sua) | — | — |
| CRUD aluno | ✓ | ✓ | criar + editar nome (sugestão) | — |
| Mover aluno / trocar turma | ✓ | ✓ | — | — |
| Atestado | ✓ | ✓ | ver | ver do filho |
| Diário (nota/frequência) | ver | ver | CRUD nas suas turmas | ver do filho |
| Relatórios/boletim | ✓ | ✓ | suas turmas | filho |
| Avisos direcionados | ✓ | ✓ | sua turma | ver |

- `has_role`/`is_school_admin`/`is_class_teacher` já cobrem — vamos revisar cada policy das tabelas listadas e alinhar com a matriz acima; policies antigas que permitem "authenticated" amplo serão restritas.
- No frontend: hook `usePermissions()` consumido pelas telas para esconder botões que o backend recusaria.

### 6. Visualização e sincronização
- `NotasDashboard` e `app.turmas.tsx`: adicionar filtros por etapa/modalidade/disciplina.
- Padronizar `staleTime: 30s`, `refetchOnWindowFocus: true`, e broadcast via Supabase Realtime nos canais `students:school_id`, `attendance:class_id`, `grades:class_id` para atualizar entre abas/dispositivos sem F5.
- Skeleton loaders substituem spinners longos; botão "Atualizar agora" em cada tela.
- Indicador global "Sincronizado há Xs" no `AppShell` (usa `OfflineStatus` existente).

## Ordem de execução
1. Bloco 5 (RLS/permissões) — base segura.
2. Bloco 1 (alunos por escola) + Bloco 2 (etapas/disciplinas) — migração + UI escola.
3. Bloco 3 (atestados → J).
4. Bloco 4 (remanejamento + histórico).
5. Bloco 6 (realtime + UI final).

## Detalhes técnicos (resumido)
- Migrações: `schools.stages`, `classes.stage`/`modality`, `class_teachers.subject`, `student_certificates`, `student_class_history`, funções `apply_certificate_to_attendance(certificate_id)`, `move_students_to_class(...)`, revisão de policies.
- Novos arquivos: `src/lib/certificates.ts`, `src/lib/studentMovement.ts`, `src/lib/realtime.ts`, `src/hooks/usePermissions.ts`, aba `SchoolStudentsTab.tsx`, `SchoolCertificatesTab.tsx`, `SchoolStaffTab.tsx`.
- Sem quebrar telas atuais: os campos novos são opcionais com defaults sensatos (`stage='fund1'`, `modality='regular'`).

## Perguntas antes de implementar
1. Quando a secretaria remaneja um aluno **no meio do bimestre**, as notas já lançadas devem: (a) ir junto com o aluno para a nova turma, (b) ficar na turma antiga como histórico e a nova começa em branco, ou (c) o sistema pergunta a cada movimentação?
2. Atestado retroativo cobrindo dias em que o professor marcou `P` (presente por engano) — devemos sobrescrever para `J` ou apenas sinalizar conflito para a secretaria revisar?