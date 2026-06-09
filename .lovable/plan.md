## O que vou implementar

### 1. Nova tela inicial `/app` (substitui o placeholder)
`src/routes/app.index.tsx` vira um dashboard mobile-first com:
- Saudação "Olá, {primeiro nome}" + subtítulo por perfil (Professor / Admin / Família).
- **Grid 2×3 com 6 cards grandes** (124px alt., ícone em badge colorida, título + descrição curta), cada um navegando via `<Link>`:
  - Frequência → `/app/frequencia`
  - Notas → `/app/notas`
  - Turmas → `/app/turmas`
  - Boletim → `/app/boletim`
  - Advertências → `/app/advertencias`
  - Relatórios → `/app/relatorios`
- Card largo extra: **Avisos** → `/app/avisos`.
- Para `school_admin`: card extra **Minha escola** → `/app/escola`.
- Paleta azul/verde/branco usando tokens `primary`/`secondary`/`accent` já no design system.

### 2. Esqueleto das 7 áreas (rotas vazias navegáveis)
Crio 7 arquivos de rota `src/routes/app.{frequencia,notas,turmas,boletim,advertencias,relatorios,avisos}.tsx`, todos com `AppShell` + `EmptyState` PT-BR ("Em construção — disponível em breve") + botão "Voltar". Isso garante que **clicar em qualquer card já navega sem 404**. O CRUD completo de cada área entra nas próximas fases.

### 3. Robustez do boot (resolve o travamento atual)
O log mostra que o Firestore `(default)` não existe → `ensureUserDoc` lança `unavailable` → `userDoc` fica null → `/app` trava em spinner para sempre.

`src/contexts/AuthContext.tsx`:
- Adicionar estado `bootError: { code, message, firestoreMissing }`.
- Detectar `code === "unavailable"` ou mensagem "Database '(default)' not found" / "client is offline" e marcar `firestoreMissing = true`.
- Expor `retryBoot()` para re-hidratar sem precisar dar logout.

`src/routes/app.tsx` (layout):
- Se `bootError`, em vez de spinner infinito, renderizar **card de diagnóstico** em PT-BR explicando que o Firestore precisa ser ativado, com:
  - Instruções passo a passo (Console → Firestore Database → Criar banco → modo Produção → região).
  - Link direto para `https://console.firebase.google.com/project/projetojefson/firestore`.
  - Botões **Tentar novamente** (chama `retryBoot`) e **Sair** (`signOut` + volta pro `/login`).
- Trocar mensagem de loading para "Carregando seu perfil..." em vez de spinner mudo.

### 4. Onboarding mais resiliente
`src/routes/onboarding.tsx`: capturar erro de `updateUserProfile`/`requestMembership` e mostrar toast PT-BR específico quando for erro de Firestore indisponível ("Banco de dados indisponível — peça ao admin para ativar o Firestore"), em vez de só "Erro ao salvar".

### 5. Pequenos ajustes
- `AppShell`: nenhum cambio de estrutura, mas confirmar que o card de "Minha escola" e os cards de ação ficam bem em 360–430px (testar no preview 458px atual).
- Manter o BottomNav existente (Início / Escola / Master / Perfil).

## Arquivos

**Criar (8):**
- `src/routes/app.frequencia.tsx`
- `src/routes/app.notas.tsx`
- `src/routes/app.turmas.tsx`
- `src/routes/app.boletim.tsx`
- `src/routes/app.advertencias.tsx`
- `src/routes/app.relatorios.tsx`
- `src/routes/app.avisos.tsx`

**Substituir (3):**
- `src/routes/app.index.tsx` — novo dashboard de 6 cards.
- `src/contexts/AuthContext.tsx` — adicionar `bootError` + `retryBoot`.
- `src/routes/app.tsx` — card de diagnóstico quando `bootError`.

**Editar (1):**
- `src/routes/onboarding.tsx` — toasts PT-BR específicos para erro de Firestore.

`src/routeTree.gen.ts` é regenerado automaticamente pelo plugin do TanStack Router — não edito à mão.

## Fora desta fase
- CRUD real de turmas / alunos / chamada / notas / boletim / advertência / relatórios (cada um é uma fase grande, vem depois).
- Capacitor/Android.
- Rodar migração RTDB → Firestore (já existe em **Master → Migração**, só rodar depois que o Firestore for ativado).

## Pré-requisito (ação sua, 1 minuto)
Ativar o **Cloud Firestore** no projeto `projetojefson` (Console → Firestore Database → Criar banco → Produção → região). Sem isso, mesmo com o código pronto, o app vai mostrar o card de diagnóstico que vou criar — porque o banco realmente não existe ainda. O card já vai te guiar caso esqueça.
