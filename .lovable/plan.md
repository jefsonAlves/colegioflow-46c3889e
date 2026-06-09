## Colégio em Movimento — Fase 1

Foco: base sólida de autenticação, identidade do usuário, modelagem de escolas e perfis. Sem chamada/notas/relatórios ainda — esses entram nas fases seguintes sobre essa base.

### Stack
- React + Vite + TS + Tailwind (já no template)
- TanStack Router (roteamento existente)
- **Firebase Web SDK**: Auth (Google) + Firestore
- Mobile-first puro (Capacitor depois)
- Paleta azul/verde/branco; cards grandes; bottom nav

### Configuração Firebase
- Hardcode do `firebaseConfig` fornecido em `src/integrations/firebase/client.ts` (apiKey Web é publishable, ok no código).
- Admin Master: email fixo `jefson.ti@gmail.com` em constante `ADMIN_MASTER_EMAIL` — usuário recebe `globalRole = "master"` no primeiro login.
- Ação manual sua no Firebase Console (vou listar nas instruções finais):
  1. Authentication → Sign-in method → ativar Google.
  2. Authentication → Settings → adicionar o domínio do preview Lovable em "Authorized domains".
  3. Firestore Database → criar banco (modo produção).
  4. Colar as regras de segurança que vou fornecer.

### Estrutura de dados (Firestore — Fase 1)
Coleções:
- `users/{uid}`: name, email, photoUrl, globalRole (`master|user`), onboardingComplete, createdAt, updatedAt, active
- `schools/{id}`: name, normalizedName (lowercase sem acento), city?, state?, createdBy, status (`active|pending|blocked`), createdAt, updatedAt
- `school_memberships/{id}`: schoolId, userId, roleInSchool (`school_admin|teacher|coordinator`), status (`pending|approved|rejected|blocked`), approvedBy?, createdAt
- `audit_logs/{id}`: userId, action, entityType, entityId, before?, after?, createdAt

Demais coleções (turmas/alunos/chamada/notas/relatórios/avisos) ficam para próximas fases.

### Regras de segurança (resumo)
- `users`: leitura/escrita do próprio doc; master lê tudo.
- `schools`: leitura autenticada; criação por qualquer autenticado (status=`pending` se criada por não-master, `active` se master); update somente master ou school_admin da escola.
- `school_memberships`: usuário lê suas próprias; school_admin lê as da sua escola; master lê tudo; criação pelo próprio usuário (status=`pending`); aprovação por master ou school_admin.
- `audit_logs`: escrita por server-side trusted apenas (na Fase 1 escrevemos do client com regra restrita; logs sensíveis vão para fases com Functions).

### Fluxo de telas (Fase 1)

1. **`/login`** — botão "Entrar com Google", logo/identidade "Colégio em Movimento".
2. **`/onboarding`** (após primeiro login se `onboardingComplete=false`):
   - Passo 1: Nome completo
   - Passo 2: Tipo de perfil (Professor / Admin da Escola / Pai-Responsável)
   - Passo 3: Vincular escola
     - Campo de busca com debounce sobre `schools.normalizedName` (prefix match)
     - Lista resultados com cidade/estado
     - Botão "Solicitar vínculo" → cria `school_memberships` com status `pending`
     - Se nenhum resultado satisfatório → "Criar nova escola"
       - Antes de criar: busca por similaridade (Levenshtein client-side sobre os top 20 nomes parecidos) e mostra "Estas escolas parecem similares, é uma delas?"
       - Confirmação cria `schools` (pending) + membership como `school_admin` pending
   - Pai/Responsável: pula seleção de escola (vínculo será via filhos em fase futura) — finaliza onboarding.
4. **`/app`** (área autenticada com bottom nav) — roteia por perfil:
   - **Dashboard Professor**: lista de escolas vinculadas (com status do vínculo), seletor de escola ativa (persistido), placeholders dos blocos de Turmas/Chamada/Notas/Relatórios/Avisos com aviso "Em breve nas próximas fases".
   - **Dashboard Admin Escola**: card da escola, lista de professores pendentes (aprovar/rejeitar), contagem de membros. Demais blocos como placeholders.
   - **Dashboard Admin Master**: total de escolas, escolas pendentes (aprovar/bloquear), usuários ativos, possíveis duplicatas (agrupamento por `normalizedName` similar), unir escolas duplicadas (merge: move memberships para escola alvo, marca origem como `merged_into`).
   - **Dashboard Pais**: placeholder "Aguardando vínculo com aluno — disponível na próxima fase".
5. **`/perfil`** — dados do usuário, trocar nome/tipo, sair.

### Arquitetura de código
```
src/
  integrations/firebase/
    client.ts          # initializeApp, getAuth, getFirestore
    auth.ts            # signInWithGoogle, signOut, onAuthStateChange
  lib/
    schools.ts         # search, create-with-dedup, similarity, merge
    memberships.ts     # request, approve, reject
    users.ts           # ensureUserDoc, updateProfile
    normalize.ts       # normalizeName, levenshtein
    constants.ts       # ADMIN_MASTER_EMAIL
  contexts/
    AuthContext.tsx    # user + userDoc + role helpers
  components/
    AppShell.tsx       # bottom nav, header
    EmptyState.tsx, Loading.tsx, ErrorState.tsx
    SchoolSearch.tsx, SchoolCard.tsx
  routes/
    index.tsx              # redireciona /login ou /app
    login.tsx              # público
    onboarding.tsx         # autenticado, sem onboarding
    _app/                  # layout autenticado (gate)
      route.tsx
      index.tsx            # roteia para dashboard certo
      perfil.tsx
      master.tsx           # admin master
      escola.tsx           # admin escola
```
Gate de auth: TanStack Router `beforeLoad` em `_app/route.tsx` que checa Firebase Auth state e onboardingComplete; redireciona conforme.

### Estados de UI
Todas as telas com lista terão: loading skeleton, empty state ilustrado, erro com retry, sucesso via toast.

### O que NÃO entra nesta fase
Turmas, alunos, chamada, notas, fechamento de bimestre, relatórios diários, avisos, vínculo pai-aluno, exportação PDF, Capacitor. Cada um vira uma fase própria depois, reaproveitando esta base.

### Entregáveis ao final
- App funcional com login Google real.
- Onboarding com criação/busca/dedup de escolas.
- 3 dashboards (Master, Escola, Professor) operacionais para o que existe.
- Aprovação de vínculos e merge de escolas duplicadas pelo Master.
- Instruções passo-a-passo de configuração no Firebase Console + regras de segurança prontas para colar.

Próxima fase sugerida após validar: **Turmas + Alunos + Chamada** (núcleo do dia-a-dia do professor).