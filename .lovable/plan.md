Vou refazer a base para usar Lovable Cloud, remover a dependência do Firebase no app e corrigir o loop de login.

## Plano

1. **Ativar Lovable Cloud e autenticação Google/Gmail**
   - Usar a autenticação nativa do Lovable Cloud.
   - Manter login por Google/Gmail e, se fizer sentido, também e-mail/senha.
   - Remover mensagens e fluxos que pedem domínio autorizado no Firebase.

2. **Criar o novo banco de dados no Lovable Cloud**
   - Criar tabelas para: perfis, papéis globais, escolas, vínculos escolares, turmas, alunos, frequência, notas e advertências.
   - Configurar regras de acesso para usuários autenticados.
   - Guardar o papel `master` em tabela separada de papéis, não dentro do perfil.

3. **Definir somente o e-mail Jefson como master**
   - Usar o e-mail já presente no projeto: `jefson.ti@gmail.com`.
   - Ao entrar/criar conta com esse e-mail, o sistema garante papel `master` automaticamente.
   - Demais usuários entram como usuário comum até serem vinculados a escola/perfil.

4. **Corrigir o loop do login**
   - Substituir o `AuthContext` atual baseado em Firebase por sessão do Lovable Cloud.
   - Criar automaticamente o perfil do usuário após login.
   - Se faltar nome, tipo de perfil ou escola, mandar para onboarding/perfil sem travar em “Carregando”.
   - Se já estiver completo, entrar direto em `/app`.

5. **Refazer onboarding e tela de perfil**
   - Salvar nome, tipo de perfil e escola no Lovable Cloud.
   - Manter tela de revisão/edição para corrigir nome, perfil e escola.
   - Permitir completar dados pendentes sem bloquear o acesso indefinidamente.

6. **Conectar as telas aos dados reais do Lovable Cloud**
   - Migrar Frequência, Notas, Turmas, Boletim, Advertências, Relatórios, Escola e Master para ler/gravar no novo banco.
   - Remover chamadas a Realtime Database, Firestore e regras Firebase.
   - Atualizar estados vazios para refletirem dados reais da escola ativa.

7. **Limpeza final**
   - Remover integrações Firebase, regras RTDB e dependência `firebase` se não forem mais usadas.
   - Atualizar textos da interface para não orientar mais o usuário a abrir Firebase Console.
   - Validar o fluxo: login Google/Gmail → perfil criado → master reconhecido → acesso ao app sem loop.