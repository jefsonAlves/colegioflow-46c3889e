## Visão geral

Reorganizar o ColégioFlow para suportar quatro papéis claros (master, secretaria/admin da escola, professor, pai) com fluxos de cadastro controlados, e implementar as funcionalidades pedagógicas pedidas (notas fracionárias, marcadores de necessidades, advertências em tempo real, agenda de aulas/reuniões, importação de alunos por lista).

Antes de codar, preciso confirmar alguns pontos abaixo — eles mudam bastante a modelagem.

---

## 1. Correção do fluxo de acesso (bugs atuais)

- Revisar `AuthContext` + `_authenticated` para eliminar o loop de login (hoje o `ensureUserDoc` pode falhar silenciosamente e travar o boot).
- Garantir que `jefson.ti@gmail.com` sempre entre como `master` (trigger já existe; validar e cobrir caso de já existir conta antiga).
- Tela `/login` apenas com Google (remover qualquer auto-sign-up de pais).

## 2. Papéis e cadastro

Papéis no sistema:
- **master** — só `jefson.ti@gmail.com`.
- **school_admin / secretaria** — quem cria a escola vira admin dela.
- **teacher** — entra via Google, pede vínculo a uma escola existente (aprovação do admin) **ou** cria uma escola nova informando só o nome (vira admin daquela escola se for a primeira).
- **parent** — **não pode se cadastrar sozinho**. Só entra por link/convite gerado pela secretaria, que define e-mail e senha inicial; o pai troca depois.

Regras:
- Login com Google segue aberto, mas só cria perfil "pendente" se o e-mail não estiver pré-autorizado como pai.
- Pais podem ter vários filhos, na mesma escola ou em escolas diferentes (tabela `parent_students` N:N).
- Secretaria pode restringir quem cadastra turmas/alunos/transferências (flag por escola: "apenas secretaria" vs "professores também").

## 3. Turmas, alunos e transferências

- Turma guarda **série/ano**, **dias da semana de aula** e **professor(es) responsáveis**.
- Cadastro de alunos em lote: colar lista de nomes (um por linha) → sistema ordena alfabeticamente e cria.
- Cada aluno pode receber **marcadores de necessidades** (TEA, DI, TDAH, etc.) com sigla curta — visíveis para professores e pais autorizados.
- Transferência interna de aluno entre turmas:
  - Se a escola permite, professor faz direto.
  - Se restrito, gera pedido para a secretaria aprovar.

## 4. Notas

- Professor cria **atividades por data** (não só P1/P2/atividade fixa).
- Nota aceita fracionário (`7.8`, `9.5`) — input numérico com `step=0.1`, validação 0–10.
- Média do bimestre/trimestre calculada por média ponderada das atividades (peso configurável por atividade, default 1).
- Boletim do aluno mostra atividades + média + parecer.

## 5. Frequência, advertências e relatos

- Frequência usa os **dias de aula da turma** para montar o calendário automático.
- Relatos/ocorrências comuns: visíveis para os pais cadastrados em tempo real (Realtime do Supabase).
- **Advertência**: ao salvar, dispara notificação imediata (in-app + e-mail) para os pais cadastrados, com data, hora e motivo. Pais não cadastrados não recebem nada.

## 6. Agenda / calendário do professor

- Cada turma define dias da semana de aula → gera ocorrências no calendário.
- Em cada aula o professor registra: conteúdo aplicado, planejamento, observações.
- Pais autorizados visualizam o que foi dado em cada aula do(s) filho(s).

## 7. Reuniões

- Pai cadastrado pode **solicitar reunião** escolhendo data/horário.
- Solicitação fica pendente até **professor + direção** aceitarem; pai vê o status em tempo real.

## 8. Notificações em tempo real

- Tabela `notifications` + canal Realtime por `user_id`.
- Eventos: advertência criada, relato novo, resposta de reunião, transferência aprovada.
- E-mail só para advertências (via Lovable Emails — exige configurar domínio depois).

---

## Mudanças técnicas (resumo)

Banco (nova migração):
- `parent_students` (N:N pais ↔ alunos)
- `parent_invites` (e-mail + senha inicial criada pela secretaria, status, token)
- `student_tags` (TEA, TDAH, DI, …)
- `class_schedule` (dias da semana por turma)
- `lessons` (uma por dia de aula efetivo: conteúdo, planejamento, obs)
- `activities` + `activity_grades` (substitui o esquema P1/P2/ATIVIDADE atual; mantém compat lendo o legado)
- `incidents` (relatos) e `warnings` (advertências, com flag de notificado)
- `meeting_requests` (pai → professor+direção, com dupla aprovação)
- `notifications`
- Flag `restrict_management_to_admin` em `schools`
- Todas com RLS por escola + papel, seguindo o padrão `is_school_member` / `is_school_admin` / `is_master`.

Front:
- Onboarding diferenciado por papel.
- Tela de gestão de pais (secretaria): convidar, definir senha inicial, vincular filhos.
- Importador de alunos em lote.
- UI de atividades + notas fracionárias.
- Calendário semanal do professor com registro de aula.
- Centro de notificações + toasts em tempo real.
- Tela de reuniões com aprovação dupla.

---

## Preciso confirmar antes de implementar

1. **Bimestre vs trimestre**: o esquema atual usa `trimester`. Manter trimestre ou trocar para bimestre (4 períodos)? Você cita "bimestre" no fluxo.
2. **Senha inicial de pais**: a secretaria define **uma senha única para todos os pais daquela escola** (e cada pai troca depois), ou **uma senha por pai** no momento do convite? Sua mensagem sugere "senha universal como deseja" — quero confirmar se é uma só por escola.
3. **Aprovação de reunião**: precisa de **professor + direção** ambos aceitarem, ou basta um dos dois?
4. **Notificação de advertência por e-mail**: posso configurar o envio por e-mail agora (vai pedir cadastro de domínio próprio) ou por enquanto só notificação in-app + Realtime?

Assim que você responder, eu detalho a migração SQL e começo a implementar.