# Fontes de importação salvas (Painel Master)

Adicionar, no ambiente Master do Jefson, uma seção "Fontes externas" onde ele cadastra, edita e remove conexões (URL + API key + escola/turma destino) e executa prévia/importação a partir delas. Os dados importados continuam visíveis para os membros aprovados da escola via RLS atual — sem links públicos, sem replicação para outras escolas.

## O que será adicionado

1. **Tabela `import_sources`** (somente master acessa)
   - Campos visíveis: `label`, `base_url`, `school_id` (destino), `class_id` (opcional), `last_run_at`, `last_status`.
   - Campo sensível: `api_key_encrypted` (criptografado server-side com `SUPABASE_SERVICE_ROLE_KEY` + `pgcrypto`). A key NUNCA volta para o cliente.
   - RLS: somente `is_master(auth.uid())` pode `SELECT/INSERT/UPDATE/DELETE`.

2. **Server functions novas** (`src/lib/importSources.functions.ts`)
   - `listImportSources()` — retorna fontes sem a key.
   - `upsertImportSource({ id?, label, baseUrl, apiKey?, schoolId, classId? })` — cria/atualiza; só grava `apiKey` se enviado.
   - `deleteImportSource({ id })`.
   - `previewImportSource({ id })` / `runImportSource({ id })` — buscam a key descriptografada server-side e delegam para a lógica já existente em `src/lib/import.functions.ts` (sem duplicar regras de matching).
   - Todas com `requireSupabaseAuth` + checagem `assertMaster`.

3. **UI no `src/routes/app.master.tsx`**
   - Novo card "Fontes externas de dados" com:
     - Lista de fontes salvas (label, escola, turma, último status/data).
     - Botões por linha: **Prévia**, **Importar**, **Editar**, **Remover**.
     - Formulário "Adicionar fonte" (label, URL, API key, escola, turma opcional). Ao editar, o campo de key fica vazio com placeholder "Manter atual".
   - O bloco atual de "campos voláteis" (URL/key digitados a cada vez) é substituído por este fluxo.
   - Prévia/importação reutilizam o componente de exibição já existente (alunos a vincular/criar, frequência, notas).

## Detalhes técnicos

- Migração:
  ```
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE TABLE public.import_sources (
    id uuid PK default gen_random_uuid(),
    label text not null,
    base_url text not null,
    api_key_encrypted bytea not null,
    school_id uuid not null references public.schools(id) on delete cascade,
    class_id uuid references public.classes(id) on delete set null,
    last_run_at timestamptz, last_status text,
    created_by uuid not null, created_at/updated_at timestamptz
  );
  GRANT SELECT,INSERT,UPDATE,DELETE ON public.import_sources TO authenticated;
  GRANT ALL ON public.import_sources TO service_role;
  ALTER TABLE ... ENABLE RLS;
  CREATE POLICY ... USING (public.is_master(auth.uid())) WITH CHECK (...);
  ```
- Criptografia: `pgp_sym_encrypt(api_key, current_setting('app.import_key'))` chamada via `supabaseAdmin.rpc` em função SECURITY DEFINER `encrypt_import_key`/`decrypt_import_key`. Chave-mestra vem de novo secret `IMPORT_KEY_SECRET` (será solicitado via add_secret na fase de build).
- A descriptografia só acontece dentro de `previewImportSource`/`runImportSource` no servidor — nunca trafega no payload de `listImportSources`.
- Reaproveita `previewExternalData`/`importExternalData` extraindo seu núcleo em um helper interno `runPreview({ schoolId, classId, baseUrl, apiKey })` para evitar duplicação.

## Fora do escopo

- Compartilhar dados com escolas externas ou gerar tokens públicos.
- Mudar regras de matching/dedup (continuam matricula → external_id → nome).
- Alterar `app.escola` ou aprovações de admin (já existem).

## Pergunta pendente para a build

- Confirmar que posso adicionar o secret `IMPORT_KEY_SECRET` (32+ chars aleatórios) na fase de implementação — sem ele, a key fica armazenada em texto plano, o que não é aceitável.
