# Plano

## 1. Alerta de próxima aula na Home (reforçar o card atual)
O card `NextClassCard` já existe, mas é discreto e só aparece quando há horário cadastrado. Vou:
- Mover para o **topo** da Home (acima do "Olá, ...") e dar destaque visual (cor primária forte, ícone de sino).
- Mostrar **status dinâmico** baseado no relógio do aparelho:
  - "Em andamento agora · termina às HH:MM" (badge verde pulsando)
  - "Começa em X min" quando faltam ≤ 60 min
  - "Próxima aula às HH:MM" para o resto do dia
  - Esconde quando não há mais aulas hoje (e mostra "Sem aulas hoje" só se houver horários cadastrados).
- Atalho **"Iniciar chamada"** já navega para `/app/frequencia?classId=...`. Adicionar também aviso "Chamada de hoje pendente" se ainda não foi salva (consulta rápida em `attendance` filtrando por `date=hoje`).
- Lista colapsável "Mais aulas hoje" abaixo do card quando há ≥ 2.

Se ainda **não houver horários cadastrados**, exibir card discreto: "Cadastre os horários da turma para receber lembretes" → link para Turmas.

## 2. Avisos / notificações professor ↔ escola ↔ pais
Substituir o `ComingSoon` de `/app/avisos` por sistema funcional.

**Tabelas novas** (migration):
- `announcements`: `school_id`, `class_id` (null = escola toda), `author_id`, `audience` (enum: `parents`, `teachers`, `all`), `title`, `body`, `created_at`.
- `announcement_reads`: `announcement_id`, `user_id`, `read_at` (para badge de "não lidos").
- `parent_links`: `school_id`, `parent_user_id`, `student_id` — vincula pais a alunos da escola. (Já existe `students.parentUid` no domínio, mas é só um campo; uma tabela permite múltiplos responsáveis e RLS limpa.)

**RLS**:
- Membros da escola podem ler avisos da escola (filtrando `class_id` quando o aviso é específico de turma e o usuário é professor daquela turma ou pai de aluno dela).
- Professores e admins criam; pais só leem.
- `parent_links`: pai vê só os próprios; admin da escola gerencia.

**UI**:
- `/app/avisos`: lista cronológica com badge "Novo" para não lidos; filtros por turma/escola; FAB "Novo aviso" para professor/admin com escopo (escola toda / turma X) e público-alvo.
- Marca como lido ao abrir (insert em `announcement_reads`).
- Indicador de não lidos no card "Avisos" da Home (contador via `useQuery`).
- Tela em Escola (admin) para vincular pais a alunos (busca por e-mail do usuário cadastrado + seleção de aluno).

**Realtime** (opcional, fácil): `ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements` para atualizações ao vivo.

**Fora de escopo**: push notifications no celular (exige web-push + service worker — posso fazer numa próxima rodada se quiser).

## 3. Carregamento que "não abre"
Verifiquei agora: o site publicado (`colegioflow.lovable.app`) e o preview estão respondendo 200, sem erros nos logs do worker, no console do navegador ou no dev server. Antes de mudar código, preciso de mais detalhes para não atirar no escuro:

**Perguntas**:
1. O problema é no **site publicado** (`colegioflow.lovable.app`) ou no preview?
2. Acontece em **celular**, computador, ou ambos? Qual navegador?
3. O que aparece na tela — tela branca, "carregando" infinito, erro vermelho, login que não passa?
4. Acontece sempre ou só às vezes (ex.: depois de ficar parado)?

**Hipóteses prováveis** (que ataco assim que confirmar o sintoma):
- **Cache do PWA** segurando versão antiga após deploy — adicionar `meta http-equiv="cache-control"` e versionar o `manifest.webmanifest`.
- **Sessão Supabase expirada** travando o `SchoolGate` em loop de loading — adicionar fallback de erro e botão "Tentar novamente".
- **`AuthContext`** sem `errorComponent` deixando a tela branca em caso de falha — já temos boundary no root, mas posso reforçar com um estado de erro explícito no contexto.

Vou aguardar a resposta dessas perguntas para implementar a correção certa em vez de adivinhar.

## Arquivos afetados (itens 1 e 2)
- **Migration**: `announcements`, `announcement_reads`, `parent_links` + RLS + GRANTs + realtime publication.
- **Novos**: `src/lib/announcements.ts`, `src/lib/parentLinks.ts`.
- **Editados**:
  - `src/components/NextClassCard.tsx` — status dinâmico, contagem regressiva, verificação de chamada pendente.
  - `src/routes/app.index.tsx` — card no topo, badge de não lidos em "Avisos".
  - `src/routes/app.avisos.tsx` — substituir `ComingSoon` por lista + composer.
  - `src/routes/app.escola.tsx` — seção "Vincular responsáveis".
