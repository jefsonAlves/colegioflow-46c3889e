## Objetivo

O projeto Firebase `projetojefson` já tem dados em **Realtime Database (RTDB)** e **Firestore** do app antigo (Kotlin/Compose). Vamos:
1. Habilitar leitura do RTDB no cliente.
2. Inspecionar o que existe nos dois bancos.
3. Migrar para o modelo novo (`users`, `schools`, `school_memberships`) preservando os `uid` originais.
4. Garantir que o login Google de um usuário antigo caia direto no dashboard certo (sem refazer onboarding).
5. Completar pontos que faltaram na Fase 1.

## O que falta na Fase 1 atual (revisão)

- `client.ts` não inicializa o **Realtime Database** (apesar do `databaseURL` estar no config).
- Não há rotina de **discovery** dos dados antigos — precisamos mapear antes de migrar.
- `ensureUserDoc` cria um `UserDoc` novo sempre que o `uid` não existe em `users/`, ignorando registros antigos do mesmo usuário (em `professores/`, `usuarios/`, etc.).
- Não há **página `/app/master/migracao`** para o Admin Master rodar/auditar a migração com segurança (dry-run + commit).
- Falta arquivo **`firestore.rules`** versionado no repo (hoje as regras só vivem no console).
- Falta **índice composto** para `school_memberships` (`schoolId + status`) — usado nos dashboards.
- `onboarding` não verifica se o e-mail já tem `membership` pré-criada pela migração; deveria pular o passo 3 nesse caso.

## Plano de execução

### 1. Cliente Firebase
- Adicionar `getDatabase` em `src/integrations/firebase/client.ts` exportando `rtdb`.
- Criar `src/integrations/firebase/rtdb.ts` com helpers `readNode(path)` e `listNode(path)`.

### 2. Discovery (passo manual assistido)
- Criar página **`/app/master/migracao`** (visível só para `globalRole = master`) com:
  - Botão **"Escanear bancos"** → lê `ref(rtdb, "/")` raiz (top-level keys + contagem) e lista todas as coleções de Firestore conhecidas (`escolas`, `professores`, `alunos`, `turmas`, `chamadas`, `notas`, `avisos`, `usuarios`, e os nomes novos).
  - Mostra resultado em JSON expansível, para você confirmar a estrutura real antes de migrar.
- Sem isso não dá pra escrever a migração "às cegas" — você não enviou o schema antigo no chat.

### 3. Mapeamento (a confirmar após o scan)
Heurísticas iniciais (ajustáveis depois do scan):

```text
antigo               → novo
─────────────────────────────────────────────
usuarios/{uid}       → users/{uid}
  nome,email,foto      name,email,photoUrl
  tipo (prof/adm/pai)  profileType
escolas/{id}         → schools/{id}
  nome,cidade,uf       name,city,state
                       + normalizedName (gerado)
                       + status="active"
professores/{uid}    → school_memberships/{auto}
  escolaId,uid         schoolId,userId
                       roleInSchool="teacher", status="approved"
admins/{uid}         → school_memberships (role="school_admin")
turmas, alunos,      → mantidos como estão (Fase 2 cuida)
chamadas, notas,
avisos
```

Regras de merge:
- **Preservar `uid`**: `users/{uid}` reusa o uid do Auth Google. Se já existir, fazemos `merge` (não sobrescreve campos preenchidos).
- **Deduplicar escolas** por `normalizedName + cidade`. Quando colidir, mantém a mais antiga e marca a outra como `merged_into`.
- **Memberships idempotentes**: chave lógica `(schoolId, userId, roleInSchool)` — se já existe `approved`, ignora.
- **Onboarding skip**: se após migração `users/{uid}.onboardingComplete = true` e há `memberships` aprovados, login já vai pro `/app`.

### 4. Script de migração (dry-run obrigatório)
- `src/lib/migration.ts`:
  - `scanLegacy()` → retorna contagem por nó/coleção.
  - `planMigration()` → produz array de operações `{type, target, payload, reason}` sem escrever.
  - `applyMigration(ops)` → executa em lotes de 400 com `writeBatch`, gravando log em `migration_runs/{runId}`.
- Na página `/app/master/migracao`: botões **Dry-run** (mostra plano) e **Executar** (confirmação dupla).

### 5. Ajuste de `ensureUserDoc`
- Antes de criar `users/{uid}`, verificar se existe `usuarios/{uid}` (RTDB) ou docs em `professores`/`admins` com mesmo email — se sim, hidratar `UserDoc` com nome/profileType/onboardingComplete=true.

### 6. Regras de segurança versionadas
- Criar `firestore.rules` no repo (cópia do que está no console, ajustada).
- Adicionar `database.rules.json` para RTDB: somente Admin Master lê/escreve durante a migração; demais negados (dados serão consumidos via Firestore após migrar).

### 7. Índices
- Adicionar `firestore.indexes.json` com índice composto `school_memberships (schoolId ASC, status ASC)`.

## Escopo fora deste plano
- Telas de Turmas/Alunos/Chamada/Notas/Relatórios/Avisos (Fase 2+).
- Migração efetiva de `chamadas`/`notas`/`avisos` (só estrutura de `schools` + `users` + `memberships` agora; o resto migra junto da Fase correspondente para evitar trabalho perdido se o schema novo mudar).

## Próximo passo após aprovação
Implemento itens 1, 2, 5, 6, 7 e a página `/app/master/migracao` com o **scan**. Aí você roda o scan, me cola o JSON do resultado e eu finalizo o `planMigration`/`applyMigration` (item 4) com o mapeamento real.
