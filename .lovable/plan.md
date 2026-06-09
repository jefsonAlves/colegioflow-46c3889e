## Diagnóstico do login

O erro `auth/unauthorized-domain` significa que o Firebase Auth recusa abrir o popup do Google porque o domínio onde o app está rodando (`aab0ba7b-01cb-4d73-ad19-ea15974c09e5.lovableproject.com`) **não está** na whitelist do projeto `projetojefson`. Os domínios autorizados hoje são:

```
projetojefson.firebaseapp.com, projetojefson.web.app, localhost, + alguns vercel/run.app de outros projetos
```

Solução completa = **ação no Firebase Console** (você) + **melhorias de UX no app** (eu).

## Ação obrigatória sua (não dá pra fazer por código)

No Firebase Console → **Authentication → Settings → Authorized domains**, adicionar:

1. `aab0ba7b-01cb-4d73-ad19-ea15974c09e5.lovableproject.com` (preview atual)
2. `*.lovableproject.com` (não é aceito wildcard, então repita para cada preview que aparecer)
3. `project--aab0ba7b-01cb-4d73-ad19-ea15974c09e5.lovable.app` (URL estável de produção)
4. `project--aab0ba7b-01cb-4d73-ad19-ea15974c09e5-dev.lovable.app` (URL estável de preview)
5. Eventual domínio customizado quando publicar.

E em **Authentication → Sign-in method**, garantir que **Google** está habilitado.

## Melhorias de código que vou fazer

### 1. Login mais robusto e auto-diagnóstico
- Em `login.tsx`, detectar `auth/unauthorized-domain` e renderizar um card explicando exatamente qual domínio precisa ser adicionado, com botão "Copiar domínio" (`window.location.hostname`) e link direto pro Console.
- Tratar `auth/popup-blocked` e `auth/popup-closed-by-user` → fallback automático para `signInWithRedirect`.
- Tratar `auth/network-request-failed` com mensagem amigável.

### 2. Fallback de autenticação
- Adicionar **login com e-mail + senha** ao lado do "Entrar com Google" (recomendação Lovable: padrão é Google + email/senha). Útil enquanto o domínio não estiver autorizado e como segundo método pros pais.
- Tela mínima: tabs "Entrar" / "Criar conta", com `signInWithEmailAndPassword` / `createUserWithEmailAndPassword`. O `ensureUserDoc` já cuida do resto.

### 3. Captura do retorno do redirect
- No `AuthContext`, chamar `getRedirectResult(auth)` no boot para finalizar o fluxo quando o usuário voltar do redirect.

### 4. Encaminhamento ao cadastro quando não identificado
- Já está implementado: `onboarding.tsx` carrega quando `userDoc.onboardingComplete === false`. Vou só reforçar o redirecionamento em `app/index.tsx` e em `_app` para o caso de o usuário entrar direto numa URL protegida sem onboarding completo.

### 5. Mensagens em PT-BR e estados de erro
- Toasts e cards de erro em português, com sugestão de ação.

## Fora deste escopo (continua nas próximas fases)
- Turmas, alunos, chamada, notas, fechamento bimestre, relatórios, avisos.
- Capacitor/Android.
- A migração do RTDB → Firestore (continua acessível em **Master → Migração**, já entregue).

## Próximo passo após sua aprovação
Eu implemento as 5 melhorias acima. Você adiciona os domínios no Firebase Console (1 minuto). Depois disso o "Entrar com Google" abre normalmente; se algo ainda falhar, a própria tela vai mostrar o motivo e o que fazer.
