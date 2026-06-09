## Objetivos

1. **Frequência**: dropdown "Turma" mostra só as turmas que o professor logado leciona; ao salvar, alunos sem marcação viram automaticamente "P".
2. **Modelo per-teacher**: cada professor escolhe (no cadastro/perfil) quais turmas da escola atende e cadastra seus próprios horários + matérias. Apenas o **nome dos alunos** é compartilhado entre professores da mesma turma. Frequência, notas e advertências passam a ser por professor.

---

## 1. Frequência (`src/routes/app.frequencia.tsx`)

- Buscar `listMyTaughtClasses(userId)` e usar como base do dropdown (intersect com `listClasses(schoolId)` para nome/ano).
- Se a lista vazia: estado "Você ainda não leciona nenhuma turma" + link para Turmas/Perfil.
- Em `save()`: para cada aluno em `studentsQ.data` que **não** tem entrada em `marks`, gravar `status: "P"` antes do insert. Adicionar texto auxiliar abaixo do botão: "Alunos sem marcação serão salvos como Presente".
- Manter o filtro de data já existente; o filtro principal agora é o professor.

## 2. Cadastro de matérias e horários por professor

### Schema (migration)

- **Nova coluna em `class_schedules`**:
  - `teacher_id uuid` (FK `auth.users.id`, NOT NULL após backfill) — dono do horário.
  - `subject text NOT NULL DEFAULT ''` — matéria da aula.
- **Backfill**: setar `teacher_id = created_by` nos registros existentes.
- **RLS de `class_schedules`**: ajustar política de SELECT para permitir que membros da escola vejam todos (necessário para o card "Próxima aula"), mas INSERT/UPDATE/DELETE só pelo `teacher_id = auth.uid()`.
- **`class_teachers`**: já existe; nenhum schema change. É a tabela onde o professor "escolhe" as turmas que leciona (toggle no Perfil).
- **`attendance`**: já tem `recorded_by`. Adicionar política para que cada professor leia/edite apenas as linhas onde `recorded_by = auth.uid()` (mantendo admin com acesso total). Isso garante que duas chamadas no mesmo dia (profs diferentes) não se sobreponham.
  - Ajustar `setAttendance` em `src/lib/attendance.ts`: deletar apenas onde `recorded_by = current user` antes do insert (em vez de apagar tudo).
  - `getAttendance` passa a filtrar por `recorded_by = current user`.
- **`grades` e `disciplinary`**: já têm `created_by`. Adicionar políticas de leitura/escrita por dono (admin mantém tudo). Atualizar funções de listagem para filtrar por `created_by = auth.uid()` quando o usuário não for admin.

### Tela "Turmas" (`src/routes/app.turmas.tsx`)

- Adicionar campo **"Matéria"** (input texto) ao formulário de novo horário e exibi-lo na lista de horários.
- Atualizar `src/lib/classSchedules.ts`: tipos `subject`, `teacherId`; helpers passam `teacher_id` e `subject` no insert. `listSchedulesByClass` filtra por `teacher_id = current user` (cada prof vê só seus horários); `listSchedulesBySchool` mantém todos (para card "Próxima aula" do admin) **mas** o card já filtra por `teacherId === current user` quando for professor.
- Seção "Turmas que leciono" (já existe via `class_teachers`): garantir que o professor possa marcar/desmarcar livremente.

### Tela "Perfil" (`src/routes/app.perfil.tsx`)

- Nova seção **"Minhas turmas e horários"**: lista as turmas da escola com checkbox; ao marcar, chama `teachClass`; ao desmarcar, `untaughtClass`. Atalho para abrir a turma e cadastrar horários/matéria.

### `NextClassCard.tsx`

- Quando o usuário não é admin, filtrar `schedules` por `teacherId === user.id`. Mostrar a matéria junto do nome da turma ("Matemática · 5º Ano A").

---

## Detalhes técnicos

```text
class_schedules (após migration)
├── id, school_id, class_id
├── teacher_id  ← NOVO (auth.uid)
├── subject     ← NOVO (texto)
├── weekday, start_time, end_time
```

- Migration usa o padrão de 4 passos para qualquer GRANT necessário; políticas atuais são alteradas via `DROP POLICY` + `CREATE POLICY`.
- Sem mudanças no `students` (modelo "só nomes compartilhados" já é o comportamento atual da tabela `students`, que é school-scoped sem dados sensíveis por professor).
- Atendimento à regra "duas chamadas diferentes no mesmo dia": viabilizado porque `attendance` passa a ser indexada implicitamente por `recorded_by` via RLS — cada professor vê apenas as próprias linhas.

## Arquivos afetados

- **Migração nova**: alterações em `class_schedules`, `attendance`, `grades`, `disciplinary` (policies).
- **Modificados**: `src/lib/classSchedules.ts`, `src/lib/attendance.ts`, `src/lib/grades.ts`, `src/lib/disciplinary.ts`, `src/routes/app.frequencia.tsx`, `src/routes/app.turmas.tsx`, `src/routes/app.perfil.tsx`, `src/components/NextClassCard.tsx`.

## Fora do escopo

- Migração retroativa de chamadas antigas para um professor específico (ficam atribuídas ao `recorded_by` original).
- UI de relatórios consolidados entre professores (mantém o que existe hoje, mas agora filtrado por dono).
