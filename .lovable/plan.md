# Corrigir "Permission denied" ao acessar /app/*

## Causa

O erro `Permission denied` vem do **Realtime Database**, não do app. O arquivo `database.rules.json` no repositório está correto, mas o Firebase **não publica regras automaticamente** — elas precisam ser coladas manualmente no Console (aba *Rules* do Realtime Database). Como o banco ainda está em modo *Locked* (padrão), toda leitura/escrita em `users/{uid}` é bloqueada, e o boot do AuthContext falha.

## O que vou alterar (somente UI de diagnóstico + detecção do erro)

### 1. `src/contexts/AuthContext.tsx`
- Estender `parseError` para detectar também erros de RTDB:
  - `code === "PERMISSION_DENIED"` ou mensagem contendo `permission_denied` / `Permission denied` → novo flag `rulesMissing: true`.
- Manter `firestoreMissing` por compatibilidade.

### 2. `src/routes/app.tsx`
- Quando `bootError.rulesMissing` for `true`, trocar a mensagem genérica por um card explicando:
  - "As regras do Realtime Database ainda não foram publicadas."
  - Passos numerados: abrir Console → Realtime Database → aba *Rules* → colar o JSON → publicar.
  - Bloco `<pre>` com o conteúdo exato de `database.rules.json` e botão **Copiar regras**.
  - Botão **Abrir Console do Realtime Database** apontando para `https://console.firebase.google.com/project/projetojefson/database/projetojefson-default-rtdb/rules`.
  - Botões existentes **Tentar novamente** e **Sair**.

### 3. `src/lib/rtdb-rules.ts` (novo)
- Exportar uma constante `RTDB_RULES_JSON` com o mesmo conteúdo de `database.rules.json` (string), usada pelo card de diagnóstico para o "Copiar regras".

## Fora de escopo
- Não alterar lógica de leitura/escrita, rotas, ou modelo de dados.
- Não criar novos domínios no Firebase.
- Não mexer em `database.rules.json` (já está correto).

## Como o usuário resolve depois do deploy
1. Abrir o link no card → Console do Realtime Database, aba *Rules*.
2. Clicar em **Copiar regras** no app, colar no editor do Firebase, **Publicar**.
3. Voltar ao app e clicar **Tentar novamente** — perfil carrega e o dashboard aparece.
