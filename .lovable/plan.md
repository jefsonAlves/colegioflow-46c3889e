## Objetivo

Ajustar o fluxo de escolas, papéis e dar ao Master (jefson.ti@gmail.com) uma ferramenta para importar dados externos (alunos, frequências, notas) e compartilhar alunos entre professores da mesma série.

## 1. Escola criada pelo professor fica ATIVA automaticamente

Hoje: escola criada por não-master entra como `pending`.
Novo:
- Toda escola criada entra como `active`, independente de quem criou.
- O criador (professor) recebe automaticamente uma membership `school_admin` com status `approved` (vira admin da escola).
- Apenas o Master pode rebaixar/remover esse admin (nenhum outro school_admin pode revogar).

Mudanças:
- `src/lib/schools.ts` → `createSchool` sempre grava `status: 'active'`.
- `createSchool` passa a também criar a membership `school_admin/approved` do criador na mesma chamada (RPC ou duas inserts).
- Migration: política em `school_memberships` que impede `UPDATE/DELETE` de membership `school_admin` por outro school_admin — só Master ou o próprio usuário pode alterar. (`USING is_master(auth.uid()) OR user_id = auth.uid()` para delete; para downgrade de role, idem.)

## 2. Aceite de novos administradores da escola

- Professor pede vínculo como `school_admin` → fica `pending`.
- Qualquer school_admin já aprovado pode aprovar (fluxo atual já permite via RLS).
- Só o Master pode desqualificar (revogar) um school_admin existente — ver política acima.

UI:
- `src/routes/app.escola.tsx` (tela do admin da escola): lista pendentes, botão Aprovar/Rejeitar. Para admins existentes, mostrar botão "Remover" apenas se `userDoc.globalRole === 'master'`.

## 3. Ambiente completo do admin da escola

Garantir que o admin da escola tenha acesso real a todas as funcionalidades já existentes:
- `/app/escola` (gestão da escola, membros, aprovações)
- `/app/turmas`, `/app/notas`, `/app/frequencia`, `/app/boletim`, `/app/advertencias`, `/app/avisos`, `/app/relatorios`

Hoje várias destas telas mostram "ComingSoon" ou estão vazias. Vamos ativar pelo menos:
- Turmas: listar/criar/editar turmas da escola, vincular alunos e professores.
- Membros (em `/app/escola`): listar professores, aprovar pendentes, ver papéis.
- Demais telas: garantir que o menu não fique morto — onde já há lógica, conectar; onde não, deixar placeholder funcional ligado às tabelas existentes.

(Sem expandir escopo das features de pais/atividades/calendário deste plano — esses ficam para iteração seguinte conforme combinado antes.)

## 4. Ambiente Master: importação de banco externo (API key)

Nova aba em `/app/master`: "Importar dados externos".

Fluxo:
1. Master cola um endpoint base + API key de um sistema externo (ex.: outro sistema da escola, planilha publicada como API, etc.).
2. Master escolhe a escola e turma de destino (ou cria nova).
3. Sistema busca: alunos, frequências, notas.
4. Faz upsert por `(school_id, external_id)` em `students`, `attendance`, `grades`.
5. Mostra preview antes de gravar; relatório do que foi criado/atualizado/ignorado.

Implementação:
- Secret novo: o Master grava a API key via UI → enviada para uma **server function** protegida (`requireSupabaseAuth` + checagem `is_master`). Nunca expor a key no cliente.
- Server function `importExternal.functions.ts`:
  - lê `process.env.EXTERNAL_IMPORT_BASE_URL` e a key passada pelo Master (ou armazenada via secret se for fixa);
  - faz `fetch` no endpoint;
  - usa `supabaseAdmin` para upsert.
- Migration: adicionar coluna `external_id text` (nullable, único por escola) em `students`, `attendance`, `grades` para permitir upsert idempotente.
- UI: formulário com campos (Base URL, API key, escola alvo, turma/série), botão "Pré-visualizar" e "Importar".

Pergunta pendente: o endpoint externo é um sistema específico (qual?) ou genérico/configurável? Por padrão vou implementar genérico — JSON com forma documentada na própria tela.

## 5. Compartilhar alunos com professores da mesma série

Hoje cada `student` pertence a uma `class` (turma). Para compartilhar:
- Nova tabela `class_teachers (class_id, user_id, role, created_at)` ligando professores a turmas.
- Quando um professor (incluindo o Master enquanto professor) der aula para uma turma, ele se vincula como teacher daquela turma e ganha acesso de leitura aos alunos/notas/frequências daquela turma via RLS:
  - Policy `students SELECT`: school member OR `EXISTS class_teachers WHERE class_id = students.class_id AND user_id = auth.uid()`.
- "Mesma série": dois professores que lecionam turmas com o mesmo `grade_level` (campo `series`/`year` em `classes`) podem ver a lista de nomes dos alunos das outras turmas da mesma série na mesma escola (apenas nomes — sem notas/frequência), via uma view `same_grade_students` ou RLS adicional restrita a colunas (`GRANT SELECT(id, name, class_id) ...`).

UI:
- Em `/app/turmas`, professor pode marcar "leciono nesta turma" → cria `class_teachers`.
- Em uma nova aba "Colegas de série", lista alunos das outras turmas da mesma série/escola (read-only, só nome).

## Resumo técnico das mudanças

```text
DB migration:
  - schools: createSchool default status='active'
  - school_memberships: policy bloqueando alteração de school_admin por não-Master
  - students/attendance/grades: + external_id (text, indexed)
  - nova tabela class_teachers (+ RLS + GRANTs)
  - RLS students: liberar SELECT para class_teachers
  - (opcional) view same_grade_students

Código:
  - src/lib/schools.ts: createSchool ativa + cria membership admin
  - src/routes/app.escola.tsx: aprovações + remoção de admin só pelo Master
  - src/routes/app.master.tsx: nova aba "Importar dados"
  - src/lib/import.functions.ts: server fn protegida com requireSupabaseAuth + is_master
  - src/routes/app.turmas.tsx: gestão de class_teachers + aba "Colegas de série"
```

## Perguntas antes de implementar

1. O sistema externo a importar é um específico (me passe a URL/documentação) ou implemento um importador genérico de JSON com schema documentado na tela?
2. "Compartilhar com professores da mesma série": eles devem ver só o **nome** dos alunos, ou também notas/frequência?
3. Quando o Master remover um school_admin, ele deve virar `teacher` aprovado, ou ser totalmente desvinculado da escola?
