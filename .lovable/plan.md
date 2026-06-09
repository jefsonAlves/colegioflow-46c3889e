# Plano de melhorias

## 1. Necessidades especiais do aluno
- Adicionar 2 campos em `students`: `special_needs` (boolean) e `special_needs_note` (text, opcional, ex.: "TEA", "TDAH", "Dislexia").
- Em **Turmas** (modal de alunos): cada linha ganha um botão/ícone para marcar/editar a condição (abre pequeno Dialog com switch + textarea). Alunos marcados exibem um badge discreto (ex.: ícone azul com tooltip do texto).
- Em **Frequência**: badge ao lado do nome para o professor visualizar rapidamente.

## 2. Excluir aluno
- Novo item no `DropdownMenu` de cada aluno (em Turmas): **Excluir aluno** com `AlertDialog` de confirmação.
- Função `deleteStudent(schoolId, studentId)` em `src/lib/students.ts` (chama `supabase.from("students").delete()`).
- Atenção: histórico em `attendance`, `grades`, `disciplinary` permanece (FK já é `on delete cascade` ou mantém órfão — verificar no migration e ajustar se preciso).

## 3. Horários da turma (dia da semana + horário)
- Nova tabela `class_schedules`:
  - `class_id`, `school_id`, `weekday` (0–6, 0=Dom), `start_time` (time), `end_time` (time).
  - RLS: membros da escola leem; admins/professores da turma escrevem.
- UI em **Turmas**: dentro do card de cada turma, seção "Horários" com lista + botão "Adicionar horário" (select de dia da semana + 2 inputs `time`).
- Helpers em `src/lib/classSchedules.ts`: `listSchedules`, `createSchedule`, `deleteSchedule`.

## 4. "Próxima turma de hoje" na Home / Frequência
- Na home (`app.index.tsx`) e no topo de **Frequência**: card destacando a próxima aula do dia.
- Lógica (client-side, usa relógio do aparelho):
  - Buscar todos os horários do dia atual (`weekday = hoje`) das turmas da escola onde o usuário é professor (`class_teachers`) ou admin (todas).
  - Ordenar por `start_time`; pegar a primeira cujo `end_time >= now` (ou destacar "em andamento" se `start_time <= now <= end_time`).
  - Botão "Fazer chamada agora" → navega para `/app/frequencia` com `?classId=...&date=hoje` pré-selecionado.
- Em Frequência, ler `?classId` e selecionar automaticamente.

## 5. Contagem de presentes/faltas
- No cabeçalho da lista de chamada em **Frequência**: exibir contadores ao vivo conforme o professor marca: `Presentes: X · Faltas: Y · Justificadas: Z · Total: N` (badges coloridos).
- Cálculo direto do estado `marks` (sem mudança no backend).

## Arquivos afetados
- **Migration**: adicionar colunas em `students`, criar tabela `class_schedules` com RLS + GRANTs.
- **Novos**: `src/lib/classSchedules.ts`.
- **Editados**:
  - `src/lib/students.ts` — `updateStudent` aceitar `specialNeeds`/`specialNeedsNote`; `deleteStudent`.
  - `src/routes/app.turmas.tsx` — UI de necessidades especiais, exclusão, horários.
  - `src/routes/app.frequencia.tsx` — badge, contadores, leitura do `?classId`.
  - `src/routes/app.index.tsx` — card "Próxima aula".

## Fora do escopo
- Notificações push de aula.
- Calendário visual mensal completo (a "agenda" aqui é a lista de aulas do dia + horários semanais recorrentes). Se quiser visão mensal/semanal em grade, me avise que adiciono.
- Conflito de horário entre turmas (validação).
