## Adicionar botão "Voltar" nas telas internas

**Problema:** Telas como Frequência, Notas, Boletim, Avisos, Advertências, Turmas, Relatórios, Perfil, Escola, Master e Migração mostram apenas o título no topo, sem um botão para voltar ao início.

### Mudança

1. **`src/components/AppShell.tsx`** — adicionar prop opcional `back` (default `true`, exceto na home `/app`). Quando ativa, renderiza um botão chevron-left à esquerda do título no header que executa `router.history.back()` se houver histórico, com fallback para `navigate({ to: "/app" })`.

2. **`src/routes/app.index.tsx`** — passar `back={false}` (é a home, não precisa).

3. Demais rotas continuam sem alterações — herdam o botão automaticamente.

### Detalhes técnicos

- Usar `useRouter()` de `@tanstack/react-router` para acessar `router.history.length` e `router.history.back()`.
- Ícone `ChevronLeft` do `lucide-react`, botão `ghost` tamanho `icon`, aria-label "Voltar".
- Layout do header: `[Voltar] [Título ............] [right?]` mantendo `max-w-md`.

### Fora do escopo

- Não mexer no `BottomNav` nem em RLS/backend.
- Não alterar o comportamento da home `/app`.
