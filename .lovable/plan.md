## Diagnóstico (estado atual no banco)

- **Jefson (jefson.ti@gmail.com)** já tem `globalRole = master` ✅, mas no CEF15 está como `teacher / pending`. Como ele criou a escola antes da regra de bootstrap automática, ele **nunca virou school_admin aprovado** — por isso o painel `/app/escola` aparece vazio ("Você não administra nenhuma escola") e ele não consegue aprovar o funcionário.
- **CEF15** já está com `status = active` ✅ (a tela só parece "inativa" porque ninguém aparece como admin).
- **Admin CEF15 (jefson.s.a7@gmail.com)** está com pedido `school_admin / pending` aguardando aprovação — ninguém pode aprovar hoje, porque não existe school_admin aprovado e o painel Master não lista pedidos de membros.
- **Importação** hoje só faz match por `external_id`; sem ele, sempre cria um aluno novo. Não existe `matricula` na tabela `students`. A prévia atual só mostra um JSON cru, sem distinguir "vai vincular" × "vai criar".

## O que será feito

### 1. Auto‑promover criador da escola a school_admin aprovado (retroativo)
- Migration única: para toda escola, se o `created_by` não tiver membership `school_admin/approved`, **inserir/atualizar** para `school_admin / approved` (resolve o CEF15 + Jefson agora e qualquer escola futura criada antes do fix).
- Mantém `createSchool` bootstrapando admin aprovado (já feito).

### 2. Painel Master também aprova pedidos de school_admin
- Em `/app/master`, adicionar seção **"Pedidos de administrador de escola"** listando todos `school_memberships` com `role_in_school = school_admin` e `status = pending`, com botões Aprovar/Rejeitar.
- RLS: permitir que `is_master(auth.uid())` faça `UPDATE` em `school_memberships` (hoje a policy só cobre o próprio school_admin aprovando outros).
- Isso aprova o pedido do funcionário do CEF15 mesmo se o admin local não fizer.

### 3. Painel da escola: ativar fluxo de funcionário pendente
- `/app/escola` já lista pendentes — depois da migração (1), Jefson verá o CEF15 e poderá aprovar o funcionário direto.
- Adicionar coluna de papel ao aprovar (teacher / school_admin) já que o pedido vem com `role_in_school` definido — apenas exibir corretamente (já está OK no código).

### 4. Importação: matrícula + prévia real

**Schema:**
- Adicionar coluna `matricula text` a `public.students` + índice único parcial `(school_id, matricula)` quando matricula não é nula. Mantém `external_id` como fallback.

**Server function `previewExternalData` (nova) + `importExternalData` (ajustada):**
- Aceita payload `{ students:[{matricula?, external_id?, name, ...}], attendance:[...], grades:[...] }`.
- Para cada aluno do payload, classifica:
  - **match** se acha aluno existente na escola por (a) `matricula` igual, (b) `external_id` igual, ou (c) nome normalizado idêntico — nessa ordem.
  - **new** caso contrário.
- `previewExternalData` retorna listas: `studentsToLink[]`, `studentsToCreate[]`, `attendanceToApply[]` (com indicação de match), `gradesToApply[]`, e contagem de órfãos (sem aluno correspondente).
- `importExternalData` reusa a mesma classificação e:
  - Para alunos com match → `UPDATE` (preenche `matricula`/`external_id` faltantes, atualiza `class_id` opcional, **não sobrescreve nome**).
  - Para novos → `INSERT`.
  - Frequência e notas → `UPSERT` por `external_id` se houver, senão `INSERT` vinculado ao aluno resolvido; pula órfãos com aviso.
- Ambas protegidas por `requireSupabaseAuth` + checagem `is_master`.

**Tela `/app/master` — card "Importar dados externos":**
- Campos: Endpoint URL, API Key, Escola de destino, Turma (opcional).
- Botão **"Carregar prévia"** chama `previewExternalData` e renderiza tabelas separadas:
  - "Alunos a vincular" (mostra `nome existente ← payload`, matricula casada)
  - "Alunos a criar" (nome, matricula)
  - "Frequência" (qtd, qtd com aluno resolvido, qtd órfã)
  - "Notas" (idem)
- Botão **"Aplicar importação"** só habilita após prévia carregada; confirma antes.
- Mantém Textarea com JSON cru no fim para debug.

### 5. Detalhes técnicos
- Migration única cobre: (a) retro‑promover criadores a school_admin aprovado, (b) policy `UPDATE`/`DELETE` em `school_memberships` para master, (c) `students.matricula` + índice único parcial.
- Tipos `src/integrations/supabase/types.ts` serão regenerados após a migration.
- Sem mudanças em telas além de `/app/master` e (cosmético) `/app/escola`.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — bootstrap retroativo, policy master, coluna matricula.
- `src/lib/import.functions.ts` — adicionar `previewExternalData`, refatorar matching e ajuste de `importExternalData`.
- `src/lib/students.ts` — expor `matricula` no DTO.
- `src/routes/app.master.tsx` — nova seção "Pedidos de admin de escola" + UI de prévia rica no card de importação.
- (sem mudanças funcionais) `src/routes/app.escola.tsx`.

## Perguntas

1. Para casar alunos por **nome**, devo exigir match exato (normalizado) ou aceitar similaridade alta (≥0.9, igual ao agrupador de escolas duplicadas)? Similaridade pode causar falsos positivos em turmas com nomes parecidos.
2. Quando o payload trouxer `class_id`/turma diferente do aluno já cadastrado, devo **atualizar** a turma do aluno ou **ignorar** (manter cadastro atual)?
