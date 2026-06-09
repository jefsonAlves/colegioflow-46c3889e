## Diagnóstico

O login fica preso porque o boot grava em **Cloud Firestore**, que ainda não foi ativado no projeto `projetojefson`. O **Realtime Database (RTDB)** já está ativo (URL `europe-west1`) e já contém os dados antigos do app. A solução é migrar a camada de dados de boot (users / schools / memberships) **e** todas as áreas pedidas (turmas, alunos, frequência, notas, boletim, advertências, relatórios) para o RTDB. Sem novos domínios.

## Fase 1 — Destravar login (camada de boot vai para o RTDB)

Reescrever para usar `firebase/database` em vez de `firestore`:
- `src/lib/users.ts` — `ensureUserDoc`, `updateUserProfile`, `getUserDoc` lendo/gravando em `/users/{uid}`. Hidrata legado: se já existir `name`/`profileType` no nó antigo, reaproveita; senão cria com `onboardingComplete: false`. Detecta master por e-mail.
- `src/lib/schools.ts` — `createSchool`, `getSchool`, `searchSchoolsByPrefix`, `findSimilarSchools`, `listAllSchoolsForMaster`, `setSchoolStatus`, `mergeSchools` em `/schools/{schoolId}` + índice `/schools_index/{normalizedName}` para busca por prefixo.
- `src/lib/memberships.ts` — `requestMembership`, `listMembershipsForUser`, `listMembershipsForSchool`, `setMembershipStatus` em `/school_memberships/{id}` + índices `byUser/{uid}/{id}` e `bySchool/{sid}/{id}`.
- `src/contexts/AuthContext.tsx` — mantém `bootError` mas agora ele só dispara em falha real do RTDB (raro). Auto-redireciona para `/onboarding` se `onboardingComplete=false` ou `/app` se completo. Sem mais "Database (default) not found".
- `src/routes/login.tsx` — assim que `firebaseUser && userDoc` aparece, navega imediatamente (já existe, vai funcionar agora que o `userDoc` é criado em milissegundos).
- `src/routes/app.tsx` — mantém card de diagnóstico mas mostra mensagem genérica em caso de falha do RTDB.

Resultado: ao detectar o login, o sistema entra sem travar.

## Fase 2 — Tela de revisão/edição do perfil

`src/routes/app.perfil.tsx` ganha um modo edição:
- Botão **Editar perfil** abre um formulário (mesma página) com:
  - Nome completo
  - Tipo de perfil (Professor / Admin / Pai)
  - Escola vinculada (busca/criar/trocar, reaproveita o `SchoolStep` do onboarding extraído para `src/components/SchoolPicker.tsx`)
- Salva chamando `updateUserProfile` + `requestMembership` (se trocou de escola).
- Aviso quando há membership pendente ("Aguardando aprovação do admin").
- Botão "Concluir cadastro" se `onboardingComplete=false`, evitando que o usuário fique preso no onboarding.

Nova rota auxiliar: nenhuma — tudo no `/app/perfil`.

## Fase 3 — Modelo de dados no RTDB para escola/turma/aluno

Caminhos:
```
/schools/{sid}                       — dados da escola
/school_memberships/{mid}            — vínculo user↔school
/classes/{sid}/{cid}                 — turma { name, year, teacherUid, createdAt }
/students/{sid}/{stid}               — aluno { name, classId, parentUid?, active }
/attendance/{sid}/{cid}/{YYYY-MM-DD}/{stid} — { status: P|F|J, by, at }
/grades/{sid}/{cid}/{bimestre}/{stid}       — { p1, p2, atividade, media, by, at }
/disciplinary/{sid}/{id}             — { studentId, type, description, date, by }
/notices/{sid}/{id}                  — { title, body, audience, createdAt, by }
```

Novos módulos em `src/lib/`:
- `classes.ts` — `listClasses`, `createClass`, `getClass`, `updateClass`, `deleteClass`
- `students.ts` — `listStudentsByClass`, `createStudent`, `updateStudent`
- `attendance.ts` — `getAttendance(sid,cid,date)`, `setAttendance(sid,cid,date,map)`, `summaryByStudent`
- `grades.ts` — `getGrades(sid,cid,bim)`, `setGrade(...)`, `studentGrades(stid)`
- `disciplinary.ts` — `list`, `create`

## Fase 4 — Ligar as 6 telas a dados reais

Cada arquivo `src/routes/app.{...}.tsx` deixa de ser placeholder e usa `useQuery` em cima da escola ativa (`localStorage.activeSchool`). Se não há escola ativa, mostra card "Selecione uma escola" com link para `/app`.

- **Turmas** (`app.turmas.tsx`): lista cards de turmas com nº de alunos. Botão flutuante "Nova turma". Clique → drawer/modal de detalhe com lista de alunos + "Adicionar aluno".
- **Frequência** (`app.frequencia.tsx`): seleciona turma → data (default hoje) → lista de alunos com botões P/F/J (3 toggles) → "Salvar chamada". Mostra última data salva.
- **Notas** (`app.notas.tsx`): seleciona turma → bimestre (1–4) → tabela aluno × {P1, P2, Atividade, Média auto} com inputs numéricos. Salvar por linha.
- **Boletim** (`app.boletim.tsx`): seleciona turma → lista alunos → clique abre boletim com 4 bimestres (médias) + % de presença calculado da Frequência.
- **Advertências** (`app.advertencias.tsx`): lista cronológica reversa com filtro por turma. Botão "Nova advertência" (escolhe aluno, tipo verbal/escrita/grave, descrição).
- **Relatórios** (`app.relatorios.tsx`): cards-resumo da escola ativa: nº turmas, nº alunos, frequência média do mês, média geral por turma (top 5).

Permissões na UI:
- Professor: só vê turmas onde é `teacherUid`.
- Admin da escola (`school_admin` aprovado): vê todas as turmas da escola e pode criar.
- Pai: por enquanto bloqueado com aviso "em breve".

## Fase 5 — Regras de segurança do RTDB

Atualizar `database.rules.json` para refletir os caminhos novos: `users` só dono, `schools` leitura para membros + admin master, `school_memberships` dono ou admin, `classes/students/attendance/grades/disciplinary` exigem membership aprovada na escola, professor só escreve em turmas onde é `teacherUid`. Master tem acesso global.

## Arquivos

**Editar (8):**
- `src/lib/users.ts`, `src/lib/schools.ts`, `src/lib/memberships.ts`
- `src/contexts/AuthContext.tsx`, `src/routes/app.tsx`, `src/routes/onboarding.tsx`
- `src/routes/app.perfil.tsx`, `database.rules.json`

**Criar (6):**
- `src/lib/classes.ts`, `src/lib/students.ts`, `src/lib/attendance.ts`, `src/lib/grades.ts`, `src/lib/disciplinary.ts`
- `src/components/SchoolPicker.tsx` (extraído do onboarding, reutilizado em perfil)

**Substituir conteúdo (6 rotas):**
- `src/routes/app.turmas.tsx`, `src/routes/app.frequencia.tsx`, `src/routes/app.notas.tsx`, `src/routes/app.boletim.tsx`, `src/routes/app.advertencias.tsx`, `src/routes/app.relatorios.tsx`

**Não mexer:** lista de domínios autorizados no Firebase (mantém os atuais). `firestore.rules`/`firestore.indexes.json` ficam para uma migração futura — não bloqueiam mais nada.

## Fora desta fase
- Capacitor/Android (próxima fase).
- Notificações push.
- Boletim em PDF.
- Exportação de relatórios.
- Vínculo aluno↔pai (mostra aviso "em breve").

## Resultado esperado
1. Login Google ou e-mail entra direto na `/app` (ou `/onboarding` da primeira vez).
2. Perfil pode ser revisado e editado a qualquer momento.
3. As 6 telas mostram listas reais lidas do RTDB e permitem CRUD básico de turmas, alunos, chamada, notas, advertências.
4. Nenhum domínio novo precisa ser adicionado.
